import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X, User, Phone, Loader2, Check, Navigation } from "lucide-react";
import { searchLocations, getPopularLocations, getCategoryIcon, getCategoryLabel, CityLocation } from "@/data/cityLocations";
import { useCityCache } from "@/hooks/useCityCache";
import { toast } from "sonner";

export type OriginType = "gps" | "manual";

export interface OtherPersonInfo {
  name: string;
  phone: string;
}

interface OriginPickerProps {
  selectedOrigin: CityLocation | null;
  onSelectOrigin: (loc: CityLocation, type: OriginType) => void;
  forOtherPerson: boolean;
  onToggleOtherPerson: (v: boolean) => void;
  otherPerson: OtherPersonInfo;
  onChangeOtherPerson: (info: OtherPersonInfo) => void;
}

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const g = (window as any).google;
    if (g?.maps?.Geocoder) {
      const geo = new g.maps.Geocoder();
      const res: any = await new Promise((resolve, reject) => {
        geo.geocode({ location: { lat, lng } }, (results: any, status: string) => {
          if (status === "OK" && results?.[0]) resolve(results[0]);
          else reject(status);
        });
      });
      return res.formatted_address || "Localização atual";
    }
  } catch {
    return `Localização atual (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  return `Localização atual (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
};

const validatePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
};

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const OriginPicker = ({
  selectedOrigin, onSelectOrigin,
  forOtherPerson, onToggleOtherPerson,
  otherPerson, onChangeOtherPerson,
}: OriginPickerProps) => {
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsAddress, setGpsAddress] = useState<string>("");
  const [gpsLoc, setGpsLoc] = useState<CityLocation | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityLocation[]>([]);
  const [showResults, setShowResults] = useState(false);
  const autoTried = useRef(false);

  // Dispara cache de locais da cidade (1x por cidade) ao detectar GPS
  useCityCache(gpsCoords);

  // Captura GPS ao montar
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    if (!navigator.geolocation) {
      toast.error("GPS indisponível neste dispositivo");
      return;
    }
    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        for (let i = 0; i < 6; i++) {
          if ((window as any).google?.maps?.Geocoder) break;
          await new Promise((r) => setTimeout(r, 500));
        }
        const address = await reverseGeocode(latitude, longitude);
        const loc: CityLocation = {
          id: `gps-${Date.now()}`,
          name: "Minha localização",
          address,
          lat: latitude,
          lng: longitude,
          category: "other" as any,
          city: "Altamira",
        };
        setGpsLoc(loc);
        setGpsAddress(address);
        setLoadingGps(false);
        // Se ainda não está em modo "outra pessoa", aplica GPS como origem
        if (!forOtherPerson) onSelectOrigin(loc, "gps");
        toast.success("Localização detectada");
      },
      () => {
        setLoadingGps(false);
        toast.error("Não foi possível obter localização");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando alterna o modo, ajusta a origem
  useEffect(() => {
    if (forOtherPerson) {
      // Limpa origem do GPS — usuário deve buscar endereço da pessoa
      // (não chamamos onSelectOrigin pois precisamos de seleção manual)
    } else if (gpsLoc) {
      // Volta para GPS automaticamente
      onSelectOrigin(gpsLoc, "gps");
      setQuery("");
      setShowResults(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forOtherPerson]);

  const handleSearch = (q: string) => {
    setQuery(q);
    setShowResults(true);
    if (q.length >= 2) setResults(searchLocations(q));
    else setResults(getPopularLocations("Altamira", 8));
  };

  const handleSelectManual = (loc: CityLocation) => {
    onSelectOrigin(loc, "manual");
    setQuery(loc.name);
    setShowResults(false);
  };

  const handleRetryGps = () => {
    if (!navigator.geolocation) {
      toast.error("GPS indisponível");
      return;
    }
    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const address = await reverseGeocode(latitude, longitude);
        const loc: CityLocation = {
          id: `gps-${Date.now()}`,
          name: "Minha localização",
          address,
          lat: latitude,
          lng: longitude,
          category: "other" as any,
          city: "Altamira",
        };
        setGpsLoc(loc);
        setGpsAddress(address);
        setLoadingGps(false);
        if (!forOtherPerson) onSelectOrigin(loc, "gps");
      },
      () => {
        setLoadingGps(false);
        toast.error("Não foi possível obter localização");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      {/* Origem: GPS (padrão) ou busca de endereço (quando outra pessoa) */}
      {!forOtherPerson ? (
        <div className="flex items-center gap-3 rounded-xl bg-success/5 border border-success/30 p-3">
          <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
            <Navigation className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-success uppercase tracking-wide">Sua localização</p>
            {loadingGps ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Detectando...
              </p>
            ) : gpsAddress ? (
              <p className="text-sm font-medium truncate">{gpsAddress}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Aguardando GPS</p>
            )}
          </div>
          <button
            onClick={handleRetryGps}
            disabled={loadingGps}
            className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <div className="h-2.5 w-2.5 rounded-full bg-success shrink-0" />
            <input
              type="text"
              placeholder="Endereço de embarque da pessoa"
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                setShowResults(true);
                if (results.length === 0) setResults(getPopularLocations("Altamira", 8));
              }}
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults(getPopularLocations("Altamira", 8)); setShowResults(true); }}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>

          {showResults && (
            <div className="rounded-xl border bg-card shadow-md max-h-52 overflow-y-auto">
              {results.length > 0 ? results.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleSelectManual(loc)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-b-0"
                >
                  <span className="text-lg mt-0.5">{getCategoryIcon(loc.category)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{loc.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{loc.address} • {getCategoryLabel(loc.category)}</p>
                  </div>
                  {selectedOrigin?.id === loc.id && <Check className="h-4 w-4 text-success" />}
                </button>
              )) : <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum local encontrado</p>}
            </div>
          )}

          {selectedOrigin && !selectedOrigin.id.startsWith("gps-") && !showResults && (
            <p className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Endereço da pessoa selecionado
            </p>
          )}
        </div>
      )}

      {/* Toggle: Outra pessoa */}
      <button
        onClick={() => onToggleOtherPerson(!forOtherPerson)}
        className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
          forOtherPerson ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
        }`}
      >
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${forOtherPerson ? "bg-primary/15" : "bg-muted"}`}>
          <User className={`h-4 w-4 ${forOtherPerson ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Pedir para outra pessoa</p>
          <p className="text-[11px] text-muted-foreground">
            {forOtherPerson ? "Informe endereço, nome e telefone" : "A corrida será para outra pessoa"}
          </p>
        </div>
        <div className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${forOtherPerson ? "bg-primary" : "bg-muted-foreground/30"}`}>
          <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow-md transition-transform ${forOtherPerson ? "translate-x-5" : "translate-x-0.5"}`} />
        </div>
      </button>

      {/* Dados do passageiro real */}
      {forOtherPerson && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 animate-fade-in">
          <p className="text-[11px] font-semibold text-primary">Dados do passageiro</p>
          <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2.5 border">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Nome do passageiro"
              value={otherPerson.name}
              onChange={(e) => onChangeOtherPerson({ ...otherPerson, name: e.target.value })}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2.5 border">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              value={otherPerson.phone}
              onChange={(e) => onChangeOtherPerson({ ...otherPerson, phone: formatPhone(e.target.value) })}
              className="flex-1 bg-transparent text-sm outline-none"
              maxLength={15}
            />
            {otherPerson.phone && validatePhone(otherPerson.phone) && (
              <Check className="h-3.5 w-3.5 text-success" />
            )}
          </div>
          {otherPerson.phone && !validatePhone(otherPerson.phone) && (
            <p className="text-[10px] text-destructive px-1">Telefone inválido</p>
          )}
          <p className="text-[10px] text-muted-foreground px-1">
            O motorista verá os dados do passageiro real para localizá-lo
          </p>
        </div>
      )}
    </div>
  );
};

export default OriginPicker;
