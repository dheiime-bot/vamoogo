/**
 * GoogleMap — substituto direto do antigo MapboxMap.
 * Usa @vis.gl/react-google-maps + Google Directions Service via fetch.
 * Mantém a mesma API (props) para evitar refatoração nas páginas.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Loader2 } from "lucide-react";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";

interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
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
const MAP_ID = "vamoogo-map"; // necessário para AdvancedMarker

const ColoredPin = ({ color, label }: { color: string; label?: string }) => (
  <div className="relative" title={label}>
    <div
      className="h-7 w-7 rounded-full border-[3px] border-white shadow-lg"
      style={{ backgroundColor: color }}
    />
  </div>
);

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
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !routesLib) return;
    let cancelled = false;

    const fetchRoute = async () => {
      try {
        const ds = new routesLib.DirectionsService();
        const res = await ds.route({
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          waypoints: stops.map((s) => ({ location: { lat: s.lat, lng: s.lng } })),
          travelMode: "DRIVING" as any,
        });
        if (cancelled) return;
        const path = res.routes[0]?.overview_path;
        if (!path) return;

        polylineRef.current?.setMap(null);
        const g = (window as any).google;
        polylineRef.current = new g.maps.Polyline({
          path,
          strokeColor: "#1E90FF",
          strokeOpacity: 0.85,
          strokeWeight: 5,
          map,
        });

        const bounds = new g.maps.LatLngBounds();
        path.forEach((p: any) => bounds.extend(p));
        map.fitBounds(bounds, 60);
      } catch (e) {
        console.warn("Directions error:", e);
      }
    };

    fetchRoute();
    return () => {
      cancelled = true;
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [map, routesLib, origin.lat, origin.lng, destination.lat, destination.lng, stops]);

  return null;
};

const FitToPoints = ({ points }: { points: MapPoint[] }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.panTo({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(14);
      return;
    }
    const g = (window as any).google;
    if (!g) return;
    const bounds = new g.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 60);
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

const GoogleMapInner = ({
  origin,
  destination,
  driverLocation,
  stops = [],
  onMapClick,
  showCenterPin,
  onCenterChange,
  interactive = true,
  showRoute = true,
  trackUserLocation = false,
}: Omit<GoogleMapProps, "className">) => {
  const [userLoc, setUserLoc] = useState<MapPoint | null>(null);

  useEffect(() => {
    if (!trackUserLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [trackUserLocation]);

  const points = useMemo(
    () => [origin, destination, driverLocation, ...stops, userLoc].filter(Boolean) as MapPoint[],
    [origin, destination, driverLocation, stops, userLoc]
  );

  return (
    <Map
      defaultCenter={ALTAMIRA_CENTER}
      defaultZoom={13}
      mapId={MAP_ID}
      gestureHandling={interactive ? "greedy" : "none"}
      disableDefaultUI={!interactive}
      clickableIcons={false}
      style={{ width: "100%", height: "100%" }}
    >
      {origin && (
        <AdvancedMarker position={{ lat: origin.lat, lng: origin.lng }}>
          <ColoredPin color="#00C853" label={origin.label || "Origem"} />
        </AdvancedMarker>
      )}
      {destination && (
        <AdvancedMarker position={{ lat: destination.lat, lng: destination.lng }}>
          <ColoredPin color="#FF1744" label={destination.label || "Destino"} />
        </AdvancedMarker>
      )}
      {stops.map((s, i) => (
        <AdvancedMarker key={i} position={{ lat: s.lat, lng: s.lng }}>
          <ColoredPin color="#FFB300" label={s.label || `Parada ${i + 1}`} />
        </AdvancedMarker>
      ))}
      {driverLocation && (
        <AdvancedMarker position={{ lat: driverLocation.lat, lng: driverLocation.lng }}>
          <ColoredPin color="#1E90FF" label="Motorista" />
        </AdvancedMarker>
      )}
      {userLoc && !origin && (
        <AdvancedMarker position={{ lat: userLoc.lat, lng: userLoc.lng }}>
          <ColoredPin color="#1E90FF" label="Você" />
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
    <div className={`${className} relative rounded-2xl overflow-hidden`}>
      <APIProvider apiKey={key} libraries={["places"]} language="pt-BR" region="BR">
        <GoogleMapInner {...rest} />
      </APIProvider>
      {rest.showCenterPin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-primary drop-shadow-lg" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default GoogleMap;
