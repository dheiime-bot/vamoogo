// Edge function: seed-test-rides
// Cria N corridas fictícias (status=requested) próximas a um ponto e dispara dispatch.
// Usa N passageiros distintos (o trigger do banco impede 1 passageiro com 2 rides ativas).
// Cancela rides SEED anteriores antes de criar novas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_LAT = -23.5505;
const DEFAULT_LNG = -46.6333;

const jitter = (base: number, kmRange: number) => {
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
    // Sem teto: pode disparar quantas o pool de passageiros suportar
    const count = Math.max(1, Number(body.count) || 5);
    const centerLat = Number(body.centerLat) || DEFAULT_LAT;
    const centerLng = Number(body.centerLng) || DEFAULT_LNG;
    const category = body.category || "economico";
    const explicitPax = body.passengerId as string | undefined;

    // Cancela rides SEED anteriores ainda ativas (libera passageiros)
    const { data: oldSeed } = await supabase
      .from("rides")
      .select("id")
      .like("admin_notes", "[SEED%")
      .in("status", ["requested", "accepted"]);
    if (oldSeed && oldSeed.length > 0) {
      await supabase
        .from("rides")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: callerId })
        .in("id", oldSeed.map((r: any) => r.id));
      console.log(`[seed-test-rides] cancelled ${oldSeed.length} previous SEED rides`);
    }

    // Monta pool de passageiros DISTINTOS sem rides ativas (trigger impede 2/pax)
    let pool: string[] = [];
    if (explicitPax) {
      pool = [explicitPax];
    } else {
      // 1) Busca passageiros ativos (sem teto — pega todos disponíveis)
      const { data: allPax } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("status", "ativo")
        .eq("user_type", "passenger");
      const allIds = (allPax || []).map((p: any) => p.user_id);

      // 2) Remove os que já têm ride ativa (requested/accepted/in_progress)
      const { data: busy } = await supabase
        .from("rides")
        .select("passenger_id")
        .in("status", ["requested", "accepted", "in_progress"]);
      const busySet = new Set((busy || []).map((b: any) => b.passenger_id));
      pool = allIds.filter((id) => !busySet.has(id));

      if (pool.length === 0) pool = [callerId];
    }

    // Limita count ao tamanho do pool (não pode ter 2 rides do mesmo pax)
    const effectiveCount = Math.min(count, pool.length);
    if (effectiveCount < count) {
      console.warn(`[seed-test-rides] pool=${pool.length} < count=${count} — limitado a ${effectiveCount}`);
    }

    console.log(`[seed-test-rides] creating ${effectiveCount} rides around ${centerLat},${centerLng} cat=${category} pool=${pool.length}`);

    const created: string[] = [];
    const errors: any[] = [];

    for (let i = 0; i < effectiveCount; i++) {
      const pax = pool[i];

      // Garante telefone preenchido (trigger exige)
      const { data: paxProfile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", pax)
        .maybeSingle();
      if (!paxProfile?.phone) {
        await supabase
          .from("profiles")
          .update({ phone: "1199999" + String(1000 + i).padStart(4, "0") })
          .eq("user_id", pax);
      }

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
          passenger_id: pax,
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
          ride_code: "",
          status: "requested",
          admin_notes: `[SEED ${new Date().toISOString()}] Criado por ${callerId} (pax ${i + 1}/${count})`,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`[seed-test-rides] ride ${i + 1} error:`, error);
        errors.push({ i: i + 1, error: error.message });
        continue;
      }

      created.push(ride.id);

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
