// Deletes orphaned files under signup/ older than 24h in selfies and driver-documents buckets.
// Intended to run on a daily schedule (pg_cron / external scheduler).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

const BUCKETS = ["selfies", "driver-documents"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const summary: Record<string, number> = {};

  try {
    for (const bucket of BUCKETS) {
      let deleted = 0;
      // List files in signup/ (paginated)
      let offset = 0;
      const limit = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await admin.storage
          .from(bucket)
          .list("signup", { limit, offset, sortBy: { column: "created_at", order: "asc" } });
        if (error) {
          console.error(`list ${bucket}/signup`, error.message);
          break;
        }
        if (!data || data.length === 0) break;

        const toDelete: string[] = [];
        for (const f of data) {
          const created = f.created_at ? new Date(f.created_at).getTime() : 0;
          if (created && now - created > ORPHAN_AGE_MS) {
            toDelete.push(`signup/${f.name}`);
          }
        }
        if (toDelete.length > 0) {
          const { error: rmErr } = await admin.storage.from(bucket).remove(toDelete);
          if (rmErr) {
            console.error(`remove ${bucket}`, rmErr.message);
          } else {
            deleted += toDelete.length;
          }
        }
        if (data.length < limit) break;
        offset += limit;
      }
      summary[bucket] = deleted;
    }

    return new Response(JSON.stringify({ ok: true, deleted: summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cleanup-signup-orphans error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
