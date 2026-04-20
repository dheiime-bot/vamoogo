import { useEffect, useRef, useState } from "react";
import { Check, MapPin, User, Phone, Loader2, Navigation } from "lucide-react";
import AddressAutocompleteField from "@/components/address/AddressAutocompleteField";
import { useCityCache } from "@/hooks/useCityCache";
import type { PlaceDetails } from "@/services/googlePlaces";
import { appLocationFromPlaceDetails, placeDetailsFromAppLocation, type AppLocation } from "@/lib/locationAdapters";
import { toast } from "sonner";

export type OriginType = "gps" | "manual";

export interface OtherPersonInfo {
  name: string;
  phone: string;
}

interface OriginPickerProps {
  selectedOrigin: AppLocation | null;
  onSelectOrigin: (loc: AppLocation, type: OriginType) => void;
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
  const [gpsLoc, setGpsLoc] = useState<AppLocation | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  /** Quando true, mostra o campo de busca manual mesmo no modo "minha corrida". */
  const [manualMode, setManualMode] = useState(false);
  const autoTried = useRef(false);

  // Dispara cache de locais da cidade (1x por cidade) ao detectar GPS
  useCityCache(gpsCoords);

  // Captura GPS ao montar — com fallback de baixa precisão e mensagens claras
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    void tryCaptureGps(/* showSuccessToast */ true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPosition = async (pos: GeolocationPosition, withSuccessToast: boolean) => {
    const { latitude, longitude } = pos.coords;
    for (let i = 0; i < 6; i++) {
      if ((window as any).google?.maps?.Geocoder) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const address = await reverseGeocode(latitude, longitude);
    const loc: AppLocation = {
      id: `gps-${Date.now()}`,
      name: "Minha localização",
      address,
      lat: latitude,
      lng: longitude,
    };
    setGpsLoc(loc);
    setGpsAddress(address);
    setGpsCoords({ lat: latitude, lng: longitude });
    setLoadingGps(false);
    if (!forOtherPerson) onSelectOrigin(loc, "gps");
    if (withSuccessToast) toast.success("Localização detectada");
  };

  const handleGpsError = (err: GeolocationPositionError) => {
    setLoadingGps(false);
    if (err.code === err.PERMISSION_DENIED) {
      toast.error("Permissão de localização negada. Habilite o GPS nas configurações do navegador.", { duration: 6000 });
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      toast.error("Localização indisponível. Verifique se o GPS do dispositivo está ligado.");
    } else if (err.code === err.TIMEOUT) {
      toast.error("Tempo esgotado ao obter localização. Tente novamente.");
    } else {
      toast.error("Não foi possível obter localização");
    }
  };

  // Tenta capturar GPS: alta precisão primeiro, baixa precisão como fallback
  const tryCaptureGps = async (withSuccessToast: boolean) => {
    if (!navigator.geolocation) {
      toast.error("GPS indisponível neste dispositivo");
      return;
    }
    // Verifica permissão proativamente (quando suportado)
    try {
      // @ts-ignore
      const status = await navigator.permissions?.query({ name: "geolocation" });
      if (status?.state === "denied") {
        toast.error("Permissão de localização bloqueada. Habilite nas configurações do navegador.", { duration: 6000 });
        return;
      }
    } catch { /* navegador sem Permissions API — segue normal */ }

    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { void applyPosition(pos, withSuccessToast); },
      (err) => {
        // Fallback: tenta sem alta precisão (mais rápido, funciona em desktops sem GPS dedicado)
        if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(
            (pos) => { void applyPosition(pos, withSuccessToast); },
            handleGpsError,
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
          );
        } else {
          handleGpsError(err);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60 * 1000 }
    );
  };

  // Quando alterna o modo, ajusta a origem
  useEffect(() => {
    if (forOtherPerson) {
      // Limpa origem do GPS — usuário deve buscar endereço da pessoa
      // (não chamamos onSelectOrigin pois precisamos de seleção manual)
    } else if (gpsLoc) {
      // Volta para GPS automaticamente
      onSelectOrigin(gpsLoc, "gps");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forOtherPerson]);

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
        const loc: AppLocation = {
          id: `gps-${Date.now()}`,
          name: "Minha localização",
          address,
          lat: latitude,
          lng: longitude,
        };
        setGpsLoc(loc);
        setGpsAddress(address);
        setGpsCoords({ lat: latitude, lng: longitude });
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

  const selectedManualOrigin = selectedOrigin && !selectedOrigin.id.startsWith("gps-")
    ? placeDetailsFromAppLocation(selectedOrigin)
    : null;

  const handleManualOriginChange = (place: PlaceDetails | null) => {
    if (!place) return;
    onSelectOrigin(appLocationFromPlaceDetails(place), "manual");
  };

  return (
    <div className="space-y-3">
      {/* Origem: GPS (padrão) ou busca de endereço (quando outra pessoa OU modo manual) */}
      {!forOtherPerson && !manualMode ? (
        <div className="flex items-center gap-3 rounded-xl bg-success/5 border border-success/30 p-3">
          <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
            <Navigation className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[10px] font-semibold text-success uppercase tracking-wide">Sua localização</p>
              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="text-[10px] font-medium text-primary hover:underline"
              >
                (clique para inserir o endereço manualmente)
              </button>
            </div>
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
          <AddressAutocompleteField
            label={forOtherPerson ? "Embarque da pessoa" : "Endereço de embarque"}
            placeholder="Digite rua, número ou local popular"
            value={selectedManualOrigin}
            onChange={handleManualOriginChange}
            autoFocus
          />

          {!forOtherPerson && manualMode && (
            <button
              type="button"
              onClick={() => {
                setManualMode(false);
                if (gpsLoc) onSelectOrigin(gpsLoc, "gps");
              }}
              className="text-[11px] font-medium text-primary hover:underline px-1 flex items-center gap-1"
            >
              <Navigation className="h-3 w-3" /> Voltar para minha localização (GPS)
            </button>
          )}

          {forOtherPerson && selectedOrigin && !selectedOrigin.id.startsWith("gps-") && (
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
