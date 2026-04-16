/**
 * useRecentAddresses
 * Salva e recupera os últimos endereços selecionados pelo passageiro
 * em localStorage. Mostrados como sugestões instantâneas ao focar no campo vazio.
 */
import { useCallback, useEffect, useState } from "react";
import type { PlaceDetails } from "@/services/googlePlaces";

const STORAGE_KEY = "vmg:recent_addresses";
const MAX_ITEMS = 5;

export interface RecentAddress extends PlaceDetails {
  usedAt: number;
  /** types do Google (para classificar com ícone) */
  types?: string[];
}

function read(): RecentAddress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((r) => r?.placeId && typeof r.lat === "number" && typeof r.lng === "number");
  } catch {
    return [];
  }
}

function write(items: RecentAddress[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota / disabled */
  }
}

export function useRecentAddresses() {
  const [recents, setRecents] = useState<RecentAddress[]>([]);

  useEffect(() => {
    setRecents(read());
  }, []);

  const add = useCallback((place: PlaceDetails, types?: string[]) => {
    setRecents((prev) => {
      const without = prev.filter((p) => p.placeId !== place.placeId);
      const next: RecentAddress[] = [
        { ...place, types, usedAt: Date.now() },
        ...without,
      ].slice(0, MAX_ITEMS);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setRecents([]);
  }, []);

  return { recents, add, clear };
}
