import type { PlaceDetails } from "@/services/googlePlaces";

export interface AppLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export function appLocationFromPlaceDetails(place: PlaceDetails): AppLocation {
  return {
    id: place.placeId,
    name: place.address || place.formattedAddress,
    address: place.formattedAddress || place.address,
    lat: place.lat,
    lng: place.lng,
  };
}

export function placeDetailsFromAppLocation(location: AppLocation): PlaceDetails {
  return {
    placeId: location.id,
    address: location.name,
    formattedAddress: location.address,
    lat: location.lat,
    lng: location.lng,
  };
}