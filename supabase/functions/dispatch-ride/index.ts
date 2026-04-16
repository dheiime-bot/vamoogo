// Edge function: dispatch-ride
// Faz o match de uma corrida (status=requested) com o motorista mais próximo,
// criando ofertas em sequência. Cada oferta expira em 15s. Se nenhum aceitar,
// reenfileira para a próxima rodada (até 3 rodadas).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OFFER_TTL_SECONDS = 15;
const MAX_ROUNDS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { rideId } = await req.json();
    if (!rideId) {
      return new Response(JSON.stringify({ error: "rideId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Carrega a corrida
    const { data: ride, error: rideErr } = await supabase
      .from("rides").select("*").eq("id", rideId).single();
    if (rideErr || !ride) {
      return new Response(JSON.stringify({ error: "Ride not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ride.status !== "requested") {
      return new Response(JSON.stringify({ ok: true, message: "Ride not in requested state", status: ride.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Roda até MAX_ROUNDS rodadas tentando achar quem aceite
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // Pega motoristas mais próximos que ainda não receberam oferta dessa corrida
      const { data: previousOffers } = await supabase
        .from("ride_offers").select("driver_id").eq("ride_id", rideId);
      const triedIds = (previousOffers || []).map((o) => o.driver_id);

      const { data: candidates, error: candErr } = await supabase
        .rpc("find_nearest_drivers", {
          _lat: ride.origin_lat,
          _lng: ride.origin_lng,
          _category: ride.category,
          _limit: 5,
          _max_km: 25,
        });

      if (candErr) {
        console.error("find_nearest_drivers error:", candErr);
        break;
      }

      const fresh = (candidates || []).filter((c: any) => !triedIds.includes(c.driver_id));
      if (fresh.length === 0) {
        // Sem motoristas — espera 5s pra próxima rodada
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      // Cria ofertas para os candidatos (até 3 simultâneas para acelerar)
      const batch = fresh.slice(0, 3);
      const offers = batch.map((c: any) => ({
        ride_id: rideId,
        driver_id: c.driver_id,
        distance_to_pickup_km: Number(c.distance_km.toFixed(2)),
        expires_at: new Date(Date.now() + OFFER_TTL_SECONDS * 1000).toISOString(),
        status: "pending",
      }));
      await supabase.from("ride_offers").insert(offers);

      // Aguarda TTL para ver se alguém aceitou
      await new Promise((r) => setTimeout(r, (OFFER_TTL_SECONDS + 1) * 1000));

      // Verifica se a corrida foi aceita
      const { data: updated } = await supabase
        .from("rides").select("status, driver_id").eq("id", rideId).single();
      if (updated?.status === "accepted" && updated.driver_id) {
        // Expira ofertas pendentes
        await supabase.from("ride_offers")
          .update({ status: "expired" })
          .eq("ride_id", rideId).eq("status", "pending");
        return new Response(JSON.stringify({ ok: true, accepted_by: updated.driver_id, round }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Marca ofertas como expiradas e tenta próxima rodada
      await supabase.from("ride_offers")
        .update({ status: "expired" })
        .eq("ride_id", rideId).eq("status", "pending");
    }

    // Nenhum motorista aceitou — cancela a corrida
    await supabase.from("rides")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", rideId).eq("status", "requested");

    return new Response(JSON.stringify({ ok: false, reason: "no_driver_available" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("dispatch-ride error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
