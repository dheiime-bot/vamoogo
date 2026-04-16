/**
 * Serviço de integração com Google Places (via edge function `google-places`).
 * - Autocomplete restrito ao Brasil (components=country:br) — configurado no backend.
 * - Suporta session token (reduz custos e agrupa autocomplete + details na mesma sessão).
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
  // Fallback simples
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

  // Usa search-places: cache local + fallback Google
  const { data, error } = await supabase.functions.invoke("search-places", {
    body: { query, sessionToken, lat, lng },
  });
  if (error) {
    console.error("[googlePlaces] search-places error:", error);
    return [];
  }
  return (data?.predictions ?? []) as PlacePrediction[];
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
