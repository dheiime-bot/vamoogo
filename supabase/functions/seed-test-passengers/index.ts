// Edge function: seed-test-passengers
// Cria N passageiros fictícios (default 10) usando dados válidos para os triggers
// (CPF único, telefone único, full_name, etc.). Apenas master/admin pode chamar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gera CPF válido (algoritmo de verificação) com base em um número aleatório.
const genCpf = (): string => {
  const rand = () => Math.floor(Math.random() * 10);
  const n = Array.from({ length: 9 }, rand);
  const dv = (digits: number[]) => {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += digits[i] * (digits.length + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join("");
};

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Eva", "Felipe", "Gabi", "Hugo", "Iris", "João", "Karol", "Lucas", "Marina", "Nicolas", "Olívia", "Paulo", "Renata", "Sérgio", "Tati", "Vinícius"];
const LAST = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Costa", "Pereira", "Almeida", "Rodrigues", "Ferreira"];
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes } = await supabase.auth.getUser(token);
    const callerId = userRes?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "master");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado (apenas admin)" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const count = Math.max(1, Math.min(50, Number(body.count) || 10));

    const created: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < count; i++) {
      // Garante CPF e phone únicos (até 5 tentativas)
      let cpf = "";
      let phone = "";
      let attempts = 0;
      while (attempts < 5) {
        cpf = genCpf();
        phone = "11" + (900000000 + Math.floor(Math.random() * 99999999)).toString();
        const { data: dupes } = await supabase.rpc("check_signup_dupes", { _cpf: cpf, _phone: phone });
        const dup = (dupes as any[])?.[0];
        if (!dup?.cpf_taken && !dup?.phone_taken) break;
        attempts++;
      }

      const first = pick(FIRST);
      const last = pick(LAST);
      const full_name = `${first} ${last} Teste`;
      const stamp = Date.now() + i;
      const email = `pax.teste.${stamp}@vamoo.test`;

      const { data: user, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: "Teste@1234",
        email_confirm: true,
        user_metadata: {
          full_name,
          cpf,
          phone,
          user_type: "passenger",
        },
      });

      if (authErr || !user?.user) {
        errors.push({ i: i + 1, error: authErr?.message || "Falha ao criar usuário" });
        continue;
      }

      created.push({
        id: user.user.id,
        email,
        full_name,
        cpf,
        phone,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      requested: count,
      created: created.length,
      passengers: created,
      errors: errors.length ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[seed-test-passengers] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
