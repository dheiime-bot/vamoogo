import { Camera, Upload, Loader2, CheckCircle2, X, FileText as FileIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { buildUploadPath, fileToDataUrl, uploadToSignedUrl } from "@/lib/storageUpload";

interface DocumentUploadProps {
  label: string;
  bucket: "selfies" | "driver-documents";
  pathPrefix: string; // ex: `${userId}/cnh-frente`
  value: string | null;
  onChange: (publicUrl: string | null) => void;
  capture?: "user" | "environment";
  hint?: string;
  /** Aceita PDF além de imagens */
  acceptPdf?: boolean;
}

const DocumentUpload = ({ label, bucket, pathPrefix, value, onChange, capture, hint, acceptPdf }: DocumentUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value);

  useEffect(() => {
    setPreview(value);
  }, [value]);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite: 10MB");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf && !acceptPdf) {
      toast.error("Este campo aceita apenas imagens");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!isPdf && !file.type.startsWith("image/")) {
      toast.error("Formato inválido. Envie uma imagem válida" + (acceptPdf ? " ou PDF" : ""));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || (isPdf ? "pdf" : "jpg")).toLowerCase();
      const path = buildUploadPath(pathPrefix, ext);
      const url = await uploadToSignedUrl({
        bucket,
        path,
        file,
        contentType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
      });

      if (isPdf) {
        setPreview(`__pdf__:${file.name}`);
      } else {
        setPreview(await fileToDataUrl(file));
      }

      onChange(url);
      toast.success(`${label} enviado!`);
    } catch (err: any) {
      console.error(`upload error [${label}]`, err);
      toast.error(`Erro ao enviar ${label}: ${err?.message || "tente novamente"}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onChange(null);
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={acceptPdf ? "image/*,application/pdf" : "image/*"}
        capture={acceptPdf ? undefined : capture}
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={handlePick}
        disabled={uploading}
        className={`mt-1 relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed bg-background transition-colors ${
          preview ? "border-success aspect-video" : "border-muted-foreground/30 py-6 hover:border-primary"
        }`}
      >
        {uploading ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Enviando...
          </span>
        ) : preview ? (
          <>
            {preview.startsWith("__pdf__:") ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted/30">
                <FileIcon className="h-10 w-10 text-primary" />
                <span className="text-xs font-semibold">PDF enviado</span>
                <span className="max-w-[80%] truncate text-[10px] text-muted-foreground">{preview.replace("__pdf__:", "")}</span>
              </div>
            ) : (
              <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-cover" />
            )}
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-success/90 px-2 py-0.5 text-[10px] font-bold text-success-foreground">
              <CheckCircle2 className="h-3 w-3" /> Enviado
            </span>
            <span
              onClick={handleRemove}
              className="absolute right-2 top-2 cursor-pointer rounded-full bg-card/90 p-1 hover:bg-card"
            >
              <X className="h-3.5 w-3.5" />
            </span>
            <span className="absolute bottom-2 right-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold">
              Trocar
            </span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {capture && !acceptPdf ? <Camera className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
            {capture && !acceptPdf ? "Tirar foto" : acceptPdf ? "Enviar imagem ou PDF" : "Enviar arquivo"}
          </span>
        )}
      </button>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
};

export default DocumentUpload;
