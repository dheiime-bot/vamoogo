import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Search, X, Filter, AlertTriangle, Send, ExternalLink, Headset, Car } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

type StatusFilter = "all" | "open" | "answered" | "closed";
type CategoryFilter = "all" | "central" | "ride";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const CATEGORY_LABEL: Record<string, string> = {
  central: "Central",
  lost_item: "Objeto perdido",
  billing: "Cobrança",
  behavior: "Comportamento",
  safety: "Segurança",
  route: "Rota",
  ride_other: "Corrida — outro",
};

const AdminSupport = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, { full_name?: string; phone?: string; email?: string }>>({});
  const [rides, setRides] = useState<Record<string, { ride_code?: string; status?: string }>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  // thread aberta
  const [openTicket, setOpenTicket] = useState<any | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300);
    setTickets(data || []);

    const userIds = Array.from(new Set((data || []).map((t: any) => t.user_id).filter(Boolean)));
    const rideIds = Array.from(new Set((data || []).map((t: any) => t.ride_id).filter(Boolean)));

    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("user_id, full_name, phone, email").in("user_id", userIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p; });
      setUsers(map);
    }
    if (rideIds.length) {
      const { data: rs } = await supabase.from("rides").select("id, ride_code, status").in("id", rideIds);
      const map: Record<string, any> = {};
      (rs || []).forEach((r: any) => { map[r.id] = r; });
      setRides(map);
    }
  };

  useEffect(() => { fetchTickets(); }, []);
  useRealtimeRefresh("support_tickets", fetchTickets, "admin-support");
  useRealtimeRefresh("support_messages", () => {
    fetchTickets();
    if (openTicket) loadThread(openTicket.id, false);
  }, "admin-support-msgs");

  const loadThread = async (ticketId: string, scroll = true) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setThread(data || []);
    // marca lidas pelo admin
    await supabase.from("support_messages")
      .update({ is_read_by_admin: true })
      .eq("ticket_id", ticketId)
      .eq("sender_role", "user")
      .eq("is_read_by_admin", false);
    if (scroll) setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const sendReply = async (close = false) => {
    if (!openTicket) return;
    const m = reply.trim();
    if (!m) return toast.error("Escreva uma resposta");
    setBusyId(openTicket.id);
    const { error } = await supabase.rpc("admin_add_ticket_message" as any, {
      _ticket_id: openTicket.id, _message: m, _close: close,
    });
    setBusyId(null);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(close ? "Resposta enviada e ticket encerrado" : "Resposta enviada");
    setReply("");
    if (close) { setOpenTicket(null); setThread([]); }
    fetchTickets();
  };

  const closeTicket = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("admin_close_ticket" as any, { _ticket_id: id });
    setBusyId(null);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Ticket encerrado");
    setOpenTicket(null); setThread([]);
    fetchTickets();
  };

  const changePriority = async (id: string, priority: string) => {
    const { error } = await supabase.rpc("admin_update_ticket_priority" as any, {
      _ticket_id: id, _priority: priority,
    });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Prioridade atualizada");
    fetchTickets();
  };

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter === "central" && t.category !== "central") return false;
      if (categoryFilter === "ride" && (t.category === "central" || !t.ride_id)) return false;
      if (search) {
        const q = search.toLowerCase().trim();
        const u = users[t.user_id];
        const r = rides[t.ride_id];
        const haystack = [t.subject, t.message, u?.full_name, u?.email, u?.phone, r?.ride_code].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, categoryFilter, search, users, rides]);

  const counts = useMemo(() => ({
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    answered: tickets.filter((t) => t.status === "answered").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  }), [tickets]);

  const priorityStyle: Record<string, string> = {
    urgent: "bg-destructive text-destructive-foreground",
    high: "bg-destructive/15 text-destructive",
    medium: "bg-warning/15 text-warning",
    low: "bg-muted text-muted-foreground",
  };

  // ===== Thread aberta no admin =====
  if (openTicket) {
    const u = users[openTicket.user_id] || {};
    const r = openTicket.ride_id ? rides[openTicket.ride_id] : null;
    const closed = openTicket.status === "closed";
    return (
      <AdminLayout title="Conversa" actions={
        <button onClick={() => { setOpenTicket(null); setThread([]); }} className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar à lista
        </button>
      }>
        <div className="rounded-2xl border bg-card p-4 mb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                {openTicket.priority === "urgent" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <p className="font-bold">{openTicket.subject}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {u.full_name || "Usuário"}{u.phone ? ` • ${u.phone}` : ""}{u.email ? ` • ${u.email}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                  {CATEGORY_LABEL[openTicket.category] || openTicket.category}
                </span>
                {r?.ride_code && (
                  <a href="/admin/rides" className="inline-flex items-center gap-1 rounded-full bg-info/10 text-info px-2 py-0.5 text-[10px] font-bold">
                    <Car className="h-3 w-3" /> {r.ride_code}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
            <select value={openTicket.priority} onChange={(e) => changePriority(openTicket.id, e.target.value)}
              disabled={closed}
              className={`rounded-full px-2.5 py-1 text-xs font-bold outline-none cursor-pointer ${priorityStyle[openTicket.priority] || priorityStyle.medium} disabled:opacity-60`}>
              {PRIORITY_OPTIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border bg-card flex flex-col" style={{ height: "60vh" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {thread.map((m) => (
              <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  m.sender_role === "admin"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                }`}>
                  <p className="text-[10px] font-bold opacity-70 mb-0.5">
                    {m.sender_role === "admin" ? "Você (Central)" : u.full_name || "Usuário"}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  <p className="text-[9px] opacity-60 mt-1 text-right">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>

          {closed ? (
            <div className="border-t bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              Ticket encerrado.
            </div>
          ) : (
            <div className="border-t bg-card p-3">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Sua resposta..."
                className="w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30" />
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => closeTicket(openTicket.id)} disabled={busyId === openTicket.id}
                  className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-50">
                  Encerrar sem responder
                </button>
                <button onClick={() => sendReply(true)} disabled={busyId === openTicket.id || !reply.trim()}
                  className="rounded-lg border border-success/40 px-3 py-2 text-xs font-bold text-success hover:bg-success/10 disabled:opacity-50">
                  Responder e encerrar
                </button>
                <button onClick={() => sendReply(false)} disabled={busyId === openTicket.id || !reply.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" /> Enviar
                </button>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    );
  }

  // ===== Lista =====
  return (
    <AdminLayout title="Suporte" actions={<span className="text-sm text-muted-foreground">{filtered.length} de {tickets.length}</span>}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar por assunto, mensagem, nome, contato ou código da corrida..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none" />
          {search && (
            <button onClick={() => setSearch("")} className="rounded-full p-1 hover:bg-muted">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Categoria */}
        <div className="flex gap-1 overflow-x-auto">
          {([
            ["all", "Todos"],
            ["central", "Central"],
            ["ride", "Por corrida"],
          ] as const).map(([value, label]) => (
            <button key={value} onClick={() => setCategoryFilter(value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-1.5 ${
                categoryFilter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
              {value === "central" ? <Headset className="h-3.5 w-3.5" /> : value === "ride" ? <Car className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
              {label}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex gap-1 overflow-x-auto">
          {([
            ["open", `Abertos (${counts.open})`],
            ["answered", `Respondidos (${counts.answered})`],
            ["closed", `Encerrados (${counts.closed})`],
            ["all", `Todos (${counts.all})`],
          ] as const).map(([value, label]) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${
                statusFilter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={MessageCircle} title="Nenhum ticket encontrado" description="Solicitações abertas pelos usuários aparecerão aqui." />
      )}

      <div className="space-y-3 mt-3">
        {filtered.map((t) => {
          const u = users[t.user_id] || {};
          const r = t.ride_id ? rides[t.ride_id] : null;
          return (
            <button key={t.id} onClick={() => { setOpenTicket(t); loadThread(t.id); }}
              className="w-full text-left rounded-2xl border bg-card p-5 shadow-sm hover:bg-muted/30 transition-colors animate-fade-in">
              <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-bold flex items-center gap-1.5">
                    {t.priority === "urgent" && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                    {t.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.full_name || "Usuário"}{u.phone ? ` • ${u.phone}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                      {CATEGORY_LABEL[t.category] || t.category}
                    </span>
                    {r?.ride_code && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-info/10 text-info px-2 py-0.5 text-[10px] font-bold">
                        <Car className="h-3 w-3" /> {r.ride_code}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(t.last_message_at || t.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityStyle[t.priority] || priorityStyle.medium}`}>
                    {PRIORITY_OPTIONS.find((p) => p.value === t.priority)?.label || t.priority}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    t.status === "open" ? "bg-info/15 text-info"
                    : t.status === "answered" ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {t.status === "open" ? "Aberto" : t.status === "answered" ? "Respondido" : "Encerrado"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-foreground/80 line-clamp-2">{t.message}</p>
            </button>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default AdminSupport;
