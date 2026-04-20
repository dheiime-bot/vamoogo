// Edge function: dispatch-ride
// Faz o match de uma corrida (status=requested) com motoristas próximos.
// Cria 5 ofertas simultâneas por rodada (broadcast); TTL 25s. Até 3 rodadas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Janela total de busca = 30s. 1 rodada com TTL de 28s + buffer de 2s.
const OFFER_TTL_SECONDS = 28;
const MAX_ROUNDS = 1;
const BATCH_SIZE = 5;

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

    console.log(`[dispatch] starting for ride ${rideId} cat=${ride.category} at ${ride.origin_lat},${ride.origin_lng}`);

    // Limpa motoristas zumbi (sem heartbeat há > 2min) antes de buscar candidatos
    const { data: zCount } = await supabase.rpc("cleanup_zombie_drivers");
    if (zCount && zCount > 0) console.log(`[dispatch] cleaned ${zCount} zombie drivers`);

    for (let round = 0; round < MAX_ROUNDS; round++) {
      // Re-checa: corrida já pode ter sido aceita/cancelada
      const { data: cur } = await supabase
        .from("rides").select("status, driver_id").eq("id", rideId).single();
      if (!cur || cur.status !== "requested") {
        console.log(`[dispatch] ride ${rideId} no longer requested (${cur?.status}) — exiting`);
        return new Response(JSON.stringify({ ok: true, status: cur?.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: previousOffers } = await supabase
        .from("ride_offers").select("driver_id").eq("ride_id", rideId);
      const triedIds = new Set((previousOffers || []).map((o: any) => o.driver_id));

      const { data: candidates, error: candErr } = await supabase
        .rpc("find_nearest_drivers", {
          _lat: ride.origin_lat,
          _lng: ride.origin_lng,
          _category: ride.category,
          _limit: 10,
          _max_km: 25,
        });

      if (candErr) {
        console.error("[dispatch] find_nearest_drivers error:", candErr);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      const fresh = (candidates || []).filter((c: any) => !triedIds.has(c.driver_id));
      console.log(`[dispatch] round ${round}: ${candidates?.length || 0} nearby, ${fresh.length} new`);

      if (fresh.length === 0) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      const batch = fresh.slice(0, BATCH_SIZE);
      const expiresAt = new Date(Date.now() + OFFER_TTL_SECONDS * 1000).toISOString();
      const offers = batch.map((c: any) => ({
        ride_id: rideId,
        driver_id: c.driver_id,
        distance_to_pickup_km: Number(c.distance_km.toFixed(2)),
        expires_at: expiresAt,
        status: "pending",
      }));
      const { error: insErr } = await supabase.from("ride_offers").insert(offers);
      if (insErr) {
        console.error("[dispatch] insert offers error:", insErr);
      } else {
        console.log(`[dispatch] sent ${batch.length} offers, drivers=${batch.map((b: any) => b.driver_id).join(",")}`);
      }

      // Aguarda TTL + 1s buffer, mas verifica a cada 1.5s se alguém aceitou (early exit)
      const deadline = Date.now() + (OFFER_TTL_SECONDS + 1) * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        const { data: chk } = await supabase
          .from("rides").select("status, driver_id").eq("id", rideId).single();
        if (chk?.status === "accepted" && chk.driver_id) {
          console.log(`[dispatch] ✅ accepted by ${chk.driver_id} on round ${round}`);
          await supabase.from("ride_offers")
            .update({ status: "expired" })
            .eq("ride_id", rideId).eq("status", "pending");
          return new Response(JSON.stringify({ ok: true, accepted_by: chk.driver_id, round }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (chk?.status && chk.status !== "requested") {
          // cancelada
          return new Response(JSON.stringify({ ok: true, status: chk.status }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      await supabase.from("ride_offers")
        .update({ status: "expired" })
        .eq("ride_id", rideId).eq("status", "pending");
    }

    // Nenhum motorista aceitou — cancela e marca como cancelamento do sistema
    // UUID zero = "sistema/dispatch" (sem usuário humano associado)
    const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";
    console.log(`[dispatch] ❌ no driver accepted ${rideId} after ${MAX_ROUNDS} rounds`);
    await supabase.from("rides")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: SYSTEM_USER })
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
