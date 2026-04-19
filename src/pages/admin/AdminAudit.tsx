import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ScrollText, Search, X, Calendar, User as UserIcon, Filter,
  Car, Users, Headphones, Shield, ChevronDown,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

type EntityType = "all" | "ride" | "driver" | "passenger" | "support_ticket";

const ENTITY_META: Record<string, { label: string; icon: typeof Car; bg: string; color: string }> = {
  ride: { label: "Corrida", icon: Car, bg: "bg-primary/10", color: "text-primary" },
  driver: { label: "Motorista", icon: UserIcon, bg: "bg-success/10", color: "text-success" },
  passenger: { label: "Passageiro", icon: Users, bg: "bg-info/10", color: "text-info" },
  support_ticket: { label: "Ticket", icon: Headphones, bg: "bg-warning/10", color: "text-warning" },
};

const ACTION_LABEL: Record<string, string> = {
  cancel_ride: "Cancelou corrida",
  adjust_price: "Ajustou valor da corrida",
  mark_issue: "Marcou problema",
  resolve_payment: "Resolveu pagamento",
  add_note: "Adicionou observação",
  update_status: "Alterou status",
  online_block: "Impediu de ficar online",
  online_unblock: "Liberou para ficar online",
  update_data: "Editou dados",
  mark_suspect: "Marcou como suspeito",
  unmark_suspect: "Removeu suspeita",
  respond_ticket: "Respondeu ticket",
  update_priority: "Alterou prioridade",
  close_ticket: "Fechou ticket",
};

const AdminAudit = () => {
  const [params] = useSearchParams();
  const initialEntity = (params.get("entity_type") as EntityType) || "all";
  const initialId = params.get("entity") || "";

  const [logs, setLogs] = useState<any[]>([]);
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [search, setSearch] = useState(initialId);
  const [entityType, setEntityType] = useState<EntityType>(initialEntity);
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);

    // Date filter
    if (dateRange !== "all") {
      const days = dateRange === "today" ? 1 : dateRange === "7d" ? 7 : 30;
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      query = query.gte("created_at", since);
    }
    if (entityType !== "all") query = query.eq("entity_type", entityType);

    const { data } = await query;
    setLogs(data || []);

    // Carrega nomes dos admins envolvidos
    const ids = Array.from(new Set((data || []).map((l: any) => l.admin_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      setAdmins(map);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [entityType, dateRange]);
  useRealtimeRefresh("audit_logs", load, "admin-audit");

  const adminOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => { if (l.admin_id) set.add(l.admin_id); });
    return Array.from(set);
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (adminFilter !== "all" && l.admin_id !== adminFilter) return false;
      if (search) {
        const q = search.toLowerCase().trim();
        const haystack = [
          l.entity_id,
          l.action,
          ACTION_LABEL[l.action],
          admins[l.admin_id],
          JSON.stringify(l.details || {}),
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, adminFilter, search, admins]);

  return (
    <AdminLayout
      title="Auditoria"
      actions={<span className="text-sm text-muted-foreground">{filtered.length} de {logs.length}</span>}
    >
      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar por ID, ação, admin ou detalhe..."
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
        <div className="flex flex-wrap gap-2">
          {/* Entidade */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {([
              ["all", "Tudo", Filter],
              ["ride", "Corridas", Car],
              ["driver", "Motoristas", UserIcon],
              ["passenger", "Passageiros", Users],
              ["support_ticket", "Tickets", Headphones],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => setEntityType(value as EntityType)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-1.5 ${
                  entityType === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Período */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {([
              ["today", "Hoje"],
              ["7d", "7 dias"],
              ["30d", "30 dias"],
              ["all", "Tudo"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-1.5 ${
                  dateRange === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Admin */}
          {adminOptions.length > 1 && (
            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="rounded-lg bg-muted px-3 py-2 text-xs font-medium outline-none"
            >
              <option value="all">Todos os admins</option>
              {adminOptions.map((id) => (
                <option key={id} value={id}>{admins[id] || id.slice(0, 8)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={ScrollText} title="Nenhum log de auditoria" description="Ações administrativas serão registradas aqui automaticamente." />
      )}

      <div className="space-y-2">
        {filtered.map((log) => {
          const meta = ENTITY_META[log.entity_type] || { label: log.entity_type, icon: Shield, bg: "bg-muted", color: "text-muted-foreground" };
          const Icon = meta.icon;
          const adminName = admins[log.admin_id] || log.admin_id?.slice(0, 8) || "Admin";
          const open = openId === log.id;
          const hasDetails = log.details && Object.keys(log.details).length > 0;

          return (
            <div key={log.id} className="rounded-xl border bg-card p-3 animate-fade-in">
              <button
                onClick={() => setOpenId(open ? null : log.id)}
                className="flex items-start gap-3 w-full text-left"
              >
                <div className={`rounded-lg p-2 ${meta.bg}`}>
                  <Icon className={`h-4 w-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">{ACTION_LABEL[log.action] || log.action}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">{adminName}</span>
                    {" • "}
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </p>
                  {log.entity_id && (
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
                      ID: {log.entity_id}
                    </p>
                  )}
                </div>
                {hasDetails && (
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                )}
              </button>
              {open && hasDetails && (
                <pre className="text-[11px] text-muted-foreground mt-2 bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default AdminAudit;
