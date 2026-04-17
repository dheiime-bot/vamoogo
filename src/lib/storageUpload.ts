import { supabase } from "@/integrations/supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type UploadBucket = "selfies" | "driver-documents";

export const buildUploadPath = (pathPrefix: string, extension: string) => {
  const safeExt = extension.replace(/^\./, "").toLowerCase();
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

  return `${pathPrefix}-${Date.now()}-${unique}.${safeExt}`;
};

export const fileToDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
  reader.readAsDataURL(file);
});

export const uploadToSignedUrl = async ({
  bucket,
  path,
  file,
  contentType,
  retries = 2,
}: {
  bucket: UploadBucket;
  path: string;
  file: Blob | File;
  contentType: string;
  retries?: number;
}) => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType,
    });

    if (!uploadError) {
      const { data, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

      if (signedError || !data?.signedUrl) {
        throw signedError || new Error("Falha ao gerar link seguro do arquivo");
      }

      return data.signedUrl;
    }

    lastError = uploadError;
    if (attempt < retries) {
      await wait(350 * attempt);
    }
  }

  throw lastError || new Error("Falha no upload do arquivo");
};
