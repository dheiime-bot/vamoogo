// Edge function: search-places
// Otimizada para máxima precisão em endereços E estabelecimentos populares.
//
// Estratégia:
// 1. Cache em memória (TTL 60s) — respostas instantâneas para queries repetidas
// 2. Cache local DB (tabela `places`) — só usa hits muito fortes (similarity >= 0.65)
// 3. Google Places API (New) v1 — searchText + autocomplete em paralelo
//    - searchText: campeão para POIs ("Mix Mateus", "Atacadão", restaurantes)
//      → retorna openNow, types completos, endereço formatado
//    - autocomplete: campeão para endereços/ruas
// 4. Aprende: salva os melhores POIs no cache para acelerar próximas buscas
//
// POST body: { query: string, lat?: number, lng?: number, sessionToken?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache em memória (instância da edge function viva)
const memCache = new Map<string, { at: number; data: any }>();
const MEM_TTL_MS = 60_000;
const MAX_MEM_ENTRIES = 200;

function memGet(key: string) {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > MEM_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return hit.data;
}

function memSet(key: string, data: any) {
  if (memCache.size >= MAX_MEM_ENTRIES) {
    const firstKey = memCache.keys().next().value;
    if (firstKey) memCache.delete(firstKey);
  }
  memCache.set(key, { at: Date.now(), data });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, lat, lng, sessionToken } = await req.json();
    const q = (query ?? "").toString().trim();
    if (q.length < 2) {
      return new Response(JSON.stringify({ predictions: [], source: "none" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasLoc = typeof lat === "number" && typeof lng === "number";
    const cacheKey = `${q.toLowerCase()}|${hasLoc ? `${lat.toFixed(2)},${lng.toFixed(2)}` : "noloc"}`;

    // 1. Memory cache hit
    const cached = memGet(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ ...cached, source: "memcache" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPABASE_URL, ANON);
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    // 2. Cache local DB (em paralelo com Google)
    const cacheRpc = sb.rpc("search_places", {
      _query: q,
      _lat: hasLoc ? lat : null,
      _lng: hasLoc ? lng : null,
      _limit: 5,
      _max_km: 50,
    });

    if (!apiKey) {
      const { data: cacheRows } = await cacheRpc;
      const cachePredictions = (cacheRows ?? []).map(buildCachePrediction);
      const payload = { predictions: cachePredictions, source: "cache_only" };
      memSet(cacheKey, payload);
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Google Places API (New) v1 — searchText (POIs) + Autocomplete legacy (endereços) em paralelo
    const locationBias = hasLoc
      ? { circle: { center: { latitude: lat, longitude: lng }, radius: 30000 } }
      : undefined;

    // SearchText (New API) — muito superior para estabelecimentos
    const searchTextPromise = fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.types,places.currentOpeningHours.openNow,places.businessStatus",
      },
      body: JSON.stringify({
        textQuery: q,
        languageCode: "pt-BR",
        regionCode: "BR",
        maxResultCount: 6,
        ...(locationBias ? { locationBias } : {}),
      }),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: String(e) }));

    // Autocomplete legacy — campeão para endereços/ruas (mais barato)
    const sessionParam = sessionToken ? `&sessiontoken=${encodeURIComponent(sessionToken)}` : "";
    const locParam = hasLoc ? `&location=${lat},${lng}&radius=30000` : "";
    const autocompleteUrl =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(q)}` +
      locParam +
      `&language=pt-BR&components=country:br` +
      sessionParam +
      `&key=${apiKey}`;
    const autocompletePromise = fetch(autocompleteUrl)
      .then((r) => r.json())
      .catch((e) => ({ error: String(e) }));

    const [cacheRes, textRes, autoRes] = await Promise.all([
      cacheRpc,
      searchTextPromise,
      autocompletePromise,
    ]);

    if (cacheRes.error) console.error("cache rpc:", cacheRes.error);

    // Helper haversine (km)
    const dist = (la1: number, ln1: number, la2: number, ln2: number) => {
      const R = 6371;
      const toRad = (x: number) => (x * Math.PI) / 180;
      const dLa = toRad(la2 - la1);
      const dLn = toRad(ln2 - ln1);
      const a = Math.sin(dLa / 2) ** 2 +
        Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLn / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const strongCache = (cacheRes.data ?? []).filter((r: any) => (r.similarity ?? 0) >= 0.65);
    const cachePredictions = strongCache.map((r: any) => {
      const p = buildCachePrediction(r);
      if (hasLoc) p.distanceKm = dist(lat, lng, r.lat, r.lng);
      return p;
    });

    // SearchText (New API) → predictions
    const textPredictions = ((textRes as any)?.places ?? [])
      .filter((p: any) => p.businessStatus !== "CLOSED_PERMANENTLY")
      .map((p: any) => {
        const name = p.displayName?.text ?? "";
        const fullAddr = p.formattedAddress ?? p.shortFormattedAddress ?? "";
        const loc = p.location;
        if (!loc?.latitude || !loc?.longitude) return null;
        const openNow = p.currentOpeningHours?.openNow;
        return {
          place_id: p.id,
          description: `${name} — ${fullAddr}`,
          structured_formatting: { main_text: name, secondary_text: fullAddr },
          _resolved: {
            lat: loc.latitude,
            lng: loc.longitude,
            address: name,
            formattedAddress: fullAddr,
          },
          types: p.types ?? [],
          openNow: typeof openNow === "boolean" ? openNow : null,
          distanceKm: hasLoc ? dist(lat, lng, loc.latitude, loc.longitude) : undefined,
          source: "google_textsearch",
        };
      })
      .filter(Boolean);

    const autoPredictions = ((autoRes as any)?.predictions ?? []).map((p: any) => ({
      ...p,
      source: "google_autocomplete",
    }));

    // Mescla: cache forte > POIs > endereços
    const seen = new Set<string>();
    const merged: any[] = [];
    const pushUnique = (arr: any[]) => {
      for (const p of arr) {
        if (!p?.place_id || seen.has(p.place_id)) continue;
        seen.add(p.place_id);
        merged.push(p);
        if (merged.length >= 8) break;
      }
    };
    pushUnique(cachePredictions);
    pushUnique(textPredictions);
    pushUnique(autoPredictions);

    const payload = {
      predictions: merged,
      source: "hybrid",
      debug: {
        cache: cachePredictions.length,
        text: textPredictions.length,
        auto: autoPredictions.length,
      },
    };

    memSet(cacheKey, payload);

    // Aprendizado em background: salva os melhores POIs no cache DB
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
      sb.from("places")
        .upsert(upserts, { onConflict: "google_place_id" })
        .then(({ error }: any) => {
          if (error) console.error("cache upsert:", error.message);
        });
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("search-places error", err);
    return new Response(JSON.stringify({ error: String(err), predictions: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildCachePrediction(r: any) {
  return {
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
    categoryHint: r.category ?? null,
    source: "cache",
  };
}
