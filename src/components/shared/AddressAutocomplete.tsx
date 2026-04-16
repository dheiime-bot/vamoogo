import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Search, X, Loader2, Building2, Navigation } from "lucide-react";

interface AddressSuggestion {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
  source: "google" | "mapbox" | "local";
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  dotColor?: string;
  icon?: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}

const GOOGLE_API_KEY = "AIzaSyBmHlbBANUovbL92TlK3dRlkWap-NEHisE";
const MAPBOX_TOKEN = "pk.eyJ1IjoiZGhlaW1lIiwiYSI6ImNtbnRhNWF5azBsZ2YycHEwZGs5djl0OWsifQ.PJ4Kl52Z1ZEhqZXojAPbzg";
const ALTAMIRA_CENTER = { lat: -3.2036, lng: -52.2108 };
const BIAS_RADIUS = 50000; // 50km

const typeIcons: Record<string, string> = {
  pharmacy: "💊", hospital: "🏥", restaurant: "🍽️", gas_station: "⛽",
  supermarket: "🛒", bank: "🏦", school: "🏫", church: "⛪",
  shopping_mall: "🛍️", park: "🌳", airport: "✈️", bus_station: "🚌",
  hotel: "🏨", police: "🚔", post_office: "📮", gym: "🏋️",
  bar: "🍺", cafe: "☕", bakery: "🥖", store: "🏪",
  default: "📍",
};

function getIcon(types: string[] = []): string {
  for (const t of types) {
    if (typeIcons[t]) return typeIcons[t];
  }
  return typeIcons.default;
}

const debounce = (fn: (...args: any[]) => void, ms: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Buscar endereço...",
  dotColor = "bg-primary",
  icon,
  className = "",
  autoFocus = false,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) { setSuggestions([]); setIsOpen(false); return; }
      setLoading(true);

      const results: AddressSuggestion[] = [];

      // Google Places Autocomplete
      try {
        const gRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&location=${ALTAMIRA_CENTER.lat},${ALTAMIRA_CENTER.lng}&radius=${BIAS_RADIUS}&language=pt-BR&components=country:br&key=${GOOGLE_API_KEY}`
        );
        const gData = await gRes.json();
        if (gData.predictions) {
          // Get details for top 3 predictions
          const detailPromises = gData.predictions.slice(0, 3).map(async (p: any) => {
            try {
              const dRes = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry,types,name,formatted_address&language=pt-BR&key=${GOOGLE_API_KEY}`
              );
              const dData = await dRes.json();
              if (dData.result?.geometry?.location) {
                return {
                  id: `g-${p.place_id}`,
                  name: p.structured_formatting?.main_text || p.description.split(",")[0],
                  address: p.structured_formatting?.secondary_text || p.description,
                  lat: dData.result.geometry.location.lat,
                  lng: dData.result.geometry.location.lng,
                  icon: getIcon(dData.result.types || []),
                  source: "google" as const,
                };
              }
            } catch { /* skip */ }
            return null;
          });
          const gResults = (await Promise.all(detailPromises)).filter(Boolean) as AddressSuggestion[];
          results.push(...gResults);
        }
      } catch (e) {
        console.warn("Google Places error:", e);
      }

      // Mapbox Geocoding as fallback/complement
      try {
        const mRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?proximity=${ALTAMIRA_CENTER.lng},${ALTAMIRA_CENTER.lat}&country=br&language=pt&limit=5&types=address,poi&access_token=${MAPBOX_TOKEN}`
        );
        const mData = await mRes.json();
        if (mData.features) {
          for (const f of mData.features) {
            // Skip if already have similar from Google
            const isDuplicate = results.some(
              (r) => Math.abs(r.lat - f.center[1]) < 0.0005 && Math.abs(r.lng - f.center[0]) < 0.0005
            );
            if (isDuplicate) continue;
            results.push({
              id: `m-${f.id}`,
              name: f.text || f.place_name.split(",")[0],
              address: f.place_name,
              lat: f.center[1],
              lng: f.center[0],
              icon: f.properties?.category ? getIcon([f.properties.category]) : "📍",
              source: "mapbox",
            });
          }
        }
      } catch (e) {
        console.warn("Mapbox geocoding error:", e);
      }

      setSuggestions(results.slice(0, 8));
      setIsOpen(results.length > 0);
      setLoading(false);
    }, 350),
    []
  );

  const handleInputChange = (val: string) => {
    onChange(val);
    fetchSuggestions(val);
  };

  const handleSelect = (s: AddressSuggestion) => {
    onChange(s.name);
    onSelect(s);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode with Mapbox
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?language=pt&limit=1&access_token=${MAPBOX_TOKEN}`
          );
          const data = await res.json();
          const f = data.features?.[0];
          if (f) {
            const suggestion: AddressSuggestion = {
              id: "current-location",
              name: f.text || "Minha localização",
              address: f.place_name || "Localização atual",
              lat: latitude,
              lng: longitude,
              icon: "📍",
              source: "mapbox",
            };
            handleSelect(suggestion);
          }
        } catch { /* fallback */ }
        setLoading(false);
      },
      () => { setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
        {icon || <div className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        {value && !loading && (
          <button onClick={() => { onChange(""); setSuggestions([]); setIsOpen(false); }}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        {!value && !loading && <Search className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border bg-card shadow-lg max-h-64 overflow-y-auto animate-fade-in">
          {/* Use current location */}
          <button
            onClick={handleUseCurrentLocation}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50"
          >
            <Navigation className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary">Usar minha localização</p>
              <p className="text-xs text-muted-foreground">GPS atual</p>
            </div>
          </button>

          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-b-0"
            >
              <span className="text-lg mt-0.5 shrink-0">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.address}</p>
              </div>
              <span className="text-[9px] text-muted-foreground/50 shrink-0 mt-1">
                {s.source === "google" ? "G" : "M"}
              </span>
            </button>
          ))}

          {suggestions.length === 0 && !loading && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhum resultado encontrado
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
