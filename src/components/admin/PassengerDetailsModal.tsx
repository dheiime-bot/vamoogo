import { useEffect, useState } from "react";
import { X, User as UserIcon, Phone, Mail, FileText, Calendar, ShieldCheck, Hash, AlertCircle } from "lucide-react";
import { formatDateBR } from "@/lib/brFormat";
import { resolveStorageUrl } from "@/lib/resolveStorageUrl";

interface Props {
  passenger: any;
  onClose: () => void;
}

const PassengerDetailsModal = ({ passenger, onClose }: Props) => {
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});

  useEffect(() => {
    const fields: Array<[string, string | null]> = [
      ["selfie", passenger.selfie_url],
      ["selfie_signup", passenger.selfie_signup_url],
    ];
    (async () => {
      const map: Record<string, string> = {};
      for (const [key, url] of fields) {
        const resolved = await resolveStorageUrl("selfies", url);
        if (resolved) map[key] = resolved;
      }
      setSigned(map);
    })();
  }, [passenger]);

  const ImageBlock = ({ url, label }: { url?: string; label: string }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <UserIcon className="h-3.5 w-3.5" /> {label}
      </p>
      {url ? (
        <button onClick={() => setZoomImg(url)} className="block w-full aspect-square rounded-xl overflow-hidden border bg-muted hover:border-primary transition-colors">
          <img src={url} alt={label} className="w-full h-full object-cover" />
        </button>
      ) : (
        <div className="aspect-square rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Não enviado</p>
        </div>
      )}
    </div>
  );

  const Field = ({ icon: Icon, label, value, mono }: { icon: any; label: string; value: any; mono?: boolean }) => (
    <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={`text-xs font-medium truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
        <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-display">{passenger.full_name || "Passageiro"}</h2>
                {passenger.status && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                    passenger.status === "bloqueado" ? "bg-destructive/10 text-destructive"
                    : passenger.status === "suspenso" ? "bg-warning/10 text-warning"
                    : "bg-success/10 text-success"
                  }`}>{passenger.status}</span>
                )}
                {passenger.is_suspect && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-semibold flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Suspeito
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">ID {passenger.user_id?.slice(0, 8)}…</p>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Dados pessoais</p>
              <div className="grid grid-cols-2 gap-2">
                <Field icon={UserIcon} label="CPF" value={passenger.cpf} mono />
                <Field icon={Calendar} label="Nascimento" value={passenger.birth_date ? formatDateBR(passenger.birth_date.split("-").reverse().join("")) : "—"} />
                <Field icon={Phone} label="Telefone" value={passenger.phone} />
                <Field icon={ShieldCheck} label="Telefone OTP" value={passenger.phone_verified ? "Verificado" : "Não verificado"} />
                <div className="col-span-2"><Field icon={Mail} label="E-mail" value={passenger.email} /></div>
                <Field icon={Hash} label="ID interno" value={passenger.id?.slice(0, 8) + "…"} mono />
                <Field icon={Calendar} label="Cadastrado em" value={passenger.created_at ? new Date(passenger.created_at).toLocaleDateString("pt-BR") : "—"} />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Selfies</p>
              <div className="grid grid-cols-2 gap-3">
                <ImageBlock url={signed.selfie_signup} label="Selfie do cadastro" />
                <ImageBlock url={signed.selfie} label="Selfie atual" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {zoomImg && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setZoomImg(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomImg(null); }}
            className="absolute top-4 right-4 rounded-full bg-card p-2 hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={zoomImg}
            alt="Zoom"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        </div>
      )}
    </>
  );
};

export default PassengerDetailsModal;