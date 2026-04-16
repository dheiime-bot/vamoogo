// Edge function: serve a chave pública do Google Maps JS para o front
// (a chave é mantida em segredo no backend e exposta apenas para uso do Maps no domínio).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "Google Maps key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ key }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
