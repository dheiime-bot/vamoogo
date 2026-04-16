// Edge function: search-places
// Estratégia híbrida para encontrar endereços E estabelecimentos populares (ex: "Mix Mateus"):
// 1. Cache local (tabela `places`) — só usa se houver match muito forte (similarity >= 0.6)
// 2. Google Places Text Search — ótimo para nomes de estabelecimentos (POIs)
// 3. Google Places Autocomplete — ótimo para endereços/ruas
//
// Mescla resultados priorizando POIs (estabelecimentos) quando o usuário está digitando um nome.
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
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    const hasLoc = typeof lat === "number" && typeof lng === "number";

    // 1. Cache local — só usa hits realmente fortes
    const { data: cacheRows, error: cacheErr } = await sb.rpc("search_places", {
      _query: query,
      _lat: hasLoc ? lat : null,
      _lng: hasLoc ? lng : null,
      _limit: 5,
      _max_km: 50,
    });
    if (cacheErr) console.error("search_places rpc error:", cacheErr);

    const strongCache = (cacheRows ?? []).filter((r: any) => (r.similarity ?? 0) >= 0.55);

    const cachePredictions = strongCache.map((r: any) => ({
      place_id: r.google_place_id ?? `local:${r.id}`,
      description: `${r.name} — ${r.address}`,
      structured_formatting: { main_text: r.name, secondary_text: r.address },
      _resolved: {
        lat: r.lat,
        lng: r.lng,
        address: r.name,
        formattedAddress: r.address,
      },
      types: [r.category ?? "other"],
      source: "cache",
    }));

    if (!apiKey) {
      return new Response(JSON.stringify({ predictions: cachePredictions, source: "cache_only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Google Places Text Search (POIs / estabelecimentos)
    // Muito melhor que autocomplete para "Mix Mateus", "Atacadão", etc.
    const locationBias = hasLoc ? `&location=${lat},${lng}&radius=30000` : "";
    const textSearchUrl =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(query)}` +
      locationBias +
      `&language=pt-BR&region=br` +
      `&key=${apiKey}`;

    // 3. Google Places Autocomplete (endereços/ruas)
    const sessionParam = sessionToken ? `&sessiontoken=${encodeURIComponent(sessionToken)}` : "";
    const autocompleteUrl =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      locationBias +
      `&language=pt-BR&components=country:br` +
      sessionParam +
      `&key=${apiKey}`;

    // Executa em paralelo
    const [textRes, autoRes] = await Promise.all([
      fetch(textSearchUrl).then((r) => r.json()).catch((e) => ({ error: String(e) })),
      fetch(autocompleteUrl).then((r) => r.json()).catch((e) => ({ error: String(e) })),
    ]);

    // Converte resultados do Text Search em predictions (já trazem dados resolvidos!)
    const textPredictions = (textRes?.results ?? []).slice(0, 5).map((r: any) => ({
      place_id: r.place_id,
      description: `${r.name} — ${r.formatted_address}`,
      structured_formatting: {
        main_text: r.name,
        secondary_text: r.formatted_address,
      },
      _resolved: {
        lat: r.geometry?.location?.lat,
        lng: r.geometry?.location?.lng,
        address: r.name,
        formattedAddress: r.formatted_address,
      },
      types: r.types ?? [],
      source: "google_textsearch",
    })).filter((p: any) => p._resolved.lat && p._resolved.lng);

    const autoPredictions = (autoRes?.predictions ?? []).map((p: any) => ({
      ...p,
      source: "google_autocomplete",
    }));

    // Mescla: cache forte > text search (POIs) > autocomplete (endereços)
    const seen = new Set<string>();
    const merged: any[] = [];
    const pushUnique = (arr: any[]) => {
      for (const p of arr) {
        if (!p.place_id || seen.has(p.place_id)) continue;
        seen.add(p.place_id);
        merged.push(p);
        if (merged.length >= 8) break;
      }
    };
    pushUnique(cachePredictions);
    pushUnique(textPredictions);
    pushUnique(autoPredictions);

    // Background: salva os melhores POIs no cache para próximas buscas
    if (textPredictions.length > 0) {
      const upserts = textPredictions.slice(0, 3).map((p: any) => ({
        google_place_id: p.place_id,
        name: p.structured_formatting.main_text,
        address: p.structured_formatting.secondary_text,
        lat: p._resolved.lat,
        lng: p._resolved.lng,
        types: p.types,
        category: p.types?.[0] ?? "establishment",
        country: "BR",
        last_synced_at: new Date().toISOString(),
      }));
      sb.from("places").upsert(upserts, { onConflict: "google_place_id" }).then(({ error }) => {
        if (error) console.error("cache upsert error:", error);
      });
    }

    return new Response(
      JSON.stringify({ predictions: merged, source: "hybrid", debug: { cache: cachePredictions.length, text: textPredictions.length, auto: autoPredictions.length } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("search-places error", err);
    return new Response(JSON.stringify({ error: String(err), predictions: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
