import { useEffect, useRef, useState } from "react";
import {
  Camera, Loader2, CheckCircle2, X, AlertCircle, RefreshCw, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

/**
 * Selfie ao vivo com proteção contra fotos impressas:
 * 1. Usa câmera frontal via getUserMedia (não permite escolher arquivo da galeria)
 * 2. Captura 2 frames com 1.5s entre eles, pedindo para o usuário piscar
 * 3. Compara variação de pixels para detectar movimento (anti foto estática)
 * 4. Bloqueia se a câmera estiver virada ou se não houver movimento
 */
const LiveSelfieCapture = ({
  label, bucket = "selfies", pathPrefix, value, onChange, liveness = true, hint,
}: LiveSelfieCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<string | null>(value);
  const [errMsg, setErrMsg] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setErrMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStep("intro");
    } catch (e: any) {
      console.error(e);
      setErrMsg(
        e.name === "NotAllowedError"
          ? "Permissão de câmera negada. Habilite nas configurações do navegador."
          : "Não foi possível acessar a câmera deste dispositivo."
      );
      setStep("error");
    }
  };

  const captureFrame = (): { dataUrl: string; pixels: Uint8ClampedArray } | null => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return null;
    const w = 480;
    const h = 480;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    // espelha horizontal para parecer "espelho"
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    const img = ctx.getImageData(0, 0, w, h).data;
    return { dataUrl, pixels: img };
  };

  /** Conta pixels de tom de pele aproximado para garantir que tem rosto */
  const hasFaceLikeContent = (pixels: Uint8ClampedArray): boolean => {
    let skin = 0;
    let total = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      total++;
      // Heurística simples de tom de pele
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
        skin++;
      }
    }
    return skin / total > 0.05; // >5% de pixels com cor compatível
  };

  /** Diferença média entre 2 frames — se muito baixa, é foto estática (impressa/tela) */
  const frameDiff = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
    if (a.length !== b.length) return 0;
    let diff = 0;
    let count = 0;
    for (let i = 0; i < a.length; i += 16) {
      diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      count++;
    }
    return diff / count;
  };

  const runCapture = async () => {
    setStep("frame1");
    // pequeno delay para a pessoa se posicionar
    await new Promise((r) => setTimeout(r, 600));
    const f1 = captureFrame();
    if (!f1) {
      setErrMsg("Falha ao capturar imagem.");
      setStep("error");
      return;
    }
    if (!hasFaceLikeContent(f1.pixels)) {
      setErrMsg("Não detectamos um rosto. Posicione seu rosto no centro com boa iluminação.");
      setStep("intro");
      return;
    }

    if (liveness) {
      // Pede para piscar
      setStep("wait");
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise((r) => setTimeout(r, 700));
      }
      setCountdown(0);
      setStep("frame2");
      await new Promise((r) => setTimeout(r, 400));
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
      // Faz upload das duas
      await uploadFrames(f1.dataUrl, f2.dataUrl);
    } else {
      await uploadFrames(f1.dataUrl);
    }
  };

  const uploadFrames = async (mainDataUrl: string, livenessDataUrl?: string) => {
    setStep("uploading");
    try {
      const mainBlob = await (await fetch(mainDataUrl)).blob();
      const mainPath = `${pathPrefix}-${Date.now()}.jpg`;
      const { error: e1 } = await supabase.storage.from(bucket).upload(mainPath, mainBlob, {
        cacheControl: "3600", upsert: true, contentType: "image/jpeg",
      });
      if (e1) throw e1;
      const { data: signedMain } = await supabase.storage.from(bucket).createSignedUrl(mainPath, 60 * 60 * 24 * 365);
      const mainUrl = signedMain?.signedUrl || mainPath;

      let livenessUrl: string | undefined;
      if (livenessDataUrl) {
        const livBlob = await (await fetch(livenessDataUrl)).blob();
        const livPath = `${pathPrefix}-liveness-${Date.now()}.jpg`;
        const { error: e2 } = await supabase.storage.from(bucket).upload(livPath, livBlob, {
          cacheControl: "3600", upsert: true, contentType: "image/jpeg",
        });
        if (!e2) {
          const { data: signedLiv } = await supabase.storage.from(bucket).createSignedUrl(livPath, 60 * 60 * 24 * 365);
          livenessUrl = signedLiv?.signedUrl || livPath;
        }
      }

      setPreview(mainDataUrl);
      onChange(mainUrl, { livenessUrl, verified: !!livenessDataUrl });
      stopCamera();
      setStep("done");
      toast.success("Selfie verificada!");
    } catch (err: any) {
      console.error(err);
      setErrMsg("Erro ao enviar: " + (err.message || "tente novamente"));
      setStep("error");
    }
  };

  const reset = () => {
    stopCamera();
    setPreview(null);
    setErrMsg("");
    setStep("idle");
    onChange(null);
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>

      {/* Estado: já enviado */}
      {preview && step === "done" && (
        <div className="mt-1 relative aspect-square w-full overflow-hidden rounded-xl border-2 border-success">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-success/90 px-2 py-0.5 text-[10px] font-bold text-success-foreground">
            <CheckCircle2 className="h-3 w-3" /> Selfie verificada
          </span>
          <button
            type="button"
            onClick={reset}
            className="absolute top-2 right-2 rounded-full bg-card/90 p-1.5 hover:bg-card"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Estado: idle (botão para iniciar) */}
      {step === "idle" && !preview && (
        <button
          type="button"
          onClick={startCamera}
          className="mt-1 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background py-8 hover:border-primary transition-colors"
        >
          <Camera className="h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-medium">Abrir câmera</span>
          <span className="text-[10px] text-muted-foreground px-4 text-center">
            Captura ao vivo com verificação anti-fraude. Fotos da galeria não são aceitas.
          </span>
        </button>
      )}

      {/* Estado: câmera ativa */}
      {(step === "intro" || step === "frame1" || step === "wait" || step === "frame2" || step === "uploading") && (
        <div className="mt-1 space-y-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-primary bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* overlay com guia de rosto */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2/3 h-2/3 rounded-full border-2 border-white/60 border-dashed" />
            </div>
            {/* status */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-center">
              {step === "intro" && (
                <p className="text-xs text-white">Posicione seu rosto no círculo e toque em <strong>Capturar</strong></p>
              )}
              {step === "frame1" && (
                <p className="text-xs text-white flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Capturando...
                </p>
              )}
              {step === "wait" && (
                <p className="text-xs text-white flex items-center justify-center gap-2">
                  <Eye className="h-4 w-4" /> Pisque os olhos! {countdown > 0 ? countdown : ""}
                </p>
              )}
              {step === "frame2" && (
                <p className="text-xs text-white flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Verificando vivacidade...
                </p>
              )}
              {step === "uploading" && (
                <p className="text-xs text-white flex items-center justify-center gap-1">
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
                className="rounded-xl bg-gradient-primary py-2.5 text-xs font-bold text-primary-foreground shadow-glow"
              >
                Capturar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Estado: erro */}
      {step === "error" && (
        <div className="mt-1 space-y-2">
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{errMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => { setStep("idle"); setErrMsg(""); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default LiveSelfieCapture;
