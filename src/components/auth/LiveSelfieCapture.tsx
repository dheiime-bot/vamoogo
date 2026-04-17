import { useEffect, useRef, useState } from "react";
import {
  Camera, Loader2, CheckCircle2, X, AlertCircle, RefreshCw, Eye, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { buildUploadPath, fileToDataUrl, uploadToSignedUrl } from "@/lib/storageUpload";

interface LiveSelfieCaptureProps {
  label: string;
  bucket?: "selfies" | "driver-documents";
  pathPrefix: string;
  value: string | null;
  onChange: (publicUrl: string | null, metadata?: { livenessUrl?: string; verified?: boolean }) => void;
  /** Se true, força captura ao vivo + 2 frames com piscar entre eles (anti foto impressa) */
  liveness?: boolean;
  hint?: string;
}

type Step = "idle" | "intro" | "frame1" | "wait" | "frame2" | "uploading" | "done" | "error";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const LiveSelfieCapture = ({
  label, bucket = "selfies", pathPrefix, value, onChange, liveness = true, hint,
}: LiveSelfieCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<string | null>(value);
  const [errMsg, setErrMsg] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const [cameraSupported, setCameraSupported] = useState<boolean>(true);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setCameraSupported(supported);
    return () => stopCamera();
  }, []);

  useEffect(() => {
    setPreview(value);
  }, [value]);

  useEffect(() => () => stopCamera(), []);

  const stopCamera = () => {
    setCameraReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  const attachStreamToVideo = async (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) throw new Error("Elemento de vídeo não montado");

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      const onLoaded = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        resolve();
      };
      video.addEventListener("loadedmetadata", onLoaded);
    });

    try {
      await video.play();
    } catch {
      await wait(120);
      await video.play();
    }

    setCameraReady(true);
  };

  const startCamera = async () => {
    setErrMsg("");
    setCameraReady(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraSupported(false);
      setErrMsg("Câmera ao vivo não disponível neste navegador. Use a opção alternativa abaixo.");
      setStep("error");
      return;
    }

    setStep("intro");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await attachStreamToVideo(stream);
    } catch (e: any) {
      console.error("getUserMedia error:", e);
      let msg = "Não foi possível acessar a câmera deste dispositivo.";
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        msg = "Permissão de câmera negada. Verifique as permissões do navegador. Você pode usar a opção alternativa abaixo.";
      } else if (e.name === "NotFoundError" || e.name === "OverconstrainedError") {
        msg = "Nenhuma câmera encontrada. Use a opção alternativa abaixo.";
      } else if (e.name === "NotReadableError") {
        msg = "Câmera já está em uso por outro app. Feche outros apps e tente novamente, ou use a opção alternativa.";
      }
      stopCamera();
      setErrMsg(msg);
      setStep("error");
    }
  };

  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 8MB)");
      if (fallbackInputRef.current) fallbackInputRef.current.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem válida");
      if (fallbackInputRef.current) fallbackInputRef.current.value = "";
      return;
    }

    setStep("uploading");
    try {
      const dataUrl = await fileToDataUrl(file);
      const path = buildUploadPath(pathPrefix, "jpg");
      const url = await uploadToSignedUrl({
        bucket,
        path,
        file,
        contentType: file.type || "image/jpeg",
      });

      setPreview(dataUrl);
      onChange(url, { verified: true });
      setStep("done");
      toast.success("Selfie enviada!");
    } catch (err: any) {
      console.error("fallback selfie upload error", err);
      setErrMsg("Erro ao enviar: " + (err?.message || "tente novamente"));
      setStep("error");
    } finally {
      if (fallbackInputRef.current) fallbackInputRef.current.value = "";
    }
  };

  const captureFrame = (): { dataUrl: string; pixels: Uint8ClampedArray } | null => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) return null;

    const w = 480;
    const h = 480;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    const img = ctx.getImageData(0, 0, w, h).data;
    return { dataUrl, pixels: img };
  };

  const hasFaceLikeContent = (pixels: Uint8ClampedArray): boolean => {
    let skin = 0;
    let total = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      total += 1;
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
        skin += 1;
      }
    }
    return total > 0 && skin / total > 0.05;
  };

  const frameDiff = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
    if (a.length !== b.length) return 0;
    let diff = 0;
    let count = 0;
    for (let i = 0; i < a.length; i += 16) {
      diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      count += 1;
    }
    return count > 0 ? diff / count : 0;
  };

  const runCapture = async () => {
    if (!cameraReady || !streamRef.current) {
      setErrMsg("A câmera ainda está iniciando. Aguarde um instante e tente novamente.");
      setStep("intro");
      return;
    }

    setStep("frame1");
    await wait(400);

    const f1 = captureFrame();
    if (!f1) {
      setErrMsg("Falha ao capturar imagem. Tente novamente com boa iluminação.");
      setStep("error");
      return;
    }

    if (!hasFaceLikeContent(f1.pixels)) {
      setErrMsg("Não detectamos um rosto. Posicione seu rosto no centro com boa iluminação.");
      setStep("intro");
      return;
    }

    if (!liveness) {
      await uploadFrames(f1.dataUrl);
      return;
    }

    setStep("wait");
    for (let i = 3; i > 0; i -= 1) {
      setCountdown(i);
      await wait(650);
    }
    setCountdown(0);

    setStep("frame2");
    await wait(250);

    const f2 = captureFrame();
    if (!f2) {
      setErrMsg("Falha ao capturar segunda imagem.");
      setStep("error");
      return;
    }

    const diff = frameDiff(f1.pixels, f2.pixels);
    if (diff < 4) {
      setErrMsg("Detectamos uma imagem estática. Selfies de fotos impressas, telas ou screenshots não são aceitas. Tire uma selfie real.");
      setStep("error");
      return;
    }

    await uploadFrames(f1.dataUrl, f2.dataUrl);
  };

  const dataUrlToBlob = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    return res.blob();
  };

  const uploadFrames = async (mainDataUrl: string, livenessDataUrl?: string) => {
    setStep("uploading");
    try {
      const mainBlob = await dataUrlToBlob(mainDataUrl);
      const mainPath = buildUploadPath(pathPrefix, "jpg");
      const mainUrl = await uploadToSignedUrl({
        bucket,
        path: mainPath,
        file: mainBlob,
        contentType: "image/jpeg",
      });

      let livenessUrl: string | undefined;
      if (livenessDataUrl) {
        const livBlob = await dataUrlToBlob(livenessDataUrl);
        const livPath = buildUploadPath(`${pathPrefix}-liveness`, "jpg");
        livenessUrl = await uploadToSignedUrl({
          bucket,
          path: livPath,
          file: livBlob,
          contentType: "image/jpeg",
        });
      }

      setPreview(mainDataUrl);
      onChange(mainUrl, { livenessUrl, verified: !!livenessDataUrl });
      stopCamera();
      setStep("done");
      toast.success(livenessDataUrl ? "Selfie verificada!" : "Selfie enviada!");
    } catch (err: any) {
      console.error("live selfie upload error", err);
      setErrMsg("Erro ao enviar: " + (err?.message || "tente novamente"));
      setStep("error");
    }
  };

  const reset = () => {
    stopCamera();
    setPreview(null);
    setErrMsg("");
    setCountdown(0);
    setStep("idle");
    onChange(null);
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>

      {preview && step === "done" && (
        <div className="relative mt-1 aspect-square w-full overflow-hidden rounded-xl border-2 border-success">
          <img src={preview} alt={label} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-success/90 px-2 py-0.5 text-[10px] font-bold text-success-foreground">
            <CheckCircle2 className="h-3 w-3" /> Selfie verificada
          </span>
          <button
            type="button"
            onClick={reset}
            className="absolute right-2 top-2 rounded-full bg-card/90 p-1.5 hover:bg-card"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {step === "idle" && !preview && (
        <div className="mt-1 space-y-2">
          <button
            type="button"
            onClick={startCamera}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background py-8 transition-colors hover:border-primary"
          >
            <Camera className="h-7 w-7 text-muted-foreground" />
            <span className="text-sm font-medium">Abrir câmera ao vivo</span>
            <span className="px-4 text-center text-[10px] text-muted-foreground">
              Captura ao vivo com verificação anti-fraude (recomendado).
            </span>
          </button>
          <button
            type="button"
            onClick={() => fallbackInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border bg-background py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <Upload className="h-4 w-4" /> Usar câmera do dispositivo (alternativa)
          </button>
          {!cameraSupported && (
            <p className="px-2 text-center text-[10px] text-warning">
              Câmera ao vivo indisponível neste navegador. Use a alternativa abaixo.
            </p>
          )}
          <p className="px-2 text-center text-[10px] text-muted-foreground">
            Se a câmera ao vivo não abrir, use a alternativa. A foto passará por análise manual.
          </p>
        </div>
      )}

      {(step === "intro" || step === "frame1" || step === "wait" || step === "frame2" || step === "uploading") && (
        <div className="mt-1 space-y-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-primary bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {!cameraReady && step === "intro" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <p className="flex items-center gap-2 text-xs text-white">
                  <Loader2 className="h-4 w-4 animate-spin" /> Iniciando câmera...
                </p>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-2/3 w-2/3 rounded-full border-2 border-dashed border-white/60" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-center">
              {step === "intro" && (
                <p className="text-xs text-white">
                  {cameraReady
                    ? <>Posicione seu rosto no círculo e toque em <strong>Capturar</strong></>
                    : "Aguarde a câmera ficar pronta..."}
                </p>
              )}
              {step === "frame1" && (
                <p className="flex items-center justify-center gap-1 text-xs text-white">
                  <Loader2 className="h-3 w-3 animate-spin" /> Capturando...
                </p>
              )}
              {step === "wait" && (
                <p className="flex items-center justify-center gap-2 text-xs text-white">
                  <Eye className="h-4 w-4" /> Pisque os olhos! {countdown > 0 ? countdown : ""}
                </p>
              )}
              {step === "frame2" && (
                <p className="flex items-center justify-center gap-1 text-xs text-white">
                  <Loader2 className="h-3 w-3 animate-spin" /> Verificando vivacidade...
                </p>
              )}
              {step === "uploading" && (
                <p className="flex items-center justify-center gap-1 text-xs text-white">
                  <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                </p>
              )}
            </div>
          </div>

          {step === "intro" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { stopCamera(); setStep("idle"); }}
                className="rounded-xl border py-2.5 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runCapture}
                disabled={!cameraReady}
                className="rounded-xl bg-gradient-primary py-2.5 text-xs font-bold text-primary-foreground shadow-glow disabled:opacity-50"
              >
                Capturar
              </button>
            </div>
          )}
        </div>
      )}

      {step === "error" && (
        <div className="mt-1 space-y-2">
          <div className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{errMsg}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { stopCamera(); setStep("idle"); setErrMsg(""); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => fallbackInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground"
            >
              <Camera className="h-3.5 w-3.5" /> Usar câmera nativa
            </button>
          </div>
        </div>
      )}

      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}

      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFallbackFile}
        className="hidden"
      />
    </div>
  );
};

export default LiveSelfieCapture;
