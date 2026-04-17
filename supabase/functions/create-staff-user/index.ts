import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verifica autenticação do chamador
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role para checagens e criação
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Apenas master pode criar funcionários
    const { data: isMaster } = await admin.rpc("is_master", { _user_id: user.id });
    if (!isMaster) {
      return new Response(JSON.stringify({ error: "Acesso negado: apenas o master pode criar funcionários" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, full_name, phone, role, status, permission_ids } = body ?? {};

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: email, password, full_name, role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["admin", "master"].includes(role)) {
      return new Response(JSON.stringify({ error: "role deve ser 'admin' ou 'master'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Cria usuário no auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, phone, user_type: "admin" },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Falha ao criar usuário" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const newUserId = created.user.id;

    // 2) Atribui role (handle_new_user já cria 'admin' por user_type=admin; garantimos master se necessário)
    if (role === "master") {
      await admin.from("user_roles").insert({ user_id: newUserId, role: "master" });
    }

    // 3) Cria registro em staff_users
    await admin.from("staff_users").insert({
      user_id: newUserId, full_name, email, phone: phone ?? null,
      status: status ?? "active", created_by: user.id,
    });

    // 4) Permissões individuais (overrides), se enviadas
    if (Array.isArray(permission_ids) && permission_ids.length > 0) {
      const rows = permission_ids.map((pid: string) => ({
        user_id: newUserId, permission_id: pid, granted: true, granted_by: user.id,
      }));
      await admin.from("user_permissions").insert(rows);
    }

    // 5) Auditoria
    await admin.from("audit_logs").insert({
      admin_id: user.id, action: "create_staff_user",
      entity_type: "staff_users", entity_id: newUserId,
      details: { email, full_name, role, status: status ?? "active" },
    });

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
