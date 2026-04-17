// Move signup/ uploads to {user_id}/ folder and update DB URLs.
// Called right after a user signs up (passenger or driver).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Bucket = "selfies" | "driver-documents";

const PROFILE_FIELDS: Array<{ col: string; bucket: Bucket }> = [
  { col: "selfie_signup_url", bucket: "selfies" },
  { col: "selfie_url", bucket: "selfies" },
];

const DRIVER_FIELDS: Array<{ col: string; bucket: Bucket }> = [
  { col: "selfie_with_document_url", bucket: "selfies" },
  { col: "selfie_liveness_url", bucket: "selfies" },
  { col: "cnh_front_url", bucket: "driver-documents" },
  { col: "cnh_back_url", bucket: "driver-documents" },
  { col: "crlv_url", bucket: "driver-documents" },
  { col: "criminal_record_url", bucket: "driver-documents" },
  { col: "vehicle_photo_front_url", bucket: "driver-documents" },
  { col: "vehicle_photo_back_url", bucket: "driver-documents" },
  { col: "vehicle_photo_left_url", bucket: "driver-documents" },
  { col: "vehicle_photo_right_url", bucket: "driver-documents" },
];

const SIGNED_TTL = 60 * 60 * 24 * 365;

// Extract object path from a signed URL like:
// https://<proj>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
function extractObjectPath(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/sign/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

async function moveAndSign(
  supabase: ReturnType<typeof createClient>,
  bucket: Bucket,
  oldPath: string,
  userId: string,
): Promise<string | null> {
  // Only move if it lives in signup/
  if (!oldPath.startsWith("signup/")) return null;
  const fileName = oldPath.replace(/^signup\//, "");
  const newPath = `${userId}/${fileName}`;

  const { error: moveErr } = await supabase.storage.from(bucket).move(oldPath, newPath);
  if (moveErr) {
    console.error(`move ${bucket}/${oldPath} -> ${newPath}`, moveErr.message);
    return null;
  }

  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(newPath, SIGNED_TTL);
  if (signErr || !data?.signedUrl) {
    console.error(`sign ${bucket}/${newPath}`, signErr?.message);
    return null;
  }
  return data.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the caller via their JWT.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const moved: Record<string, string> = {};

    // ---- Profiles ----
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, " + PROFILE_FIELDS.map((f) => f.col).join(", "))
      .eq("user_id", userId)
      .maybeSingle();

    if (profile) {
      const updates: Record<string, string> = {};
      for (const { col, bucket } of PROFILE_FIELDS) {
        const url = (profile as Record<string, unknown>)[col] as string | null;
        if (!url) continue;
        const path = extractObjectPath(url, bucket);
        if (!path || !path.startsWith("signup/")) continue;
        const newUrl = await moveAndSign(admin, bucket, path, userId);
        if (newUrl) {
          updates[col] = newUrl;
          moved[col] = newUrl;
        }
      }
      if (Object.keys(updates).length > 0) {
        await admin.from("profiles").update(updates).eq("user_id", userId);
      }
    }

    // ---- Drivers ----
    const { data: driver } = await admin
      .from("drivers")
      .select("user_id, " + DRIVER_FIELDS.map((f) => f.col).join(", "))
      .eq("user_id", userId)
      .maybeSingle();

    if (driver) {
      const updates: Record<string, string> = {};
      for (const { col, bucket } of DRIVER_FIELDS) {
        const url = (driver as Record<string, unknown>)[col] as string | null;
        if (!url) continue;
        const path = extractObjectPath(url, bucket);
        if (!path || !path.startsWith("signup/")) continue;
        const newUrl = await moveAndSign(admin, bucket, path, userId);
        if (newUrl) {
          updates[col] = newUrl;
          moved[col] = newUrl;
        }
      }
      if (Object.keys(updates).length > 0) {
        await admin.from("drivers").update(updates).eq("user_id", userId);
      }
    }

    return new Response(JSON.stringify({ ok: true, moved: Object.keys(moved).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("finalize-signup-uploads error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
