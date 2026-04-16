/**
 * GoogleMap — mapa premium estilo Uber/99.
 * - Carrinho animado para motorista (gira pelo heading)
 * - Bonequinho para passageiro/origem
 * - Pino de destino destacado
 * - Movimento interpolado suave (sem teleporte)
 * - Rota com gradiente azul
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Loader2, LocateFixed } from "lucide-react";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";

interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  heading?: number;
}

interface GoogleMapProps {
  className?: string;
  origin?: MapPoint | null;
  destination?: MapPoint | null;
  driverLocation?: MapPoint | null;
  stops?: MapPoint[];
  onMapClick?: (lat: number, lng: number) => void;
  showCenterPin?: boolean;
  onCenterChange?: (lat: number, lng: number) => void;
  interactive?: boolean;
  showRoute?: boolean;
  trackUserLocation?: boolean;
}

const ALTAMIRA_CENTER = { lat: -3.2036, lng: -52.2108 };
const MAP_ID = "vamoogo-map";

// Estilo de mapa moderno (claro, limpo, premium)
const MODERN_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f7f8fa" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6573" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8eef7" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#dbe3f0" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe2ff" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5b8def" }] },
];

/* ---------- Markers premium ---------- */

const CarMarker = ({ heading = 0 }: { heading?: number }) => (
  <div
    className="relative drop-shadow-xl"
    style={{
      transform: `rotate(${heading}deg)`,
      transition: "transform 600ms ease-out",
      width: 44,
      height: 44,
    }}
    title="Motorista"
  >
    <svg viewBox="0 0 64 64" width="44" height="44">
      <defs>
        <radialGradient id="carShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <linearGradient id="carBody" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>
      </defs>
      {/* sombra */}
      <ellipse cx="32" cy="56" rx="18" ry="4" fill="url(#carShadow)" />
      {/* corpo */}
      <g>
        {/* base */}
        <rect x="14" y="22" width="36" height="26" rx="9" fill="url(#carBody)" />
        {/* teto / cabine */}
        <path
          d="M20 22 L26 12 H38 L44 22 Z"
          fill="#111827"
          stroke="#0b1220"
          strokeWidth="1"
        />
        {/* parabrisa */}
        <path
          d="M22 22 L27 14 H37 L42 22 Z"
          fill="#7dd3fc"
          opacity="0.85"
        />
        {/* faróis */}
        <circle cx="18" cy="20" r="2.2" fill="#fde68a" />
        <circle cx="46" cy="20" r="2.2" fill="#fde68a" />
        {/* rodas */}
        <circle cx="20" cy="48" r="4.5" fill="#0b1220" stroke="#374151" strokeWidth="1.2" />
        <circle cx="44" cy="48" r="4.5" fill="#0b1220" stroke="#374151" strokeWidth="1.2" />
        {/* logo */}
        <circle cx="32" cy="35" r="3" fill="#3b82f6" />
      </g>
    </svg>
  </div>
);

const PassengerMarker = () => (
  <div className="relative" title="Passageiro">
    <div
      className="absolute inset-0 rounded-full bg-primary/30 animate-ping"
      style={{ width: 44, height: 44, top: -2, left: -2 }}
    />
    <svg viewBox="0 0 48 48" width="40" height="40" className="relative drop-shadow-lg">
      <defs>
        <linearGradient id="pBg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="22" r="18" fill="url(#pBg)" stroke="#fff" strokeWidth="3" />
      {/* cabeça */}
      <circle cx="24" cy="17" r="4.5" fill="#fff" />
      {/* corpo */}
      <path
        d="M14 30 c0-5 4.5-8 10-8 s10 3 10 8 v2 H14 z"
        fill="#fff"
      />
      {/* ponta inferior do pin */}
      <path d="M24 44 L18 36 H30 Z" fill="#1d4ed8" />
    </svg>
  </div>
);

const DestinationMarker = () => (
  <div className="relative drop-shadow-lg" title="Destino">
    <svg viewBox="0 0 48 48" width="38" height="38">
      <defs>
        <linearGradient id="dBg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>
      <path
        d="M24 2 C14 2 7 9 7 19 c0 12 17 27 17 27 s17-15 17-27 C41 9 34 2 24 2 z"
        fill="url(#dBg)"
        stroke="#fff"
        strokeWidth="2.5"
      />
      <circle cx="24" cy="19" r="6" fill="#fff" />
    </svg>
  </div>
);

const StopMarker = ({ index }: { index: number }) => (
  <div className="relative drop-shadow-md" title={`Parada ${index + 1}`}>
    <div
      className="h-7 w-7 rounded-full bg-amber-500 border-[3px] border-white flex items-center justify-center text-white text-xs font-bold"
    >
      {index + 1}
    </div>
  </div>
);

/* ---------- Interpolação de posição (movimento suave) ---------- */

const useInterpolatedPosition = (target: MapPoint | null | undefined) => {
  const [pos, setPos] = useState<MapPoint | null>(target ?? null);
  const fromRef = useRef<MapPoint | null>(target ?? null);
  const startTsRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) {
      setPos(null);
      fromRef.current = null;
      return;
    }
    if (!fromRef.current) {
      fromRef.current = target;
      setPos(target);
      return;
    }
    const from = pos || fromRef.current;
    const to = target;
    const duration = 900; // ms
    startTsRef.current = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTsRef.current) / duration);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
      setPos({
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
        heading: to.heading,
        label: to.label,
      });
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, target?.heading]);

  return pos;
};

