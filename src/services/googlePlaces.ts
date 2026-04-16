/**
 * Serviço de integração com Google Places (via edge function `google-places`).
 * - Autocomplete restrito ao Brasil (components=country:br) — configurado no backend.
 * - Suporta session token (reduz custos e agrupa autocomplete + details na mesma sessão).
 * - Cache em memória client-side: queries idênticas e PREFIXOS retornam 0ms.
 *
 * Configuração: a chave GOOGLE_PLACES_API_KEY é mantida em segredo no backend
 * (Lovable Cloud → Secrets). Nunca exponha a chave no front-end.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
  types?: string[];
  source?: "cache" | "google_textsearch" | "google_autocomplete" | "memcache" | string;
  /** true=aberto, false=fechado, null/undefined=info indisponível (vem do searchText) */
  openNow?: boolean | null;
  /** Categoria já classificada (vem do cache local). */
  categoryHint?: string | null;
  /** Distância em km até a localização do usuário (calculada no backend quando lat/lng informados). */
  distanceKm?: number;
  /** Quando vem do cache local ou textsearch, já trazemos os dados resolvidos. */
  _resolved?: {
    lat: number;
    lng: number;
    address: string;
    formattedAddress: string;
  };
}

export interface PlaceDetails {
  address: string;          // nome curto / "main text"
  formattedAddress: string; // endereço completo formatado
  placeId: string;
  lat: number;
  lng: number;
}

/** Gera um session token (UUID v4) usado em toda a sessão de busca de um campo. */
export function createSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------- Cache client-side (memória) ----------------
// TTL curto (90s): equilibra freshness com performance.
// Limite de 100 entradas para não vazar memória.
type CacheEntry = { at: number; data: PlacePrediction[] };
const clientCache = new Map<string, CacheEntry>();
const TTL_MS = 90_000;
const MAX_ENTRIES = 100;
// Track de promises in-flight: evita disparar 2x a mesma busca em paralelo.
const inflight = new Map<string, Promise<PlacePrediction[]>>();

function cacheKey(q: string, lat?: number, lng?: number): string {
  const loc = typeof lat === "number" && typeof lng === "number"
    ? `${lat.toFixed(2)},${lng.toFixed(2)}`
    : "noloc";
  return `${q.toLowerCase().trim()}|${loc}`;
}

function cacheGet(key: string): PlacePrediction[] | null {
  const hit = clientCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    clientCache.delete(key);
    return null;
  }
  // Refresca posição (LRU simples)
  clientCache.delete(key);
  clientCache.set(key, hit);
  return hit.data;
}

function cacheSet(key: string, data: PlacePrediction[]) {
  if (clientCache.size >= MAX_ENTRIES) {
    const firstKey = clientCache.keys().next().value;
    if (firstKey) clientCache.delete(firstKey);
  }
  clientCache.set(key, { at: Date.now(), data });
}

/**
 * Tenta achar resultados imediatos de um cache de PREFIXO.
 * Ex: usuário já buscou "atacad" e agora digita "atacadã" → reaproveita
 * filtrando os resultados anteriores localmente. Retorna instantâneo.
 */
function findPrefixCache(q: string, lat?: number, lng?: number): PlacePrediction[] | null {
  const norm = q.toLowerCase().trim();
  if (norm.length < 2) return null;
  const loc = typeof lat === "number" && typeof lng === "number"
    ? `${lat.toFixed(2)},${lng.toFixed(2)}`
    : "noloc";
  // Procura caches cujo termo seja prefixo do atual
  for (let i = norm.length - 1; i >= 2; i--) {
    const prefix = norm.slice(0, i);
    const key = `${prefix}|${loc}`;
    const hit = clientCache.get(key);
    if (!hit) continue;
    if (Date.now() - hit.at > TTL_MS) { clientCache.delete(key); continue; }
    // Filtra os resultados que ainda casam com o termo atual
    const filtered = hit.data.filter((p) => {
      const main = p.structured_formatting?.main_text?.toLowerCase() ?? "";
      const desc = p.description?.toLowerCase() ?? "";
      return main.includes(norm) || desc.includes(norm);
    });
    if (filtered.length >= 2) return filtered;
  }
  return null;
}

/** Busca sugestões de autocomplete. */
export async function fetchAutocomplete(params: {
  query: string;
  sessionToken: string;
  lat?: number;
  lng?: number;
}): Promise<PlacePrediction[]> {
  const { query, sessionToken, lat, lng } = params;
  if (!query || query.trim().length < 2) return [];

  const key = cacheKey(query, lat, lng);

  // 1. Hit exato do cache
  const exact = cacheGet(key);
  if (exact) return exact;

  // 2. Já tem uma promise em voo para essa mesma key? Reaproveita.
  const pending = inflight.get(key);
  if (pending) return pending;

  // 3. Tenta resultados de prefixo (resposta INSTANTÂNEA enquanto a rede roda).
  // Disparamos a rede em paralelo para atualizar o cache em background.
  const prefixHit = findPrefixCache(query, lat, lng);

  const networkPromise = (async () => {
    const { data, error } = await supabase.functions.invoke("search-places", {
      body: { query, sessionToken, lat, lng },
    });
    if (error) {
      console.error("[googlePlaces] search-places error:", error);
      return [] as PlacePrediction[];
    }
    const results = (data?.predictions ?? []) as PlacePrediction[];
    cacheSet(key, results);
    return results;
  })();

  inflight.set(key, networkPromise);
  networkPromise.finally(() => inflight.delete(key));

  // Se temos prefix hit decente (>=2 resultados), retorna IMEDIATO.
  // O cache real vai ser atualizado em background.
  if (prefixHit && prefixHit.length >= 2) {
    return prefixHit;
  }

  return networkPromise;
}

/** Busca detalhes de um lugar selecionado. */
export async function fetchPlaceDetails(params: {
  placeId: string;
  sessionToken: string;
  prediction?: PlacePrediction;
}): Promise<PlaceDetails | null> {
  const { placeId, sessionToken, prediction } = params;

  // Atalho: se a prediction veio do cache local, já temos os dados resolvidos.
  if (prediction?._resolved) {
    return {
      address: prediction._resolved.address,
      formattedAddress: prediction._resolved.formattedAddress,
      placeId,
      lat: prediction._resolved.lat,
      lng: prediction._resolved.lng,
    };
  }

  const { data, error } = await supabase.functions.invoke("google-places", {
    body: { placeId, sessionToken },
  });
  if (error || !data?.result) {
    console.error("[googlePlaces] details error:", error);
    return null;
  }

  const r = data.result;
  const loc = r.geometry?.location;
  if (!loc) return null;

  return {
    address: prediction?.structured_formatting?.main_text || r.name || r.formatted_address || "",
    formattedAddress: r.formatted_address || prediction?.description || "",
    placeId,
    lat: loc.lat,
    lng: loc.lng,
  };
}
