// Edge function: seed-test-rides
// Cria N corridas fictícias (status=requested) próximas a um ponto e dispara dispatch.
// Uso: chamado pelo admin via botão "Simular N corridas" em /admin/live.
//
// Body: { count?: number (default 5), centerLat?: number, centerLng?: number,
//          category?: 'moto'|'economico'|'conforto', passengerId?: string }
//
// Se passengerId não for informado, usa o admin que chamou (apenas para seed/testes).
// Cada ride é criada com origin/destination randomizados ~1-3 km do center.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Centro de São Paulo como fallback
const DEFAULT_LAT = -23.5505;
const DEFAULT_LNG = -46.6333;

const jitter = (base: number, kmRange: number) => {
  // ~1 grau lat ≈ 111 km
  const offset = (Math.random() - 0.5) * 2 * (kmRange / 111);
  return base + offset;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: precisa ser admin/master
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes } = await supabase.auth.getUser(token);
    const callerId = userRes?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "master");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado (apenas admin)" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const count = Math.min(20, Math.max(1, Number(body.count) || 5));
    const centerLat = Number(body.centerLat) || DEFAULT_LAT;
    const centerLng = Number(body.centerLng) || DEFAULT_LNG;
    const category = body.category || "economico";
    let passengerId = body.passengerId as string | undefined;

    // Se não passou passenger, usa o primeiro passageiro ativo (não admin)
    if (!passengerId) {
      const { data: somePassenger } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();
      passengerId = somePassenger?.user_id || callerId;
    }

    console.log(`[seed-test-rides] creating ${count} rides around ${centerLat},${centerLng} cat=${category} pax=${passengerId}`);

    const created: string[] = [];
    const errors: any[] = [];

    for (let i = 0; i < count; i++) {
      const oLat = jitter(centerLat, 2);
      const oLng = jitter(centerLng, 2);
      const dLat = jitter(centerLat, 5);
      const dLng = jitter(centerLng, 5);
      const distance = 3 + Math.random() * 7;
      const price = 15 + Math.random() * 25;
      const driverNet = price * 0.8;

      const { data: ride, error } = await supabase
        .from("rides")
        .insert({
          passenger_id: passengerId,
          origin_address: `🧪 TESTE ${i + 1} — Origem simulada`,
          destination_address: `🧪 TESTE ${i + 1} — Destino simulado`,
          origin_lat: oLat,
          origin_lng: oLng,
          destination_lat: dLat,
          destination_lng: dLng,
          distance_km: Number(distance.toFixed(2)),
          duration_minutes: Math.round(distance * 3),
          price: Number(price.toFixed(2)),
          driver_net: Number(driverNet.toFixed(2)),
          platform_fee: Number((price * 0.2).toFixed(2)),
          category,
          payment_method: "pix",
          passenger_count: 1,
          ride_code: "", // trigger preenche
          status: "requested",
          admin_notes: `[SEED ${new Date().toISOString()}] Criado por ${callerId}`,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`[seed-test-rides] ride ${i + 1} error:`, error);
        errors.push({ i: i + 1, error: error.message });
        continue;
      }

      created.push(ride.id);

      // Dispara dispatch em background (não espera)
      supabase.functions.invoke("dispatch-ride", { body: { rideId: ride.id } })
        .catch((e) => console.warn(`[seed-test-rides] dispatch invoke ${ride.id} failed`, e));
    }

    console.log(`[seed-test-rides] done: ${created.length}/${count} created`);

    return new Response(JSON.stringify({
      ok: true,
      created: created.length,
      total: count,
      ride_ids: created,
      errors: errors.length ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[seed-test-rides] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
