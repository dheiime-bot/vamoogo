/**
 * AddressAutocompleteField
 * Componente isolado e reutilizável de autocomplete de endereço usando Google Places.
 *
 * - Mantém um session token por sessão de digitação (renovado após selecionar).
 * - Restringe resultados ao Brasil (configurado na edge function).
 * - Só considera o campo "válido" se o usuário selecionou uma sugestão (não basta digitar).
 * - Mensagens em pt-BR.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
  /** Cor do ícone/dot (ex: "text-emerald-500" / "text-rose-500") */
  accentClassName?: string;
  /** Mostrar mensagem de erro de validação */
  error?: string;
  autoFocus?: boolean;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Session token reutilizado em autocomplete + details. Renovado após cada seleção.
  const sessionTokenRef = useRef<string>(createSessionToken());

  // Sincroniza texto quando o valor selecionado vem de fora
  useEffect(() => {
    setText(value?.address ?? "");
  }, [value]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Fecha dropdown ao clicar fora
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
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchAutocomplete({
        query: q,
        sessionToken: sessionTokenRef.current,
      });
      setPredictions(results.slice(0, 6));
      setHighlight(0);
      setOpen(results.length > 0);
      setLoading(false);
    }, 280);
  }, []);

  const handleInput = (v: string) => {
    setText(v);
    // Se o usuário modificou o texto após uma seleção, invalida a seleção
    if (value) onChange(null);
    runSearch(v);
  };

  const handleSelect = async (p: PlacePrediction) => {
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
      // Renova token: a sessão de busca terminou.
      sessionTokenRef.current = createSessionToken();
    }
  };

  const handleClear = () => {
    setText("");
    onChange(null);
    setPredictions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(predictions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

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
          onFocus={() => predictions.length > 0 && setOpen(true)}
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

      {open && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95">
          {predictions.map((p, i) => (
            <button
              key={p.place_id}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => handleSelect(p)}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/40 last:border-b-0",
                i === highlight ? "bg-accent" : "hover:bg-muted"
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.structured_formatting?.main_text || p.description}
                </p>
                {p.structured_formatting?.secondary_text && (
                  <p className="truncate text-xs text-muted-foreground">
                    {p.structured_formatting.secondary_text}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
