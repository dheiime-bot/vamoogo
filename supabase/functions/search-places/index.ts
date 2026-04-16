// Edge function: search-places
// Busca primeiro no cache local (tabela `places` via RPC search_places),
// e se não houver resultados suficientes faz fallback para Google Places Autocomplete.
//
// Retorna formato unificado de "predictions" compatível com o que o front já consome.
//
// POST body: { query: string, lat?: number, lng?: number, sessionToken?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, lat, lng, sessionToken } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ predictions: [], source: "none" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPABASE_URL, ANON);

    // 1. Cache local
    const { data: cacheRows, error: cacheErr } = await sb.rpc("search_places", {
      _query: query,
      _lat: typeof lat === "number" ? lat : null,
      _lng: typeof lng === "number" ? lng : null,
      _limit: 10,
      _max_km: 30,
    });
    if (cacheErr) console.error("search_places rpc error:", cacheErr);

    const cachePredictions = (cacheRows ?? []).map((r: any) => ({
      place_id: r.google_place_id ?? `local:${r.id}`,
      description: `${r.name} — ${r.address}`,
      structured_formatting: { main_text: r.name, secondary_text: r.address },
      // dados extras já resolvidos (evita chamada de details no front)
      _resolved: {
        lat: r.lat,
        lng: r.lng,
        address: r.name,
        formattedAddress: r.address,
      },
      types: [r.category ?? "other"],
      source: "cache",
    }));

    // Se temos resultados bons (>=3), retornamos só do cache
    if (cachePredictions.length >= 3) {
      return new Response(JSON.stringify({ predictions: cachePredictions, source: "cache" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fallback Google Places
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ predictions: cachePredictions, source: "cache_only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionParam = sessionToken ? `&sessiontoken=${encodeURIComponent(sessionToken)}` : "";
    const location = (typeof lat === "number" && typeof lng === "number")
      ? `&location=${lat},${lng}&radius=50000` : "";
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      location +
      `&language=pt-BR&components=country:br` +
      sessionParam +
      `&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();
    const googlePreds = (data.predictions ?? []).map((p: any) => ({ ...p, source: "google" }));

    // Mescla: cache primeiro, depois google sem duplicar place_id
    const seen = new Set(cachePredictions.map((p) => p.place_id));
    const merged = [
      ...cachePredictions,
      ...googlePreds.filter((p: any) => !seen.has(p.place_id)),
    ].slice(0, 10);

    return new Response(JSON.stringify({ predictions: merged, source: "hybrid" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("search-places error", err);
    return new Response(JSON.stringify({ error: String(err), predictions: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
