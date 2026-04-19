/**
 * CentralChat — chat do usuário com a Central de Suporte.
 * Lista tickets do usuário e abre uma thread de mensagens (support_messages)
 * quando clicado. Permite ao usuário responder ao mesmo ticket enquanto aberto.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Plus, Headset, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  onBack: () => void;
}

const CentralChat = ({ onBack }: Props) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [unreadByTicket, setUnreadByTicket] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // criar novo
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // thread aberta
  const [openTicket, setOpenTicket] = useState<any | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const loadTickets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(50);
    setTickets(data || []);

    // contagem de não-lidas por ticket
    const ids = (data || []).map((t) => t.id);
    if (ids.length) {
      const { data: msgs } = await supabase
        .from("support_messages")
        .select("ticket_id")
        .in("ticket_id", ids)
        .eq("sender_role", "admin")
        .eq("is_read_by_user", false);
      const map: Record<string, number> = {};
      (msgs || []).forEach((m: any) => { map[m.ticket_id] = (map[m.ticket_id] || 0) + 1; });
      setUnreadByTicket(map);
    } else {
      setUnreadByTicket({});
    }
    setLoading(false);
  };

  const loadThread = async (ticketId: string) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setThread(data || []);
    // marca lido
    await supabase.rpc("user_mark_ticket_read" as any, { _ticket_id: ticketId });
    setUnreadByTicket((u) => ({ ...u, [ticketId]: 0 }));
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => {
    loadTickets();
    if (!user) return;
    const ch = supabase
      .channel(`central-chat-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` }, loadTickets)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload: any) => {
        const m = payload.new;
        if (openTicket && m.ticket_id === openTicket.id) {
          setThread((t) => [...t, m]);
          if (m.sender_role === "admin") {
            supabase.rpc("user_mark_ticket_read" as any, { _ticket_id: openTicket.id });
          }
          setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        } else {
          loadTickets();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, openTicket?.id]);

  const sendNew = async () => {
    if (!user) return;
    const s = subject.trim();
    const m = message.trim();
    if (s.length < 3) return toast.error("Informe um assunto (mín. 3 caracteres)");
    if (m.length < 5) return toast.error("Escreva sua mensagem (mín. 5 caracteres)");
    setSending(true);
    const { data, error } = await supabase.from("support_tickets").insert({
      user_id: user.id, subject: s, message: m, priority: "medium", status: "open", category: "central",
    }).select().single();
    if (error || !data) {
      setSending(false);
      return toast.error("Erro ao enviar: " + (error?.message || ""));
    }
    // primeira mensagem da thread
    await supabase.from("support_messages").insert({
      ticket_id: data.id, sender_id: user.id, sender_role: "user", message: m,
      is_read_by_user: true, is_read_by_admin: false,
    });
    setSending(false);
    toast.success("Mensagem enviada para a Central");
    setSubject(""); setMessage(""); setComposing(false);
    loadTickets();
  };

  const sendReply = async () => {
    if (!openTicket) return;
    const m = reply.trim();
    if (!m) return;
    setSending(true);
    const { error } = await supabase.rpc("user_add_ticket_message" as any, {
      _ticket_id: openTicket.id, _message: m,
    });
    setSending(false);
    if (error) return toast.error("Erro: " + error.message);
    setReply("");
  };

  // ===== Thread aberta =====
  if (openTicket) {
    const closed = openTicket.status === "closed";
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
          <button onClick={() => { setOpenTicket(null); setThread([]); loadTickets(); }} className="rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Headset className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{openTicket.subject}</p>
            <p className="text-[10px] text-muted-foreground">
              {closed ? "Encerrado" : openTicket.status === "answered" ? "Respondido" : "Aguardando"}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {thread.map((m) => (
            <div key={m.id} className={`flex ${m.sender_role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                m.sender_role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border rounded-bl-sm"
              }`}>
                <p className="text-[10px] font-bold opacity-70 mb-0.5">
                  {m.sender_role === "user" ? "Você" : "Central de Suporte"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                <p className="text-[9px] opacity-60 mt-1 text-right">
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div ref={threadEndRef} />
        </div>

        {closed ? (
          <footer className="border-t bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            Este ticket foi encerrado. Abra um novo chamado se precisar.
          </footer>
        ) : (
          <footer className="border-t bg-card p-3 flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !sending) sendReply(); }}
              placeholder="Sua mensagem..."
              className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={sendReply} disabled={sending || !reply.trim()} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </footer>
        )}
      </div>
    );
  }

  // ===== Lista de tickets =====
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
          <button onClick={() => setComposing(true)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Nova
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {composing ? (
          <div className="space-y-3 rounded-2xl border bg-card p-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Assunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: Problema no pagamento"
                className="mt-1 w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Mensagem</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Descreva sua dúvida..."
                className="mt-1 w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setComposing(false); setSubject(""); setMessage(""); }} className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
                Cancelar
              </button>
              <button onClick={sendNew} disabled={sending} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
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
            <button onClick={() => setComposing(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              <Plus className="h-4 w-4" /> Iniciar conversa
            </button>
          </div>
        ) : (
          tickets.map((t) => {
            const unread = unreadByTicket[t.id] || 0;
            return (
              <button key={t.id} onClick={() => { setOpenTicket(t); loadThread(t.id); }}
                className="w-full text-left rounded-2xl border bg-card p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{t.subject}</p>
                      {unread > 0 && (
                        <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(t.last_message_at || t.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      t.status === "open" ? "bg-info/15 text-info"
                      : t.status === "answered" ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground"
                    }`}>
                      {t.status === "open" ? "Aguardando" : t.status === "answered" ? "Respondido" : "Encerrado"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CentralChat;
