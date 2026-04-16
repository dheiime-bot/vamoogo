// Edge function: Google Places (Autocomplete + Details)
// Suporta session token para reduzir custos e agrupar requisições.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, lat, lng, placeId, sessionToken } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Google API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionParam = sessionToken ? `&sessiontoken=${encodeURIComponent(sessionToken)}` : "";

    // Place Details
    if (placeId) {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=geometry,types,name,formatted_address,address_components` +
        `&language=pt-BR&region=br` +
        sessionParam +
        `&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Autocomplete
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const location = lat && lng ? `&location=${lat},${lng}&radius=50000` : "";
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      location +
      `&language=pt-BR&components=country:br` +
      sessionParam +
      `&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