/* ---------- Rota / camadas ---------- */

// Paleta de cores para trechos (cíclica). Cada trecho ganha uma cor distinta.
// Exportada para que outros componentes (ex: breakdown de preço) usem as MESMAS cores.
export const LEG_COLORS = [
  "#3b82f6", // azul
  "#10b981", // verde
  "#f59e0b", // âmbar
  "#ef4444", // vermelho
  "#8b5cf6", // violeta
  "#ec4899", // rosa
  "#06b6d4", // ciano
];

const RouteLayer = ({
  origin,
  destination,
  stops,
}: {
  origin: MapPoint;
  destination: MapPoint;
  stops: MapPoint[];
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const polylinesRef = useRef<any[]>([]);
  const halosRef = useRef<any[]>([]);

  // Chave estável para deps (evita re-render por nova referência de array)
  const stopsKey = stops.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    if (!map || !routesLib) return;
    let cancelled = false;

    const clearAll = () => {
      polylinesRef.current.forEach((p) => p?.setMap(null));
      halosRef.current.forEach((p) => p?.setMap(null));
      polylinesRef.current = [];
      halosRef.current = [];
    };

    const fetchRoute = async () => {
      try {
        const g = (window as any).google;
        const ds = new routesLib.DirectionsService();

        // Sequência completa: origem -> paradas -> destino
        const sequence: MapPoint[] = [origin, ...stops, destination];
        clearAll();
        const bounds = new g.maps.LatLngBounds();

        // Para cada trecho, busca rota independente e desenha com cor própria
        for (let i = 0; i < sequence.length - 1; i++) {
          const a = sequence[i];
          const b = sequence[i + 1];
          try {
            const res = await ds.route({
              origin: { lat: a.lat, lng: a.lng },
              destination: { lat: b.lat, lng: b.lng },
              travelMode: "DRIVING" as any,
            });
            if (cancelled) return;
            const path = res.routes[0]?.overview_path;
            if (!path) continue;

            const color = LEG_COLORS[i % LEG_COLORS.length];

            // halo escuro (largura maior, baixa opacidade)
            const halo = new g.maps.Polyline({
              path,
              strokeColor: "#0b1220",
              strokeOpacity: 0.22,
              strokeWeight: 10,
              map,
              zIndex: 1,
            });
            // linha principal colorida
            const line = new g.maps.Polyline({
              path,
              strokeColor: color,
              strokeOpacity: 1,
              strokeWeight: 5,
              map,
              zIndex: 2,
            });

            halosRef.current.push(halo);
            polylinesRef.current.push(line);
            path.forEach((p: any) => bounds.extend(p));
          } catch (err) {
            console.warn(`Directions trecho ${i} falhou:`, err);
          }
        }

        if (!cancelled && !bounds.isEmpty()) {
          map.fitBounds(bounds, 80);
        }
      } catch (e) {
        console.warn("Directions error:", e);
      }
    };

    fetchRoute();
    return () => {
      cancelled = true;
      clearAll();
    };
  }, [map, routesLib, origin.lat, origin.lng, destination.lat, destination.lng, stopsKey]);

  return null;
};

const FitToPoints = ({ points }: { points: MapPoint[] }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.panTo({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(15);
      return;
    }
    const g = (window as any).google;
    if (!g) return;
    const bounds = new g.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 80);
  }, [map, points]);
  return null;
};

const ClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (e: any) => {
      if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => listener.remove();
  }, [map, onMapClick]);
  return null;
};

const CenterTracker = ({
  onCenterChange,
}: {
  onCenterChange: (lat: number, lng: number) => void;
}) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", () => {
      const c = map.getCenter();
      if (c) onCenterChange(c.lat(), c.lng());
    });
    return () => listener.remove();
  }, [map, onCenterChange]);
  return null;
};

const MapStyler = () => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    try {
      (map as any).setOptions({ styles: MODERN_MAP_STYLE });
    } catch {
      /* noop — quando mapId define estilo, isto é ignorado */
    }
  }, [map]);
  return null;
};

/** Botão flutuante para recentralizar o mapa em um ponto preferido. */
const RecenterButton = ({ target }: { target: MapPoint | null }) => {
  const map = useMap();

  const handleClick = () => {
    if (!map) return;
    if (target) {
      map.panTo({ lat: target.lat, lng: target.lng });
      map.setZoom(16);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          map.setZoom(16);
        },
        () => {
          map.panTo(ALTAMIRA_CENTER);
          map.setZoom(14);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Recentralizar mapa"
      className="absolute bottom-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-border hover:bg-muted transition-colors active:scale-95"
    >
      <LocateFixed className="h-5 w-5 text-primary" />
    </button>
  );
};

/* ---------- Mapa principal ---------- */

const GoogleMapInner = ({
  origin,
  destination,
  driverLocation,
  stops = [],
  onMapClick,
  onCenterChange,
  interactive = true,
  showRoute = true,
  trackUserLocation = false,
}: Omit<GoogleMapProps, "className" | "showCenterPin">) => {
  const [userLoc, setUserLoc] = useState<MapPoint | null>(null);
  const animatedDriver = useInterpolatedPosition(driverLocation || null);

  useEffect(() => {
    if (!trackUserLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [trackUserLocation]);

  const points = useMemo(
    () => [origin, destination, animatedDriver, ...stops, userLoc].filter(Boolean) as MapPoint[],
    [origin, destination, animatedDriver, stops, userLoc]
  );

  return (
    <Map
      defaultCenter={ALTAMIRA_CENTER}
      defaultZoom={14}
      mapId={MAP_ID}
      gestureHandling={interactive ? "greedy" : "none"}
      disableDefaultUI={!interactive}
      clickableIcons={false}
      style={{ width: "100%", height: "100%" }}
    >
      <MapStyler />

      {origin && (
        <AdvancedMarker position={{ lat: origin.lat, lng: origin.lng }}>
          <PassengerMarker />
        </AdvancedMarker>
      )}
      {destination && (
        <AdvancedMarker position={{ lat: destination.lat, lng: destination.lng }}>
          <DestinationMarker />
        </AdvancedMarker>
      )}
      {stops.map((s, i) => (
        <AdvancedMarker key={i} position={{ lat: s.lat, lng: s.lng }}>
          <StopMarker index={i} />
        </AdvancedMarker>
      ))}
      {animatedDriver && (
        <AdvancedMarker position={{ lat: animatedDriver.lat, lng: animatedDriver.lng }}>
          <CarMarker heading={animatedDriver.heading || 0} />
        </AdvancedMarker>
      )}
      {userLoc && !origin && (
        <AdvancedMarker position={{ lat: userLoc.lat, lng: userLoc.lng }}>
          <PassengerMarker />
        </AdvancedMarker>
      )}

      {showRoute && origin && destination && (
        <RouteLayer origin={origin} destination={destination} stops={stops} />
      )}
      {!showRoute && <FitToPoints points={points} />}
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}
      {onCenterChange && <CenterTracker onCenterChange={onCenterChange} />}
    </Map>
  );
};

const GoogleMap = ({ className = "h-[300px]", ...rest }: GoogleMapProps) => {
  const { key, loading } = useGoogleMapsKey();

  if (loading || !key) {
    return (
      <div className={`${className} rounded-2xl bg-muted flex items-center justify-center`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`${className} relative rounded-2xl overflow-hidden shadow-sm`}>
      <APIProvider apiKey={key} libraries={["places"]} language="pt-BR" region="BR">
        <GoogleMapInner {...rest} />
      </APIProvider>
      {rest.showCenterPin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
          <svg viewBox="0 0 24 24" className="w-9 h-9 text-primary drop-shadow-xl" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default GoogleMap;
