import { useState, useEffect } from "react";
import { MapPin, Navigation, Search, X, User, Phone, Loader2, Check } from "lucide-react";
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
  const [mode, setMode] = useState<OriginType>("gps");
  const [loadingGps, setLoadingGps] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityLocation[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (mode === "manual" && results.length === 0) {
      setResults(getPopularLocations("Altamira", 6));
    }
  }, [mode]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Seu dispositivo não suporta GPS. Escolha um endereço.");
      setMode("manual");
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
        setLoadingGps(false);
        toast.success("Localização capturada!");
      },
      (err) => {
        setLoadingGps(false);
        toast.error("Não foi possível obter sua localização. Escolha manualmente.");
        setMode("manual");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        <button
          onClick={() => setMode("gps")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
            mode === "gps" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Navigation className="h-3.5 w-3.5" /> Minha localização
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
            mode === "manual" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Search className="h-3.5 w-3.5" /> Outro endereço
        </button>
      </div>

      {mode === "gps" && (
        <div className="space-y-2">
          {selectedOrigin && selectedOrigin.id.startsWith("gps-") ? (
            <div className="flex items-start gap-3 rounded-xl border-2 border-success bg-success/5 p-3">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-success font-semibold flex items-center gap-1">
                  <Check className="h-3 w-3" /> GPS detectado
                </p>
                <p className="text-sm font-medium truncate">{selectedOrigin.address}</p>
              </div>
              <button onClick={handleUseMyLocation} className="text-xs text-primary font-semibold">
                Atualizar
              </button>
            </div>
          ) : (
            <button
              onClick={handleUseMyLocation}
              disabled={loadingGps}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 border-2 border-dashed border-primary/40 py-4 text-sm font-bold text-primary hover:bg-primary/15 transition-colors disabled:opacity-50"
            >
              {loadingGps ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {loadingGps ? "Obtendo localização..." : "Usar minha localização atual"}
            </button>
          )}
          <p className="text-[10px] text-muted-foreground text-center">
            Você pode ajustar arrastando o mapa após confirmar
          </p>
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <MapPin className="h-4 w-4 text-success shrink-0" />
            <input
              type="text"
              placeholder="Digite o endereço de embarque"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setShowResults(true)}
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults(getPopularLocations("Altamira", 8)); }}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
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
            <div className="flex items-start gap-3 rounded-xl border-2 border-success bg-success/5 p-3">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-success font-semibold">Endereço selecionado</p>
                <p className="text-sm font-medium truncate">{selectedOrigin.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{selectedOrigin.address}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
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
