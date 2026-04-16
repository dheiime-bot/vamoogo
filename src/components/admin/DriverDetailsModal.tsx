import { X, CheckCircle, XCircle, Ban, Phone, Mail, FileText, Car, User as UserIcon, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DriverDetailsModalProps {
  driver: any;
  onClose: () => void;
  onAction: (status: "approved" | "rejected" | "blocked") => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Em análise", color: "bg-warning/15 text-warning" },
  approved: { label: "Aprovado", color: "bg-success/15 text-success" },
  rejected: { label: "Reprovado", color: "bg-warning/15 text-warning" },
  blocked: { label: "Bloqueado", color: "bg-destructive/15 text-destructive" },
};

const DriverDetailsModal = ({ driver, onClose, onAction }: DriverDetailsModalProps) => {
  const profile = driver.profiles;
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.selfie_url) setSelfieUrl(profile.selfie_url);
  }, [profile]);

  const status = statusConfig[driver.status] || statusConfig.pending;

  const ImageBlock = ({ url, label, icon: Icon }: { url: string | null; label: string; icon: typeof FileText }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {url ? (
        <button onClick={() => setZoomImg(url)} className="block w-full aspect-video rounded-xl overflow-hidden border bg-muted hover:border-primary transition-colors">
          <img src={url} alt={label} className="w-full h-full object-cover" />
        </button>
      ) : (
        <div className="aspect-video rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Não enviado
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
        <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div>
              <h2 className="text-lg font-bold font-display">{profile?.full_name || "Motorista"}</h2>
              <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${status.color}`}>
                {status.label}
              </span>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Personal info */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Dados pessoais</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0"><p className="text-[10px] text-muted-foreground">CPF</p><p className="text-xs font-medium truncate">{profile?.cpf || "—"}</p></div>
                </div>
                <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0"><p className="text-[10px] text-muted-foreground">Telefone</p><p className="text-xs font-medium truncate">{profile?.phone || "—"}</p></div>
                </div>
                <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2 col-span-2">
                  <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0"><p className="text-[10px] text-muted-foreground">E-mail</p><p className="text-xs font-medium truncate">{profile?.email || "—"}</p></div>
                </div>
              </div>
            </div>

            {/* Vehicle */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Veículo</p>
              <div className="rounded-xl border p-3 flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Car className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{driver.vehicle_model || "—"} <span className="text-muted-foreground">• {driver.vehicle_color || "—"}</span></p>
                  <p className="text-xs text-muted-foreground">Placa: <span className="font-mono font-bold">{driver.vehicle_plate || "—"}</span> • {driver.category}</p>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Documentos enviados</p>
              <div className="grid grid-cols-2 gap-3">
                <ImageBlock url={selfieUrl} label="Selfie de verificação" icon={UserIcon} />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> CNH (nº)
                  </p>
                  <div className="rounded-xl border bg-muted/30 p-3 h-full flex items-center">
                    <p className="text-sm font-mono font-bold">{driver.cnh_number || "—"}</p>
                  </div>
                </div>
                <ImageBlock url={driver.cnh_front_url} label="CNH (frente)" icon={FileText} />
                <ImageBlock url={driver.cnh_back_url} label="CNH (verso)" icon={FileText} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Saldo</p>
                <p className="text-sm font-extrabold text-primary">R$ {Number(driver.balance || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Corridas</p>
                <p className="text-sm font-extrabold text-primary">{driver.total_rides || 0}</p>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Avaliação</p>
                <p className="text-sm font-extrabold text-primary">{Number(driver.rating || 0).toFixed(1)} ⭐</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t bg-card p-4 shrink-0 grid grid-cols-3 gap-2">
            <button onClick={() => onAction("approved")} className="flex items-center justify-center gap-1.5 rounded-xl bg-success py-3 text-xs font-bold text-success-foreground hover:opacity-90">
              <CheckCircle className="h-4 w-4" /> Aprovar
            </button>
            <button onClick={() => onAction("rejected")} className="flex items-center justify-center gap-1.5 rounded-xl bg-warning py-3 text-xs font-bold text-warning-foreground hover:opacity-90">
              <XCircle className="h-4 w-4" /> Reprovar
            </button>
            <button onClick={() => onAction("blocked")} className="flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-3 text-xs font-bold text-destructive-foreground hover:opacity-90">
              <Ban className="h-4 w-4" /> Bloquear
            </button>
          </div>
        </div>
      </div>

      {/* Image zoom overlay */}
      {zoomImg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={() => setZoomImg(null)}>
          <button className="absolute top-4 right-4 rounded-full bg-card p-2"><X className="h-5 w-5" /></button>
          <img src={zoomImg} alt="Zoom" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </>
  );
};

export default DriverDetailsModal;
