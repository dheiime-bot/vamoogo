/**
 * Helper de ícones e categorias para resultados de Google Places.
 * Mapeia os `types` retornados pelo Google em uma categoria visual.
 */
import {
  Building2,
  ShoppingCart,
  Utensils,
  Pill,
  Hospital,
  Fuel,
  Landmark,
  GraduationCap,
  Church,
  Trees,
  Dumbbell,
  Hotel,
  Bus,
  Plane,
  Store,
  Sparkles,
  MapPin,
  Home,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export type PlaceCategory =
  | "supermarket"
  | "mall"
  | "food"
  | "pharmacy"
  | "health"
  | "gas_station"
  | "bank"
  | "education"
  | "religion"
  | "leisure"
  | "sport"
  | "lodging"
  | "public"
  | "transport"
  | "airport"
  | "store"
  | "beauty"
  | "address"
  | "other";

export interface CategoryInfo {
  category: PlaceCategory;
  icon: LucideIcon;
  /** classe Tailwind para cor do ícone */
  color: string;
  /** classe de fundo (suave) */
  bg: string;
  label: string;
}

const REGISTRY: Record<PlaceCategory, Omit<CategoryInfo, "category">> = {
  supermarket: { icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Supermercado" },
  mall:        { icon: Store,        color: "text-violet-600",  bg: "bg-violet-500/10",  label: "Shopping" },
  food:        { icon: Utensils,     color: "text-orange-600",  bg: "bg-orange-500/10",  label: "Restaurante" },
  pharmacy:    { icon: Pill,         color: "text-red-600",     bg: "bg-red-500/10",     label: "Farmácia" },
  health:      { icon: Hospital,     color: "text-rose-600",    bg: "bg-rose-500/10",    label: "Saúde" },
  gas_station: { icon: Fuel,         color: "text-amber-600",   bg: "bg-amber-500/10",   label: "Posto" },
  bank:        { icon: Landmark,     color: "text-sky-600",     bg: "bg-sky-500/10",     label: "Banco" },
  education:   { icon: GraduationCap,color: "text-blue-600",    bg: "bg-blue-500/10",    label: "Educação" },
  religion:    { icon: Church,       color: "text-indigo-600",  bg: "bg-indigo-500/10",  label: "Religião" },
  leisure:     { icon: Trees,        color: "text-green-600",   bg: "bg-green-500/10",   label: "Lazer" },
  sport:       { icon: Dumbbell,     color: "text-teal-600",    bg: "bg-teal-500/10",    label: "Esporte" },
  lodging:     { icon: Hotel,        color: "text-pink-600",    bg: "bg-pink-500/10",    label: "Hospedagem" },
  public:      { icon: Briefcase,    color: "text-slate-600",   bg: "bg-slate-500/10",   label: "Serviço público" },
  transport:   { icon: Bus,          color: "text-cyan-600",    bg: "bg-cyan-500/10",    label: "Transporte" },
  airport:     { icon: Plane,        color: "text-cyan-700",    bg: "bg-cyan-500/10",    label: "Aeroporto" },
  store:       { icon: Store,        color: "text-fuchsia-600", bg: "bg-fuchsia-500/10", label: "Loja" },
  beauty:      { icon: Sparkles,     color: "text-pink-500",    bg: "bg-pink-500/10",    label: "Beleza" },
  address:     { icon: Home,         color: "text-muted-foreground", bg: "bg-muted",     label: "Endereço" },
  other:       { icon: MapPin,       color: "text-muted-foreground", bg: "bg-muted",     label: "Local" },
};

/** Mapeia os types do Google em uma categoria. Aceita `category` direto também (do cache local). */
export function classifyPlace(types: string[] | undefined, hint?: string | null): CategoryInfo {
  // dica explícita (cache local já vem com category)
  if (hint && hint in REGISTRY) {
    return { category: hint as PlaceCategory, ...REGISTRY[hint as PlaceCategory] };
  }
  const t = new Set((types ?? []).map((s) => s.toLowerCase()));

  const pick = (cat: PlaceCategory): CategoryInfo => ({ category: cat, ...REGISTRY[cat] });

  // Endereços puros (sem POI)
  if (t.has("street_address") || t.has("route") || t.has("premise") || t.has("subpremise") ||
      t.has("plus_code") || t.has("geocode") || t.has("postal_code")) {
    // Mas se também é "establishment" cai no resto da classificação
    if (!t.has("establishment") && !t.has("point_of_interest")) return pick("address");
  }

  if (t.has("supermarket") || t.has("grocery_or_supermarket") || t.has("convenience_store")) return pick("supermarket");
  if (t.has("shopping_mall") || t.has("department_store")) return pick("mall");
  if (t.has("restaurant") || t.has("cafe") || t.has("bakery") || t.has("bar") ||
      t.has("meal_takeaway") || t.has("meal_delivery") || t.has("food")) return pick("food");
  if (t.has("pharmacy") || t.has("drugstore")) return pick("pharmacy");
  if (t.has("hospital") || t.has("doctor") || t.has("dentist") || t.has("veterinary_care") ||
      t.has("physiotherapist") || t.has("health")) return pick("health");
  if (t.has("gas_station")) return pick("gas_station");
  if (t.has("bank") || t.has("atm") || t.has("finance")) return pick("bank");
  if (t.has("school") || t.has("university") || t.has("library") ||
      t.has("primary_school") || t.has("secondary_school")) return pick("education");
  if (t.has("church") || t.has("mosque") || t.has("hindu_temple") || t.has("synagogue") ||
      t.has("place_of_worship")) return pick("religion");
  if (t.has("park") || t.has("tourist_attraction") || t.has("museum") || t.has("zoo") ||
      t.has("amusement_park") || t.has("aquarium")) return pick("leisure");
  if (t.has("gym") || t.has("stadium") || t.has("spa") || t.has("bowling_alley")) return pick("sport");
  if (t.has("lodging") || t.has("hotel")) return pick("lodging");
  if (t.has("airport")) return pick("airport");
  if (t.has("bus_station") || t.has("transit_station") || t.has("taxi_stand") ||
      t.has("subway_station") || t.has("train_station") || t.has("light_rail_station")) return pick("transport");
  if (t.has("beauty_salon") || t.has("hair_care") || t.has("nail_salon")) return pick("beauty");
  if (t.has("police") || t.has("fire_station") || t.has("city_hall") ||
      t.has("courthouse") || t.has("post_office") || t.has("local_government_office") ||
      t.has("embassy")) return pick("public");
  if (t.has("clothing_store") || t.has("shoe_store") || t.has("electronics_store") ||
      t.has("furniture_store") || t.has("hardware_store") || t.has("home_goods_store") ||
      t.has("pet_store") || t.has("book_store") || t.has("florist") || t.has("jewelry_store") ||
      t.has("bicycle_store") || t.has("store")) return pick("store");
  if (t.has("establishment") || t.has("point_of_interest")) return pick("other");

  return pick("other");
}
