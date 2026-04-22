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
    const { rideId, preferredDriverId } = await req.json();
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

    // Calcula a taxa estimada da plataforma para esta corrida.
    // Hierarquia: tariffs.fee_percent (override por categoria) → platform_settings.global_fee_percent → 15%.
    const estimatedFee = await computeEstimatedFee(supabase, ride.category, Number(ride.price || 0));
    console.log(`[dispatch] estimated platform fee = R$${estimatedFee.toFixed(2)} (price=${ride.price})`);

    // 🌟 PRIORIDADE: motorista preferido (vindo de "favoritos → chamar")
    // Damos a ele 20s exclusivos antes do broadcast normal.
    if (preferredDriverId) {
      // valida que está online, na categoria certa e razoavelmente próximo (até 25 km)
      const { data: dl } = await supabase
        .from("driver_locations")
        .select("driver_id, lat, lng, is_online, category")
        .eq("driver_id", preferredDriverId)
        .maybeSingle();

      const distKm = dl?.lat != null
        ? Math.round(haversineKm(ride.origin_lat, ride.origin_lng, dl.lat, dl.lng) * 100) / 100
        : null;

      // Verifica também o saldo do motorista preferido (não pode ficar pior que -R$10 após a taxa)
      const { data: prefDriver } = await supabase
        .from("drivers")
        .select("balance, online_blocked, status")
        .eq("user_id", preferredDriverId)
        .maybeSingle();
      const prefBalanceOk = prefDriver
        ? (Number(prefDriver.balance || 0) - estimatedFee) >= -10
          && !prefDriver.online_blocked
          && ["approved", "aprovado"].includes(String(prefDriver.status))
        : false;

      if (dl?.is_online && dl.category === ride.category && distKm != null && distKm <= 25 && prefBalanceOk) {
        const expiresAt = new Date(Date.now() + 20 * 1000).toISOString();
        const { error: prefErr } = await supabase.from("ride_offers").insert({
          ride_id: rideId,
          driver_id: preferredDriverId,
          distance_to_pickup_km: distKm,
          expires_at: expiresAt,
          status: "pending",
        });
        if (prefErr) {
          console.error("[dispatch] preferred offer error:", prefErr);
        } else {
          console.log(`[dispatch] ⭐ exclusive offer to preferred driver ${preferredDriverId} (${distKm}km)`);
          // Aguarda até 21s o motorista preferido responder
          const deadline = Date.now() + 21 * 1000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1500));
            const { data: chk } = await supabase
              .from("rides").select("status, driver_id").eq("id", rideId).single();
            if (chk?.status === "accepted" && chk.driver_id) {
              console.log(`[dispatch] ✅ preferred driver accepted ${rideId}`);
              await supabase.from("ride_offers")
                .update({ status: "expired" })
                .eq("ride_id", rideId).eq("status", "pending");
              return new Response(JSON.stringify({ ok: true, accepted_by: chk.driver_id, preferred: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            if (chk?.status && chk.status !== "requested") {
              return new Response(JSON.stringify({ ok: true, status: chk.status }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
          // Expira a oferta exclusiva e segue para o broadcast
          await supabase.from("ride_offers")
            .update({ status: "expired" })
            .eq("ride_id", rideId).eq("driver_id", preferredDriverId).eq("status", "pending");
          console.log(`[dispatch] ⏱️ preferred driver did not accept, falling back to broadcast`);
        }
      } else {
        console.log(`[dispatch] preferred driver not eligible (online=${dl?.is_online}, cat=${dl?.category}, dist=${distKm})`);
      }
    }

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
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: SYSTEM_USER,
        cancel_reason_code: "no_drivers_available",
        cancel_reason_note: "Nenhum motorista por perto.",
      })
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

// Distância em km entre dois pontos (Haversine)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
