import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X, User, Phone, Loader2, Check, Navigation } from "lucide-react";
import { searchLocations, getPopularLocations, getCategoryIcon, getCategoryLabel, CityLocation } from "@/data/cityLocations";
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityLocation[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [edited, setEdited] = useState(false);
  const autoTried = useRef(false);

  // Captura GPS automaticamente uma vez ao montar
  useEffect(() => {
    if (autoTried.current || selectedOrigin) return;
    autoTried.current = true;
    if (!navigator.geolocation) return;
    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Espera o Google Maps carregar (até 3s) para obter endereço
        let address = "";
        for (let i = 0; i < 6; i++) {
          if ((window as any).google?.maps?.Geocoder) break;
          await new Promise((r) => setTimeout(r, 500));
        }
        address = await reverseGeocode(latitude, longitude);
        const loc: CityLocation = {
          id: `gps-${Date.now()}`,
          name: "Minha localização",
          address,
          lat: latitude,
          lng: longitude,
          category: "other" as any,
          city: "Altamira",
        };
        onSelectOrigin(loc, "gps");
        setQuery(address);
        setLoadingGps(false);
        toast.success("Localização detectada");
      },
      () => {
        setLoadingGps(false);
        toast.info("Digite o endereço de embarque");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [selectedOrigin, onSelectOrigin]);

  // Sincroniza query com endereço selecionado quando vem do GPS (e usuário ainda não editou)
  useEffect(() => {
    if (selectedOrigin && !edited && selectedOrigin.id.startsWith("gps-")) {
      setQuery(selectedOrigin.address);
    }
  }, [selectedOrigin, edited]);

  const handleSearch = (q: string) => {
    setQuery(q);
    setEdited(true);
    setShowResults(true);
    if (q.length >= 2) setResults(searchLocations(q));
    else setResults(getPopularLocations("Altamira", 8));
  };

  const handleSelectManual = (loc: CityLocation) => {
    onSelectOrigin(loc, "manual");
    setQuery(loc.name);
    setShowResults(false);
  };

  const handleUseGps = () => {
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
        onSelectOrigin(loc, "gps");
        setQuery(address);
        setEdited(false);
        setLoadingGps(false);
        setShowResults(false);
      },
      () => {
        setLoadingGps(false);
        toast.error("Não foi possível obter localização");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const isManual = !!selectedOrigin && !selectedOrigin.id.startsWith("gps-");

  return (
    <div className="space-y-3">
      {/* Campo único de origem com autopreenchimento */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
          <div className="h-2.5 w-2.5 rounded-full bg-success shrink-0" />
          {loadingGps && !selectedOrigin ? (
            <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Detectando sua localização...
            </div>
          ) : (
            <input
              type="text"
              placeholder="Endereço de embarque"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                setShowResults(true);
                if (results.length === 0) setResults(getPopularLocations("Altamira", 8));
              }}
            />
          )}
          {query && !loadingGps && (
            <button onClick={() => { setQuery(""); setEdited(true); setResults(getPopularLocations("Altamira", 8)); setShowResults(true); }}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={handleUseGps}
            disabled={loadingGps}
            title="Usar minha localização"
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 transition-colors disabled:opacity-50"
          >
            {loadingGps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
          </button>
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

        {selectedOrigin && !showResults && (
          <p className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {selectedOrigin.id.startsWith("gps-") ? "GPS detectado — você pode editar" : "Endereço selecionado"}
          </p>
        )}
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            setShowResults(true);
            setEdited(true);
            if (results.length === 0) setResults(getPopularLocations("Altamira", 8));
          }}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">Outro endereço</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Buscar local</p>
          </div>
        </button>
        <button
          onClick={() => onToggleOtherPerson(!forOtherPerson)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
            forOtherPerson ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${forOtherPerson ? "bg-primary/15" : "bg-muted"}`}>
            <User className={`h-4 w-4 ${forOtherPerson ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">Outra pessoa</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{forOtherPerson ? "Ativado" : "Para terceiros"}</p>
          </div>
        </button>
      </div>

      {/* Formulário: dados do passageiro real */}
      {forOtherPerson && (
        <div className={`rounded-xl border p-3 transition-colors ${forOtherPerson ? "border-primary bg-primary/5" : "border-border"}`}>
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${forOtherPerson ? "bg-primary/15" : "bg-muted"}`}>
                <User className={`h-4 w-4 ${forOtherPerson ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold">Pedir para outra pessoa</p>
                <p className="text-[11px] text-muted-foreground">A corrida será para outra pessoa</p>
              </div>
            </div>
            <div
              role="switch"
              aria-checked={forOtherPerson}
              onClick={() => onToggleOtherPerson(!forOtherPerson)}
              className={`relative h-6 w-11 rounded-full transition-colors ${forOtherPerson ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow-md transition-transform ${forOtherPerson ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </div>
          </label>

          {forOtherPerson && (
            <div className="mt-3 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Nome do passageiro"
                  value={otherPerson.name}
                  onChange={(e) => onChangeOtherPerson({ ...otherPerson, name: e.target.value })}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5">
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
                O motorista verá os dados do passageiro real
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OriginPicker;
