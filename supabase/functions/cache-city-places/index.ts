// Edge function: cache-city-places
// Varre o Google Places (Nearby Search) em torno de uma coordenada para vários
// types e faz upsert na tabela `places`. Idempotente — pode rodar várias vezes,
// mas usa city_sync_log para evitar re-cachear cidades já indexadas recentemente.
//
// POST body: { lat: number, lng: number, radius?: number, force?: boolean, cityKey?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Categorias do Google Places que queremos indexar (cobertura ampla)
const PLACE_TYPES = [
  "supermarket", "grocery_or_supermarket", "convenience_store", "shopping_mall",
  "restaurant", "cafe", "bakery", "bar", "meal_takeaway", "food",
  "pharmacy", "hospital", "doctor", "dentist", "veterinary_care",
  "gas_station", "car_repair", "car_wash", "car_dealer",
  "bank", "atm", "post_office",
  "school", "university", "library",
  "church", "mosque", "hindu_temple", "synagogue",
  "park", "tourist_attraction", "stadium", "gym",
  "lodging", "police", "fire_station", "city_hall", "courthouse",
  "bus_station", "transit_station", "taxi_stand", "airport",
  "clothing_store", "shoe_store", "electronics_store", "furniture_store",
  "hardware_store", "home_goods_store", "pet_store", "book_store", "florist",
  "beauty_salon", "hair_care", "spa", "laundry",
];

// Mapeia o type principal para uma categoria simplificada
function mapCategory(types: string[]): string {
  const t = new Set(types);
  if (t.has("supermarket") || t.has("grocery_or_supermarket") || t.has("convenience_store")) return "supermarket";
  if (t.has("shopping_mall")) return "mall";
  if (t.has("restaurant") || t.has("cafe") || t.has("bakery") || t.has("bar") || t.has("meal_takeaway") || t.has("food")) return "food";
  if (t.has("pharmacy")) return "pharmacy";
  if (t.has("hospital") || t.has("doctor") || t.has("dentist") || t.has("veterinary_care")) return "health";
  if (t.has("gas_station")) return "gas_station";
  if (t.has("bank") || t.has("atm")) return "bank";
  if (t.has("school") || t.has("university") || t.has("library")) return "education";
  if (t.has("church") || t.has("mosque") || t.has("hindu_temple") || t.has("synagogue")) return "religion";
  if (t.has("park") || t.has("tourist_attraction")) return "leisure";
  if (t.has("gym") || t.has("stadium") || t.has("spa")) return "sport";
  if (t.has("lodging")) return "lodging";
  if (t.has("police") || t.has("fire_station") || t.has("city_hall") || t.has("courthouse") || t.has("post_office")) return "public";
  if (t.has("bus_station") || t.has("transit_station") || t.has("taxi_stand") || t.has("airport")) return "transport";
  return "other";
}

async function fetchNearby(lat: number, lng: number, radius: number, type: string, apiKey: string) {
  const all: any[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    let url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}&radius=${radius}&type=${encodeURIComponent(type)}` +
      `&language=pt-BR&key=${apiKey}`;
    if (pageToken) url += `&pagetoken=${pageToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn(`[nearby ${type}] status=${data.status} msg=${data.error_message || ""}`);
      break;
    }
    if (Array.isArray(data.results)) all.push(...data.results);
    pageToken = data.next_page_token;
    if (!pageToken) break;
    // Google exige aguardar ~2s antes de usar o next_page_token
    await new Promise((r) => setTimeout(r, 2100));
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { lat, lng, radius = 8000, force = false, cityKey } = await req.json();
    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "lat/lng required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // chave da cidade arredondada — agrupa cidades próximas
    const key = cityKey ?? `${lat.toFixed(2)},${lng.toFixed(2)}`;

    // Skip se já cacheado recentemente (< 30 dias) e !force
    if (!force) {
      const { data: existing } = await admin
        .from("city_sync_log")
        .select("last_synced_at, places_count")
        .eq("city_key", key)
        .maybeSingle();
      if (existing) {
        const ageMs = Date.now() - new Date(existing.last_synced_at).getTime();
        if (ageMs < 30 * 24 * 60 * 60 * 1000) {
          return new Response(JSON.stringify({
            skipped: true,
            reason: "recently_synced",
            places_count: existing.places_count,
            last_synced_at: existing.last_synced_at,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const seen = new Map<string, any>(); // place_id -> place

    for (const type of PLACE_TYPES) {
      try {
        const items = await fetchNearby(lat, lng, radius, type, apiKey);
        for (const it of items) {
          if (!it.place_id) continue;
          if (!seen.has(it.place_id)) seen.set(it.place_id, it);
        }
      } catch (e) {
        console.error(`type ${type} failed:`, e);
      }
    }

    // Upsert em lotes
    const rows = Array.from(seen.values()).map((p) => ({
      google_place_id: p.place_id,
      name: p.name ?? "Sem nome",
      address: p.vicinity ?? p.formatted_address ?? "",
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
      types: p.types ?? [],
      category: mapCategory(p.types ?? []),
      rating: p.rating ?? null,
      user_ratings_total: p.user_ratings_total ?? null,
      raw: p,
      last_synced_at: new Date().toISOString(),
    })).filter(r => r.lat != null && r.lng != null);

    let inserted = 0;
    const chunk = 200;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { error } = await admin
        .from("places")
        .upsert(slice, { onConflict: "google_place_id" });
      if (error) {
        console.error("upsert error", error);
      } else {
        inserted += slice.length;
      }
    }

    await admin.from("city_sync_log").upsert({
      city_key: key,
      center_lat: lat,
      center_lng: lng,
      radius_m: radius,
      places_count: inserted,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "city_key" });

    return new Response(JSON.stringify({
      ok: true,
      city_key: key,
      total_unique: seen.size,
      inserted,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("cache-city-places error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
