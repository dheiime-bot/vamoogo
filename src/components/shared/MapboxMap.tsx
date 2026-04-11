import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { Loader2 } from "lucide-react";

interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface MapboxMapProps {
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

const ALTAMIRA_CENTER: [number, number] = [-52.2108, -3.2036];

const MapboxMap = ({
  className = "h-[300px]",
  origin,
  destination,
  driverLocation,
  stops = [],
  onMapClick,
  showCenterPin = false,
  onCenterChange,
  interactive = true,
  showRoute = true,
  trackUserLocation = false,
}: MapboxMapProps) => {
  const { token, loading } = useMapboxToken();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  const addMarker = useCallback(
    (point: MapPoint, color: string, label?: string) => {
      if (!map.current) return;
      const el = document.createElement("div");
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(map.current!);

      if (label) {
        marker.setPopup(new mapboxgl.Popup({ offset: 20 }).setText(label));
      }
      markersRef.current.push(marker);
    },
    []
  );

  // Initialize map
  useEffect(() => {
    if (!token || !mapContainer.current || map.current) return;

    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: ALTAMIRA_CENTER,
      zoom: 13,
      interactive,
      locale: {
        "NavigationControl.ZoomIn": "Aproximar",
        "NavigationControl.ZoomOut": "Afastar",
      },
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    if (trackUserLocation) {
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      });
      map.current.addControl(geolocate);
      geolocateRef.current = geolocate;
      map.current.on("load", () => geolocate.trigger());
    }

    if (onMapClick) {
      map.current.on("click", (e) => {
        onMapClick(e.lngLat.lat, e.lngLat.lng);
      });
    }

    if (onCenterChange) {
      map.current.on("moveend", () => {
        const center = map.current!.getCenter();
        onCenterChange(center.lat, center.lng);
      });
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [token]);

  // Update markers and route
  useEffect(() => {
    if (!map.current || !token) return;

    clearMarkers();

    if (origin) addMarker(origin, "#00C853", origin.label || "Origem");
    if (destination) addMarker(destination, "#FF1744", destination.label || "Destino");
    stops.forEach((s, i) => addMarker(s, "#FFB300", s.label || `Parada ${i + 1}`));
    if (driverLocation) addMarker(driverLocation, "#1E90FF", "Motorista");

    // Fit bounds
    const points = [origin, destination, driverLocation, ...stops].filter(Boolean) as MapPoint[];
    if (points.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    } else if (points.length === 1) {
      map.current.flyTo({ center: [points[0].lng, points[0].lat], zoom: 14 });
    }

    // Draw route
    if (showRoute && origin && destination) {
      drawRoute(origin, destination, stops);
    }
  }, [origin, destination, driverLocation, stops, token]);

  const drawRoute = async (orig: MapPoint, dest: MapPoint, waypoints: MapPoint[]) => {
    if (!map.current || !token) return;

    const coords = [
      `${orig.lng},${orig.lat}`,
      ...waypoints.map((w) => `${w.lng},${w.lat}`),
      `${dest.lng},${dest.lat}`,
    ].join(";");

    try {
      const res = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`
      );
      const data = await res.json();
      if (!data.routes?.[0]) return;

      const route = data.routes[0].geometry;

      if (map.current.getSource("route")) {
        (map.current.getSource("route") as mapboxgl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: route,
        });
      } else {
        map.current.addSource("route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route },
        });
        map.current.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#1E90FF",
            "line-width": 5,
            "line-opacity": 0.8,
          },
        });
      }
    } catch (err) {
      console.error("Route fetch error:", err);
    }
  };

  if (loading) {
    return (
      <div className={`${className} rounded-2xl bg-muted flex items-center justify-center`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`${className} relative rounded-2xl overflow-hidden`}>
      <div ref={mapContainer} className="w-full h-full" />
      {showCenterPin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-primary drop-shadow-lg" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapboxMap;
