export interface RideRoutePoint {
  lat: number;
  lng: number;
  label: string;
  address?: string | null;
}

const isFiniteCoord = (lat: unknown, lng: unknown) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return Number.isFinite(nLat) && Number.isFinite(nLng) && nLat !== 0 && nLng !== 0;
};

const shortAddress = (value?: string | null) => value?.split(" - ")[0]?.trim() || value || "Ponto da rota";

export const getRideStops = (ride: any): RideRoutePoint[] => {
  const rawStops = Array.isArray(ride?.stops) ? ride.stops : [];
  return rawStops
    .filter((stop) => isFiniteCoord(stop?.lat, stop?.lng))
    .map((stop, index) => ({
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      label: stop.name || shortAddress(stop.address) || `Parada ${index + 1}`,
      address: stop.address || null,
    }));
};

export const getRideDestination = (ride: any): RideRoutePoint | null => {
  if (!isFiniteCoord(ride?.destination_lat, ride?.destination_lng)) return null;
  return {
    lat: Number(ride.destination_lat),
    lng: Number(ride.destination_lng),
    label: shortAddress(ride.destination_address) || "Destino final",
    address: ride.destination_address || null,
  };
};

export const getRideNextTarget = (ride: any, completedStops: number): RideRoutePoint | null => {
  const stops = getRideStops(ride);
  return stops[completedStops] || getRideDestination(ride);
};

export const routePointName = (point: RideRoutePoint | null, fallback = "Destino") => {
  if (!point) return fallback;
  return point.label || shortAddress(point.address) || fallback;
};