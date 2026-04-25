import { supabase } from "@/integrations/supabase/client";

type StorageBucket = "selfies" | "driver-documents";

const storageBuckets: StorageBucket[] = ["selfies", "driver-documents"];

const withCacheBust = (url: string) => `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;

const signOrPublicUrl = async (bucket: StorageBucket, path: string): Promise<string | undefined> => {
  const cleanPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 3600);
  if (data?.signedUrl) return withCacheBust(data.signedUrl);

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(cleanPath).data.publicUrl;
  return publicUrl ? withCacheBust(publicUrl) : undefined;
};

const storageCandidatesFor = async (bucket: StorageBucket, url: string): Promise<string[]> => {
  const candidates: string[] = [];
  const add = (candidate?: string) => {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  };

  const m = url.match(/\/object\/(?:sign|public)\/(selfies|driver-documents)\/([^?]+)/);
  if (m) add(await signOrPublicUrl(m[1] as StorageBucket, decodeURIComponent(m[2])));
  else if (!url.startsWith("http")) {
    const prefixedBucket = storageBuckets.find((candidate) => url.startsWith(`${candidate}/`));
    if (prefixedBucket) add(await signOrPublicUrl(prefixedBucket, url));
    add(await signOrPublicUrl(bucket, url));
    for (const candidate of storageBuckets.filter((candidate) => candidate !== bucket)) add(await signOrPublicUrl(candidate, url));
  } else add(url);

  return candidates;
};

/**
 * Resolve uma URL armazenada (que pode ser path interno do bucket, signed URL antiga,
 * ou URL pública) em uma signed URL fresca de 1h.
 * - Se for signed URL antiga (/object/sign/<bucket>/...), extrai o path e regenera.
 * - Se for path puro (sem http), assina direto.
 * - Se for URL pública absoluta, retorna como está.
 */
export async function resolveStorageUrl(
  bucket: StorageBucket,
  url?: string | null
): Promise<string | undefined> {
  if (!url) return undefined;

  // 1) Já é uma signed/public URL de storage — extrai bucket/path e regenera
  const re = /\/object\/(?:sign|public)\/(selfies|driver-documents)\/([^?]+)/;
  const m = url.match(re);
  if (m) {
    const detectedBucket = m[1] as StorageBucket;
    const path = decodeURIComponent(m[2]);
    const freshUrl = await signOrPublicUrl(detectedBucket, path);
    if (freshUrl) return freshUrl;
  }

  // 2) Path puro (sem http) — tenta bucket informado, prefixo conhecido e fallback cruzado
  if (!url.startsWith("http")) {
    const prefixedBucket = storageBuckets.find((candidate) => url.startsWith(`${candidate}/`));
    if (prefixedBucket) return signOrPublicUrl(prefixedBucket, url);

    const primaryUrl = await signOrPublicUrl(bucket, url);
    if (primaryUrl) return primaryUrl;

    for (const candidate of storageBuckets.filter((candidate) => candidate !== bucket)) {
      const fallbackUrl = await signOrPublicUrl(candidate, url);
      if (fallbackUrl) return fallbackUrl;
    }
    return undefined;
  }

  // 3) URL externa qualquer — retorna como está
  return url;
}

export async function resolveAnyStorageImage(url?: string | null): Promise<string | undefined> {
  return (await resolveStorageUrl("selfies", url)) || (await resolveStorageUrl("driver-documents", url)) || undefined;
}

export async function resolveAnyStorageImageCandidates(urls?: (string | null | undefined)[] | string | null): Promise<string[]> {
  const list = Array.isArray(urls) ? urls : [urls];
  const candidates: string[] = [];
  for (const url of list.filter(Boolean) as string[]) {
    for (const candidate of await storageCandidatesFor("selfies", url)) {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  }
  return candidates;
}
