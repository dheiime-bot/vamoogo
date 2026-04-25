import { X, CheckCircle, XCircle, Ban, Phone, Mail, FileText, Car, User as UserIcon, AlertCircle, FileWarning, MessageSquare, ShieldCheck, Calendar, KeyRound, Hash, ScrollText, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getDriverStatusInfo } from "@/lib/driverStatus";
import { resolveStorageUrl } from "@/lib/resolveStorageUrl";
import EditDriverModal from "./EditDriverModal";

interface DriverDetailsModalProps {
  driver: any;
  onClose: () => void;
  onAction: (status: string, message?: string) => void;
  onRefresh?: () => void;
}

type ActionMode = null | "approve" | "reject" | "request_docs" | "block";

const DriverDetailsModal = ({ driver, onClose, onAction, onRefresh }: DriverDetailsModalProps) => {
  const profile = driver.profiles;
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [message, setMessage] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  const status = getDriverStatusInfo(driver.status);

  // Resolve URLs assinadas para documentos privados
  useEffect(() => {
    const fields: Array<[string, string, "selfies" | "driver-documents"]> = [
      ["selfie_signup", profile?.selfie_signup_url, "selfies"],
      ["selfie", profile?.selfie_url, "selfies"],
      ["cnh_front", driver.cnh_front_url, "driver-documents"],
      ["cnh_back", driver.cnh_back_url, "driver-documents"],
      ["crlv", driver.crlv_url, "driver-documents"],
      ["selfie_doc", driver.selfie_with_document_url, "driver-documents"],
      ["selfie_liveness", driver.selfie_liveness_url, "selfies"],
      ["criminal", driver.criminal_record_url, "driver-documents"],
      ["v_front", driver.vehicle_photo_front_url, "driver-documents"],
      ["v_back", driver.vehicle_photo_back_url, "driver-documents"],
      ["v_left", driver.vehicle_photo_left_url, "driver-documents"],
      ["v_right", driver.vehicle_photo_right_url, "driver-documents"],
    ];

    (async () => {
      const map: Record<string, string> = {};
      for (const [key, url, bucket] of fields) {
        const resolved = await resolveStorageUrl(bucket, url);
        if (resolved) map[key] = resolved;
      }
      setSignedUrls(map);
    })();
  }, [driver, profile]);

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

  const handleConfirm = () => {
    if (!actionMode) return;
    if ((actionMode === "reject" || actionMode === "request_docs") && !message.trim()) {
      toast.error("Escreva uma mensagem para o motorista");
      return;
    }
    const map: Record<string, string> = {
      approve: "aprovado",
      reject: "reprovado",
      request_docs: "pendente_documentos",
      block: "blocked",
    };
    onAction(map[actionMode], message.trim() || undefined);
    setActionMode(null);
    setMessage("");
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
        <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div>
              <h2 className="text-lg font-bold font-display">{profile?.full_name || "Motorista"}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
                <Link
                  to={`/admin/audit?entity_type=driver&entity=${driver.user_id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <ScrollText className="h-3 w-3" /> Ver na auditoria
                </Link>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Pencil className="h-3 w-3" /> Editar dados
                </button>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Mensagem anterior se houver */}
            {driver.analysis_message && (
              <div className="rounded-xl bg-muted/50 border p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" /> Última mensagem enviada
                </p>
                <p className="text-xs">{driver.analysis_message}</p>
              </div>
            )}

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
                <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0"><p className="text-[10px] text-muted-foreground">Nascimento</p><p className="text-xs font-medium truncate">{profile?.birth_date ? new Date(profile.birth_date).toLocaleDateString("pt-BR") : "—"}</p></div>
                </div>
                <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0"><p className="text-[10px] text-muted-foreground">Liveness</p><p className="text-xs font-medium truncate">{driver.liveness_verified ? "Verificado" : "Pendente"}</p></div>
                </div>
                <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0"><p className="text-[10px] text-muted-foreground">ID</p><p className="text-xs font-mono font-medium truncate">{driver.user_id?.slice(0, 8)}…</p></div>
                </div>
                <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0"><p className="text-[10px] text-muted-foreground">Cadastrado</p><p className="text-xs font-medium truncate">{new Date(driver.created_at).toLocaleDateString("pt-BR")}</p></div>
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
                  <p className="text-sm font-bold">{driver.vehicle_brand} {driver.vehicle_model || "—"} <span className="text-muted-foreground">• {driver.vehicle_color || "—"} {driver.vehicle_year ? `• ${driver.vehicle_year}` : ""}</span></p>
                  <p className="text-xs text-muted-foreground">Placa: <span className="font-mono font-bold">{driver.vehicle_plate || "—"}</span> • {driver.category}</p>
                </div>
              </div>
            </div>

            {/* Pix */}
            {driver.pix_key && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Dados Pix</p>
                <div className="rounded-xl border p-3 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Tipo</p><p className="font-medium capitalize">{driver.pix_key_type || "—"}</p></div>
                  <div><p className="text-muted-foreground">Chave</p><p className="font-mono">{driver.pix_key}</p></div>
                  <div className="col-span-2"><p className="text-muted-foreground">Favorecido</p><p className="font-medium">{driver.pix_holder_name || "—"}</p></div>
                </div>
              </div>
            )}

            {/* Documents */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Documentos enviados</p>
              <div className="grid grid-cols-2 gap-3">
                <ImageBlock url={signedUrls.selfie_signup || signedUrls.selfie} label="Selfie do cadastro" icon={UserIcon} />
                <ImageBlock url={signedUrls.selfie_liveness} label="Selfie ao vivo (liveness)" icon={ShieldCheck} />
                <ImageBlock url={signedUrls.selfie_doc} label="Selfie com documento" icon={UserIcon} />
                <ImageBlock url={signedUrls.cnh_front} label="CNH (frente)" icon={FileText} />
                <ImageBlock url={signedUrls.cnh_back} label="CNH (verso)" icon={FileText} />
                <ImageBlock url={signedUrls.crlv} label="CRLV" icon={FileText} />
                <ImageBlock url={signedUrls.criminal} label={`Antecedentes${driver.criminal_record_issued_at ? ` (${new Date(driver.criminal_record_issued_at).toLocaleDateString("pt-BR")})` : ""}`} icon={FileText} />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> CNH (nº)
                  </p>
                  <div className="rounded-xl border bg-muted/30 p-3 h-full flex items-center">
                    <div>
                      <p className="text-sm font-mono font-bold">{driver.cnh_number || "—"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">EAR: {driver.cnh_ear ? "Sim" : "Não"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle photos */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Fotos do veículo</p>
              <div className="grid grid-cols-2 gap-3">
                <ImageBlock url={signedUrls.v_front} label="Frente" icon={Car} />
                <ImageBlock url={signedUrls.v_back} label="Traseira" icon={Car} />
                <ImageBlock url={signedUrls.v_left} label="Lateral esquerda" icon={Car} />
                <ImageBlock url={signedUrls.v_right} label="Lateral direita" icon={Car} />
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

          {/* Action input */}
          {actionMode && (
            <div className="border-t bg-muted/30 p-3 space-y-2 shrink-0">
              <p className="text-xs font-semibold">
                {actionMode === "approve" && "Confirmar aprovação?"}
                {actionMode === "reject" && "Mensagem ao motorista (motivo da reprovação)"}
                {actionMode === "request_docs" && "Quais documentos precisam ser reenviados?"}
                {actionMode === "block" && "Confirmar bloqueio?"}
              </p>
              {(actionMode === "reject" || actionMode === "request_docs") && (
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={actionMode === "request_docs" ? "Ex: Reenvie a CNH com a foto mais nítida" : "Explique o motivo..."}
                  rows={3}
                  className="w-full rounded-xl border bg-card p-2 text-xs outline-none focus:border-primary"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setActionMode(null); setMessage(""); }} className="rounded-xl border py-2 text-xs font-semibold hover:bg-muted">Cancelar</button>
                <button onClick={handleConfirm} className="rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground hover:opacity-90">Confirmar</button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!actionMode && (
            <div className="border-t bg-card p-3 shrink-0 grid grid-cols-2 gap-2">
              <button onClick={() => setActionMode("approve")} className="flex items-center justify-center gap-1.5 rounded-xl bg-success py-3 text-xs font-bold text-success-foreground hover:opacity-90">
                <CheckCircle className="h-4 w-4" /> Aprovar
              </button>
              <button onClick={() => setActionMode("request_docs")} className="flex items-center justify-center gap-1.5 rounded-xl bg-info py-3 text-xs font-bold text-info-foreground hover:opacity-90">
                <FileWarning className="h-4 w-4" /> Pedir docs
              </button>
              <button onClick={() => setActionMode("reject")} className="flex items-center justify-center gap-1.5 rounded-xl bg-warning py-3 text-xs font-bold text-warning-foreground hover:opacity-90">
                <XCircle className="h-4 w-4" /> Reprovar
              </button>
              <button onClick={() => setActionMode("block")} className="flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-3 text-xs font-bold text-destructive-foreground hover:opacity-90">
                <Ban className="h-4 w-4" /> Bloquear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image zoom overlay */}
      {zoomImg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={() => setZoomImg(null)}>
          <button className="absolute top-4 right-4 rounded-full bg-card p-2"><X className="h-5 w-5" /></button>
          <img src={zoomImg} alt="Zoom" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}

      {editing && (
        <EditDriverModal
          driver={driver}
          onClose={() => setEditing(false)}
          onSaved={() => onRefresh?.()}
        />
      )}
    </>
  );
};

export default DriverDetailsModal;
