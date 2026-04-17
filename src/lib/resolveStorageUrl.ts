import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve uma URL armazenada (que pode ser path interno do bucket, signed URL antiga,
 * ou URL pública) em uma signed URL fresca de 1h.
 * - Se for signed URL antiga (/object/sign/<bucket>/...), extrai o path e regenera.
 * - Se for path puro (sem http), assina direto.
 * - Se for URL pública absoluta, retorna como está.
 */
export async function resolveStorageUrl(
  bucket: "selfies" | "driver-documents",
  url?: string | null
): Promise<string | undefined> {
  if (!url) return undefined;

  // 1) Já é uma signed/public URL do mesmo bucket — extrai o path e regenera
  const re = new RegExp(`/object/(?:sign|public)/${bucket}/([^?]+)`);
  const m = url.match(re);
  if (m) {
    const path = decodeURIComponent(m[1]);
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) return data.signedUrl;
  }

  // 2) Path puro (sem http) — assina direto
  if (!url.startsWith("http")) {
    // Remove prefixo duplicado caso exista (ex: "selfies/foo.jpg" quando o bucket é "selfies")
    const cleanPath = url.startsWith(`${bucket}/`) ? url.slice(bucket.length + 1) : url;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 3600);
    if (data?.signedUrl) return data.signedUrl;
    return undefined;
  }

  // 3) URL externa qualquer — retorna como está
  return url;
}
