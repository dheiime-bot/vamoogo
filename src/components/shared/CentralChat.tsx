/**
 * CentralChat — modal de chat do usuário (passageiro ou motorista) com a Central de Suporte.
 * Lista tickets do usuário (mais recentes primeiro) e permite criar um novo ticket.
 * Mensagens trafegam pela tabela support_tickets (admin responde via /admin/support).
 */
import { useEffect, useState } from "react";
import { ArrowLeft, Send, Plus, Headset } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  onBack: () => void;
}

const CentralChat = ({ onBack }: Props) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`central-chat-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const send = async () => {
    if (!user) return;
    const s = subject.trim();
    const m = message.trim();
    if (s.length < 3) return toast.error("Informe um assunto (mín. 3 caracteres)");
    if (m.length < 5) return toast.error("Escreva sua mensagem (mín. 5 caracteres)");
    setSending(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id, subject: s, message: m, priority: "medium", status: "open",
    });
    setSending(false);
    if (error) return toast.error("Erro ao enviar: " + error.message);
    toast.success("Mensagem enviada para a Central");
    setSubject(""); setMessage(""); setComposing(false);
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <button onClick={onBack} className="rounded-full p-2 hover:bg-muted" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Headset className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Central de Suporte</p>
          <p className="text-xs text-muted-foreground">Atendimento Vamoo</p>
        </div>
        {!composing && (
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Nova
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {composing ? (
          <div className="space-y-3 rounded-2xl border bg-card p-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Assunto</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex.: Problema no pagamento"
                className="mt-1 w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Mensagem</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Descreva sua dúvida ou problema..."
                className="mt-1 w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setComposing(false); setSubject(""); setMessage(""); }}
                className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> {sending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        ) : loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16">
            <Headset className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Nenhuma conversa com a Central ainda</p>
            <button
              onClick={() => setComposing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Iniciar conversa
            </button>
          </div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold">{t.subject}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  t.status === "open" ? "bg-info/15 text-info"
                  : t.status === "answered" ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {t.status === "open" ? "Aguardando" : t.status === "answered" ? "Respondido" : "Encerrado"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {new Date(t.created_at).toLocaleString("pt-BR")}
              </p>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[10px] font-bold text-muted-foreground mb-1">Você</p>
                <p className="text-sm whitespace-pre-wrap">{t.message}</p>
              </div>
              {t.admin_response && (
                <div className="rounded-lg bg-success/5 border border-success/20 p-3">
                  <p className="text-[10px] font-bold text-success mb-1">Central de Suporte</p>
                  <p className="text-sm whitespace-pre-wrap">{t.admin_response}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CentralChat;
