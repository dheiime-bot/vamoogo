import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, X, Filter, AlertTriangle } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

type StatusFilter = "all" | "open" | "answered" | "closed";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const AdminSupport = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, { full_name?: string; phone?: string; email?: string }>>({});
  const [response, setResponse] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTickets = async () => {
    const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(200);
    setTickets(data || []);

    const ids = Array.from(new Set((data || []).map((t: any) => t.user_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", ids);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p; });
      setUsers(map);
    }
  };

  useEffect(() => { fetchTickets(); }, []);
  useRealtimeRefresh("support_tickets", fetchTickets, "admin-support");

  const respond = async (id: string, close = false) => {
    const text = (response[id] || "").trim();
    if (!text) return toast.error("Escreva uma resposta");
    setBusyId(id);
    const { error } = await supabase.rpc("admin_respond_ticket" as any, {
      _ticket_id: id, _response: text, _close: close,
    });
    setBusyId(null);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(close ? "Resposta enviada e ticket fechado" : "Resposta enviada");
    setResponse((r) => ({ ...r, [id]: "" }));
    fetchTickets();
  };

  const closeTicket = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("admin_close_ticket" as any, { _ticket_id: id });
    setBusyId(null);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Ticket fechado");
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
      if (search) {
        const q = search.toLowerCase().trim();
        const u = users[t.user_id];
        const haystack = [t.subject, t.message, u?.full_name, u?.email, u?.phone].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, search, users]);

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

  return (
    <AdminLayout
      title="Suporte"
      actions={<span className="text-sm text-muted-foreground">{filtered.length} de {tickets.length}</span>}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar por assunto, mensagem, nome ou contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="rounded-full p-1 hover:bg-muted">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {([
            ["open", `Abertos (${counts.open})`],
            ["answered", `Respondidos (${counts.answered})`],
            ["closed", `Fechados (${counts.closed})`],
            ["all", `Todos (${counts.all})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-1.5 ${
                statusFilter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Filter className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={MessageCircle} title="Nenhum ticket encontrado" description="Solicitações abertas pelos usuários aparecerão aqui." />
      )}

      <div className="space-y-3">
        {filtered.map((t) => {
          const u = users[t.user_id] || {};
          return (
            <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-sm animate-fade-in">
              <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-bold flex items-center gap-1.5">
                    {t.priority === "urgent" && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                    {t.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.full_name || "Usuário"}{u.phone ? ` • ${u.phone}` : ""}{u.email ? ` • ${u.email}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    value={t.priority}
                    onChange={(e) => changePriority(t.id, e.target.value)}
                    disabled={t.status === "closed"}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold outline-none cursor-pointer ${priorityStyle[t.priority] || priorityStyle.medium} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    t.status === "open" ? "bg-info/15 text-info"
                    : t.status === "answered" ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {t.status === "open" ? "Aberto" : t.status === "answered" ? "Respondido" : "Fechado"}
                  </span>
                </div>
              </div>

              <p className="text-sm text-foreground/90 mb-3 whitespace-pre-wrap">{t.message}</p>

              {t.admin_response && (
                <div className="rounded-lg bg-success/5 border border-success/20 p-3 mb-3">
                  <p className="text-xs font-semibold text-success mb-1">Resposta do suporte:</p>
                  <p className="text-sm whitespace-pre-wrap">{t.admin_response}</p>
                </div>
              )}

              {t.status !== "closed" && (
                <div className="space-y-2">
                  <textarea
                    value={response[t.id] || ""}
                    onChange={(e) => setResponse((r) => ({ ...r, [t.id]: e.target.value }))}
                    placeholder="Escreva sua resposta..."
                    rows={2}
                    className="w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => closeTicket(t.id)}
                      disabled={busyId === t.id}
                      className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Fechar sem resposta
                    </button>
                    <button
                      onClick={() => respond(t.id, true)}
                      disabled={busyId === t.id || !(response[t.id] || "").trim()}
                      className="rounded-lg border border-success/40 px-3 py-2 text-xs font-bold text-success hover:bg-success/10 disabled:opacity-50"
                    >
                      Responder e fechar
                    </button>
                    <button
                      onClick={() => respond(t.id, false)}
                      disabled={busyId === t.id || !(response[t.id] || "").trim()}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      Responder
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default AdminSupport;
