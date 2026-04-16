/**
 * AddressAutocompleteField
 * Componente isolado e reutilizável de autocomplete de endereço usando Google Places.
 *
 * Recursos:
 * - Session token por sessão de digitação (renovado após selecionar)
 * - Resultados restritos ao Brasil
 * - Validação: só considera "válido" se o usuário selecionou uma sugestão
 * - Filtros rápidos por categoria (Tudo, Supermercado, Restaurante, Farmácia…)
 * - Distância em km até o usuário (quando GPS disponível)
 * - Ordenação por proximidade
 * - Endereços recentes do usuário ao focar no campo vazio
 * - Status "Aberto/Fechado" via Google em tempo real
 * - Mensagens em pt-BR
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { classifyPlace, type PlaceCategory } from "@/lib/placeCategories";
import { useRecentAddresses, type RecentAddress } from "@/hooks/useRecentAddresses";
import {
  createSessionToken,
  fetchAutocomplete,
  fetchPlaceDetails,
  type PlaceDetails,
  type PlacePrediction,
} from "@/services/googlePlaces";

interface Props {
  label: string;
  placeholder: string;
  value: PlaceDetails | null;
  onChange: (value: PlaceDetails | null) => void;
  accentClassName?: string;
  error?: string;
  autoFocus?: boolean;
}

type FilterKey = "all" | "supermarket" | "food" | "pharmacy" | "gas_station" | "health";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "supermarket", label: "Mercado" },
  { key: "food", label: "Comida" },
  { key: "pharmacy", label: "Farmácia" },
  { key: "gas_station", label: "Posto" },
  { key: "health", label: "Saúde" },
];

function formatDistance(km?: number): string | null {
  if (typeof km !== "number" || !isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function AddressAutocompleteField({
  label,
  placeholder,
  value,
  onChange,
  accentClassName = "text-primary",
  error,
  autoFocus,
}: Props) {
  const [text, setText] = useState(value?.address ?? "");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [filter, setFilter] = useState<FilterKey>("all");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userLocRef = useRef<{ lat: number; lng: number } | null>(null);
  const sessionTokenRef = useRef<string>(createSessionToken());

  const { recents, add: addRecent } = useRecentAddresses();

  // Captura geolocalização para location bias + cálculo de distância
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => { /* sem permissão */ },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  useEffect(() => {
    setText(value?.address ?? "");
  }, [value]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const runSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchAutocomplete({
        query: q,
        sessionToken: sessionTokenRef.current,
        lat: userLocRef.current?.lat,
        lng: userLocRef.current?.lng,
      });
      setPredictions(results);
      setHighlight(0);
      setLoading(false);
    }, 180);
  }, []);

  const handleInput = (v: string) => {
    setText(v);
    if (value) onChange(null);
    setOpen(true);
    runSearch(v);
  };

  // Aplica filtro de categoria + ordena por distância (quando disponível)
  const visiblePredictions = useMemo(() => {
    let arr = predictions;
    if (filter !== "all") {
      arr = arr.filter((p) => classifyPlace(p.types, p.categoryHint).category === filter);
    }
    // Ordena: itens com distância vêm primeiro, ordenados por proximidade.
    // Os sem distância (autocomplete puro) mantêm ordem original ao final.
    const withDist = arr.filter((p) => typeof p.distanceKm === "number");
    const without = arr.filter((p) => typeof p.distanceKm !== "number");
    withDist.sort((a, b) => (a.distanceKm! - b.distanceKm!));
    return [...withDist, ...without].slice(0, 6);
  }, [predictions, filter]);

  const handleSelectPrediction = async (p: PlacePrediction) => {
    setOpen(false);
    setLoading(true);
    const details = await fetchPlaceDetails({
      placeId: p.place_id,
      sessionToken: sessionTokenRef.current,
      prediction: p,
    });
    setLoading(false);
    if (details) {
      onChange(details);
      setText(details.address);
      addRecent(details, p.types);
      sessionTokenRef.current = createSessionToken();
    }
  };

  const handleSelectRecent = (r: RecentAddress) => {
    setOpen(false);
    onChange({
      address: r.address,
      formattedAddress: r.formattedAddress,
      placeId: r.placeId,
      lat: r.lat,
      lng: r.lng,
    });
    setText(r.address);
    addRecent(r, r.types); // sobe pro topo
  };

  const handleClear = () => {
    setText("");
    onChange(null);
    setPredictions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || visiblePredictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, visiblePredictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelectPrediction(visiblePredictions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Mostra recentes quando o campo está vazio e focado
  const showRecents = open && text.trim().length < 2 && recents.length > 0;
  const showResults = open && visiblePredictions.length > 0 && text.trim().length >= 2;
  // Filtros só fazem sentido quando há resultados pesquisados
  const showFilters = open && predictions.length > 0 && text.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 transition-colors",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          error ? "border-destructive" : "border-input"
        )}
      >
        <MapPin className={cn("h-4 w-4 shrink-0", accentClassName)} />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!loading && text && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted"
            aria-label="Limpar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

      {(showRecents || showResults) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95">
          {/* Filtros por categoria */}
          {showFilters && (
            <div className="flex gap-1.5 overflow-x-auto border-b border-border/40 bg-muted/30 px-2 py-2 scrollbar-none">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                // Conta quantos resultados existem para essa categoria
                const count = f.key === "all"
                  ? predictions.length
                  : predictions.filter((p) => classifyPlace(p.types, p.categoryHint).category === f.key as PlaceCategory).length;
                if (f.key !== "all" && count === 0) return null;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {f.label}
                    {f.key !== "all" && <span className="ml-1 opacity-60">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Recentes */}
          {showRecents && (
            <div>
              <div className="flex items-center gap-2 border-b border-border/40 bg-muted/20 px-3 py-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recentes
                </span>
              </div>
              {recents.map((r) => {
                const info = classifyPlace(r.types);
                const Icon = info.icon;
                return (
                  <button
                    key={r.placeId}
                    type="button"
                    onClick={() => handleSelectRecent(r)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/40 last:border-b-0 hover:bg-muted"
                  >
                    <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", info.bg)}>
                      <Icon className={cn("h-4 w-4", info.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.address}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.formattedAddress}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Resultados da busca */}
          {showResults && visiblePredictions.map((p, i) => {
            const info = classifyPlace(p.types, p.categoryHint);
            const Icon = info.icon;
            const distLabel = formatDistance(p.distanceKm);
            return (
              <button
                key={p.place_id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => handleSelectPrediction(p)}
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/40 last:border-b-0",
                  i === highlight ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", info.bg)}>
                  <Icon className={cn("h-4 w-4", info.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {p.structured_formatting?.main_text || p.description}
                    </p>
                    {p.openNow === true && (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-700 dark:text-emerald-400">
                        Aberto
                      </span>
                    )}
                    {p.openNow === false && (
                      <span className="shrink-0 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-rose-700 dark:text-rose-400">
                        Fechado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.structured_formatting?.secondary_text && (
                      <p className="truncate text-xs text-muted-foreground">
                        {p.structured_formatting.secondary_text}
                      </p>
                    )}
                    {distLabel && (
                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground/80">
                        • {distLabel}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Nenhum resultado para o filtro atual */}
          {showResults === false && showFilters && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum resultado nesta categoria.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
