/**
 * ReportRideIssueModal — modal para reportar um problema vinculado a uma corrida.
 * Cria um support_ticket com category específica e ride_id, e a primeira mensagem
 * em support_messages para iniciar a thread com a Central.
 */
import { useState } from "react";
import { X, Send, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  rideId: string;
  rideCode: string | null;
  /** completed_at ou cancelled_at — usado para validar janela de 3h */
  rideEndedAt?: string | null;
}

/** Janela de 3 horas após o término da corrida para abrir um chamado vinculado */
export const REPORT_WINDOW_HOURS = 3;
export const isWithinReportWindow = (endedAtIso?: string | null) => {
  if (!endedAtIso) return true; // se ainda não terminou, libera
  const ended = new Date(endedAtIso).getTime();
  if (Number.isNaN(ended)) return true;
  return Date.now() - ended < REPORT_WINDOW_HOURS * 60 * 60 * 1000;
};

const ISSUE_TYPES = [
  { value: "lost_item", label: "Objeto perdido", priority: "high" as const },
  { value: "billing", label: "Cobrança indevida", priority: "high" as const },
  { value: "behavior", label: "Mau comportamento", priority: "high" as const },
  { value: "safety", label: "Problema de segurança", priority: "urgent" as const },
  { value: "route", label: "Problema com a rota", priority: "medium" as const },
  { value: "ride_other", label: "Outro problema", priority: "medium" as const },
];

const ReportRideIssueModal = ({ open, onClose, rideId, rideCode, rideEndedAt }: Props) => {
  const { user } = useAuth();
  const [type, setType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!user) return;
    if (!isWithinReportWindow(rideEndedAt)) {
      return toast.error("Prazo de 3 horas para reportar expirou. Use o Chat com a Central.");
    }
    if (!type) return toast.error("Selecione o tipo de problema");
    if (description.trim().length < 10) return toast.error("Descreva com pelo menos 10 caracteres");

    const issue = ISSUE_TYPES.find((i) => i.value === type)!;
    const subject = `${issue.label} — Corrida ${rideCode || rideId.slice(0, 8).toUpperCase()}`;
    const text = description.trim();

    setSending(true);
    const { data, error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject,
      message: text,
      priority: issue.priority,
      status: "open",
      category: issue.value,
      ride_id: rideId,
    }).select().single();

    if (error || !data) {
      setSending(false);
      return toast.error("Erro ao enviar: " + (error?.message || ""));
    }

    await supabase.from("support_messages").insert({
      ticket_id: data.id, sender_id: user.id, sender_role: "user", message: text,
      is_read_by_user: true, is_read_by_admin: false,
    });

    setSending(false);
    toast.success("Problema reportado. A Central irá entrar em contato pelo Chat com a Central.");
    setType(""); setDescription("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card shadow-xl animate-slide-up">
        <header className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-bold">Reportar problema</p>
              <p className="text-[10px] text-muted-foreground">
                Corrida {rideCode || rideId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-2 block">O que aconteceu?</label>
            <div className="grid grid-cols-2 gap-2">
              {ISSUE_TYPES.map((opt) => (
                <button key={opt.value} onClick={() => setType(opt.value)}
                  className={`rounded-lg border-2 p-2.5 text-xs font-semibold text-left transition-colors ${
                    type === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-foreground hover:bg-muted"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Descreva o problema</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              placeholder={type === "lost_item" ? "Ex.: Esqueci minha mochila preta no banco de trás..." : "Conte o máximo de detalhes possível..."}
              className="w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        <footer className="flex gap-2 justify-end border-t p-4">
          <button onClick={onClose} className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
            Cancelar
          </button>
          <button onClick={submit} disabled={sending} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /> {sending ? "Enviando..." : "Enviar"}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ReportRideIssueModal;
