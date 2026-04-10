import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.103.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: any[] = [];

    // Create passenger
    const { data: passenger, error: pErr } = await supabase.auth.admin.createUser({
      email: "passageiro@teste.com",
      password: "Teste@1234",
      email_confirm: true,
      user_metadata: {
        full_name: "Maria Silva Teste",
        cpf: "52998224725",
        phone: "11999990000",
        user_type: "passenger",
      },
    });

    if (pErr) {
      results.push({ passenger: "error", message: pErr.message });
    } else {
      results.push({ passenger: "created", id: passenger.user.id, email: "passageiro@teste.com" });
    }

    // Create driver
    const { data: driver, error: dErr } = await supabase.auth.admin.createUser({
      email: "motorista@teste.com",
      password: "Teste@1234",
      email_confirm: true,
      user_metadata: {
        full_name: "Carlos Mendes Teste",
        cpf: "11144477735",
        phone: "11988881234",
        user_type: "driver",
        category: "car",
        vehicle_model: "Toyota Corolla 2022",
        vehicle_color: "Prata",
        vehicle_plate: "ABC1D23",
      },
    });

    if (dErr) {
      results.push({ driver: "error", message: dErr.message });
    } else {
      // Update driver balance to 50 (bonus)
      const { error: balErr } = await supabase
        .from("drivers")
        .update({ balance: 50.0, status: "approved", vehicle_model: "Toyota Corolla 2022", vehicle_color: "Prata", vehicle_plate: "ABC1D23", cnh_ear: true })
        .eq("user_id", driver.user.id);

      results.push({ driver: "created", id: driver.user.id, email: "motorista@teste.com", balance_update: balErr ? balErr.message : "ok" });
    }

    // Add recharge records for bonuses
    if (passenger?.user) {
      await supabase.from("recharges").insert({
        driver_id: passenger.user.id,
        amount: 20.0,
        bonus: 20.0,
        method: "pix",
        status: "completed",
      });
    }

    if (driver?.user) {
      await supabase.from("recharges").insert({
        driver_id: driver.user.id,
        amount: 50.0,
        bonus: 50.0,
        method: "pix",
        status: "completed",
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
