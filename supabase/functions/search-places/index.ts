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

// Cache de "cidade do dispositivo" por coordenada arredondada (lat,lng → "Altamira-PA").
// Reduz chamadas de reverse-geocoding e estabiliza o viés geográfico.
const cityCache = new Map<string, { at: number; city: string | null; state: string | null }>();
const CITY_TTL_MS = 30 * 60_000; // 30 min
const CITY_PRECISION = 2; // ~1 km de granularidade

async function reverseGeocodeCity(lat: number, lng: number, apiKey: string) {
  const k = `${lat.toFixed(CITY_PRECISION)},${lng.toFixed(CITY_PRECISION)}`;
  const hit = cityCache.get(k);
  if (hit && Date.now() - hit.at < CITY_TTL_MS) return hit;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${lat},${lng}` +
      `&language=pt-BR&result_type=locality|administrative_area_level_2` +
      `&key=${apiKey}`;
    const r = await fetch(url).then((r) => r.json());
    const comps = r?.results?.[0]?.address_components ?? [];
    const city =
      comps.find((c: any) =>
        c.types?.includes("locality") || c.types?.includes("administrative_area_level_2")
      )?.long_name ?? null;
    const state = comps.find((c: any) => c.types?.includes("administrative_area_level_1"))
      ?.short_name ?? null;
    const value = { at: Date.now(), city, state };
    cityCache.set(k, value);
    return value;
  } catch {
    const value = { at: Date.now(), city: null, state: null };
    cityCache.set(k, value);
    return value;
  }
}

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
    // RAIO REDUZIDO para 12km → foca na cidade do dispositivo. Resultados fora ainda podem
    // aparecer no fallback, mas são fortemente penalizados na ordenação.
    const CITY_RADIUS_M = 12000;

    // Descobre a CIDADE do dispositivo (cache 30 min). Usamos para enriquecer a textQuery
    // quando o usuário não digitou nome de cidade — isso garante que ruas/lugares de
    // OUTRAS cidades com o mesmo nome NÃO apareçam antes dos da cidade do usuário.
    let deviceCity: string | null = null;
    let deviceState: string | null = null;
    if (hasLoc) {
      const c = await reverseGeocodeCity(lat, lng, apiKey);
      deviceCity = c.city;
      deviceState = c.state;
    }

    // Se a query NÃO menciona a cidade, anexamos para forçar viés. Ex:
    //   "rua das flores"  →  "rua das flores em Altamira PA"
    const queryHasCity =
      deviceCity != null &&
      q.toLowerCase().includes(deviceCity.toLowerCase());
    const enrichedQuery =
      hasLoc && deviceCity && !queryHasCity
        ? `${q} ${deviceCity}${deviceState ? " " + deviceState : ""}`
        : q;

    const locationBias = hasLoc
      ? { circle: { center: { latitude: lat, longitude: lng }, radius: CITY_RADIUS_M } }
      : undefined;
    // locationRestriction força o Google a só retornar dentro do raio (mais agressivo).
    const locationRestriction = hasLoc
      ? { circle: { center: { latitude: lat, longitude: lng }, radius: CITY_RADIUS_M } }
      : undefined;

    // SearchText (New API) — muito superior para estabelecimentos
    // Tentamos PRIMEIRO com locationRestriction (apenas cidade local).
    // Se vier vazio, fazemos fallback com locationBias (cidade preferida, mas aceita fora).
    const buildSearchTextBody = (useRestriction: boolean) => ({
      textQuery: enrichedQuery,
      languageCode: "pt-BR",
      regionCode: "BR",
      maxResultCount: 8,
      ...(hasLoc && useRestriction ? { locationRestriction } : {}),
      ...(hasLoc && !useRestriction && locationBias ? { locationBias } : {}),
    });

    const searchText = (useRestriction: boolean) =>
      fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.types,places.currentOpeningHours.openNow,places.businessStatus",
        },
        body: JSON.stringify(buildSearchTextBody(useRestriction)),
      })
        .then((r) => r.json())
        .catch((e) => ({ error: String(e) }));

    // Autocomplete legacy — campeão para endereços/ruas (mais barato)
    // RAIO 12km + strictBounds=false (permite overflow leve para ruas que cruzam bairros vizinhos).
    const sessionParam = sessionToken ? `&sessiontoken=${encodeURIComponent(sessionToken)}` : "";
    const locParam = hasLoc ? `&location=${lat},${lng}&radius=${CITY_RADIUS_M}` : "";
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

    // Roda primeira tentativa (restrição local) em paralelo com cache + autocomplete
    const [cacheRes, textResStrict, autoRes] = await Promise.all([
      cacheRpc,
      hasLoc ? searchText(true) : searchText(false),
      autocompletePromise,
    ]);

    // Fallback: se restrição local não encontrou nada relevante, refaz com bias (mais permissivo)
    let textRes: any = textResStrict;
    const strictPlaces = (textResStrict as any)?.places ?? [];
    if (hasLoc && strictPlaces.length === 0) {
      console.log(`[search-places] restrict 0 hits para "${q}", fallback bias`);
      textRes = await searchText(false);
    }

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

    // SearchText (New API) → predictions (com distância)
    const textPredictions = ((textRes as any)?.places ?? [])
      .filter((p: any) => p.businessStatus !== "CLOSED_PERMANENTLY")
      .map((p: any) => {
        const name = p.displayName?.text ?? "";
        const fullAddr = p.formattedAddress ?? p.shortFormattedAddress ?? "";
        const loc = p.location;
        if (!loc?.latitude || !loc?.longitude) return null;
        const openNow = p.currentOpeningHours?.openNow;
        const distanceKm = hasLoc ? dist(lat, lng, loc.latitude, loc.longitude) : undefined;
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
          distanceKm,
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
      }
    };
    pushUnique(cachePredictions);
    pushUnique(textPredictions);
    pushUnique(autoPredictions);

    // ORDENAÇÃO INTELIGENTE: prioriza cidade do dispositivo
    // - Score = distância (km); BÔNUS forte para cache (já validado pela cidade)
    // - Itens sem distância (autocomplete puro) recebem peso neutro = raio da cidade
    // - Penalidade FORTE para qualquer item fora do raio da cidade (>15 km)
    // - Penalidade extrema para outro estado (>200 km)
    let final = merged;
    if (hasLoc) {
      const score = (p: any): number => {
        const d = typeof p.distanceKm === "number" ? p.distanceKm : 10;
        let s = d;
        if (p.source === "cache") s -= 3; // bônus para cache local (já é da cidade)
        if (d > 15) s += 50; // saiu do raio da cidade
        if (d > 50) s += 200; // outra cidade próxima
        if (d > 200) s += 2000; // outro estado: vai pro fim
        return s;
      };
      final = [...merged].sort((a, b) => score(a) - score(b));
    }
    final = final.slice(0, 8);

    const payload = {
      predictions: final,
      source: "hybrid",
      debug: {
        deviceCity,
        deviceState,
        enrichedQuery: enrichedQuery !== q ? enrichedQuery : undefined,
        cache: cachePredictions.length,
        text: textPredictions.length,
        auto: autoPredictions.length,
        nearestKm: hasLoc && final[0]?.distanceKm ? Number(final[0].distanceKm.toFixed(1)) : null,
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
