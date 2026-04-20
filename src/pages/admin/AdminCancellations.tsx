import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  XCircle, Unlock, Ban, Eye, Clock, Search, X,
  TrendingUp, Users, Car, Loader2, RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import StatCard from "@/components/shared/StatCard";
import RideDetailsModal from "@/components/admin/rides/RideDetailsModal";

const brDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

type Period = "today" | "7d" | "30d" | "all";
type WhoFilter = "all" | "passenger" | "driver";

interface Cancelled {
  id: string;
  ride_code: string;
  cancelled_at: string;
  cancelled_by: string | null;
  passenger_id: string;
  driver_id: string | null;
  status: string;
  admin_notes: string | null;
  origin_address: string;
  destination_address: string;
  price: number | null;
  passenger_name?: string;
  driver_name?: string;
  who: "passenger" | "driver" | "system";
}

interface BlockedUser {
  user_id: string;
  full_name: string;
  cancellation_block_until: string;
  cancellation_block_count: number;
  daily_cancellations: number;
  kind: "passenger" | "driver";
}

interface RankItem {
  user_id: string;
  full_name: string;
  total: number;
  kind: "passenger" | "driver";
}

const periodStart = (p: Period) => {
  const d = new Date();
  if (p === "today") { d.setHours(0,0,0,0); return d.toISOString(); }
  if (p === "7d") { d.setDate(d.getDate() - 7); return d.toISOString(); }
  if (p === "30d") { d.setDate(d.getDate() - 30); return d.toISOString(); }
  return "1970-01-01T00:00:00Z";
};

const REASON_TAGS = [
  { key: "passageiro_no_show", label: "Passageiro não veio", match: /passageiro não veio|passenger_no_show|passageiro não apareceu/i },
  { key: "motorista_no_show", label: "Motorista não veio", match: /motorista não veio|driver_no_show/i },
  { key: "wait", label: "Demora", match: /demora|long_wait/i },
  { key: "changed_mind", label: "Mudei de ideia", match: /mudei de ideia|changed_mind/i },
  { key: "wrong_address", label: "Endereço errado", match: /endereço|wrong_address|wrong_pickup/i },
  { key: "vehicle", label: "Veículo", match: /veículo|vehicle_problem/i },
  { key: "system", label: "Sistema", match: /sistema|system_error/i },
];
const classifyReason = (notes: string | null) => {
  if (!notes) return "outros";
  const tag = REASON_TAGS.find((t) => t.match.test(notes));
  return tag ? tag.key : "outros";
};
const reasonLabel = (key: string) =>
  REASON_TAGS.find((t) => t.key === key)?.label || "Outros";

const AdminCancellations = () => {
  const [period, setPeriod] = useState<Period>("7d");
  const [who, setWho] = useState<WhoFilter>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [rides, setRides] = useState<Cancelled[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [rankPassengers, setRankPassengers] = useState<RankItem[]>([]);
  const [rankDrivers, setRankDrivers] = useState<RankItem[]>([]);

  const [detailsRide, setDetailsRide] = useState<string | null>(null);
  const [blockDialog, setBlockDialog] = useState<{ user_id: string; name: string; kind: "driver" | "passenger" } | null>(null);
  const [blockHours, setBlockHours] = useState(2);
  const [blockReason, setBlockReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const since = periodStart(period);

    // 1) Corridas canceladas no período
    const { data: rideRows } = await supabase
      .from("rides")
      .select("id, ride_code, cancelled_at, cancelled_by, passenger_id, driver_id, status, admin_notes, origin_address, destination_address, price")
      .eq("status", "cancelled")
      .gte("cancelled_at", since)
      .order("cancelled_at", { ascending: false })
      .limit(500);

    const ids = new Set<string>();
    (rideRows || []).forEach((r) => {
      if (r.passenger_id) ids.add(r.passenger_id);
      if (r.driver_id) ids.add(r.driver_id);
    });
    const { data: profs } = ids.size
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", Array.from(ids))
      : { data: [] as any[] };
    const nameMap = new Map<string, string>();
    (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.full_name));

    const enriched: Cancelled[] = (rideRows || []).map((r: any) => {
      let whoVal: Cancelled["who"] = "system";
      if (r.cancelled_by && r.cancelled_by === r.passenger_id) whoVal = "passenger";
      else if (r.cancelled_by && r.driver_id && r.cancelled_by === r.driver_id) whoVal = "driver";
      return {
        ...r,
        passenger_name: nameMap.get(r.passenger_id) || "—",
        driver_name: r.driver_id ? nameMap.get(r.driver_id) || "—" : "—",
        who: whoVal,
      };
    });
    setRides(enriched);

    // 2) Bloqueios ativos
    const nowIso = new Date().toISOString();
    const [{ data: blockedPass }, { data: blockedDrv }] = await Promise.all([
      supabase.from("profiles")
        .select("user_id, full_name, cancellation_block_until, cancellation_block_count, daily_cancellations")
        .gt("cancellation_block_until", nowIso)
        .order("cancellation_block_until", { ascending: true }),
      supabase.from("drivers")
        .select("user_id, cancellation_block_until, cancellation_block_count, daily_cancellations")
        .gt("cancellation_block_until", nowIso)
        .order("cancellation_block_until", { ascending: true }),
    ]);
    const drvIds = (blockedDrv || []).map((d: any) => d.user_id);
    const { data: drvProfiles } = drvIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", drvIds)
      : { data: [] as any[] };
    const drvNameMap = new Map<string, string>();
    (drvProfiles || []).forEach((p: any) => drvNameMap.set(p.user_id, p.full_name));

    const blockedAll: BlockedUser[] = [
      ...(blockedPass || []).map((p: any) => ({ ...p, kind: "passenger" as const })),
      ...(blockedDrv || []).map((d: any) => ({
        user_id: d.user_id,
        full_name: drvNameMap.get(d.user_id) || "—",
        cancellation_block_until: d.cancellation_block_until,
        cancellation_block_count: d.cancellation_block_count,
        daily_cancellations: d.daily_cancellations || 0,
        kind: "driver" as const,
      })),
    ];
    setBlocked(blockedAll);

    // 3) Ranking (a partir das corridas carregadas)
    const passCount = new Map<string, number>();
    const drvCount = new Map<string, number>();
    enriched.forEach((r) => {
      if (r.who === "passenger") passCount.set(r.passenger_id, (passCount.get(r.passenger_id) || 0) + 1);
      if (r.who === "driver" && r.driver_id) drvCount.set(r.driver_id, (drvCount.get(r.driver_id) || 0) + 1);
    });
    const toRank = (m: Map<string, number>, kind: "passenger" | "driver"): RankItem[] =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([user_id, total]) => ({ user_id, total, kind, full_name: nameMap.get(user_id) || "—" }));
    setRankPassengers(toRank(passCount, "passenger"));
    setRankDrivers(toRank(drvCount, "driver"));

    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [period]);

  // Normaliza: "vamoo 1000" / "VAMOO1000" / "1000" → "VAMOO1000"
  const normalizeCode = (s: string) => {
    const cleaned = (s || "").toUpperCase().replace(/\s+/g, "");
    if (/^\d+$/.test(cleaned)) return `VAMOO${cleaned}`;
    return cleaned;
  };

  const filteredRides = useMemo(() => {
    const q = search.toLowerCase().trim();
    const codeQuery = normalizeCode(search);
    return rides.filter((r) => {
      if (who !== "all" && r.who !== who) return false;
      if (reasonFilter !== "all" && classifyReason(r.admin_notes) !== reasonFilter) return false;
      if (q) {
        const matchSearch =
          (codeQuery && r.ride_code?.toUpperCase().includes(codeQuery)) ||
          r.passenger_name?.toLowerCase().includes(q) ||
          r.driver_name?.toLowerCase().includes(q) ||
          r.origin_address?.toLowerCase().includes(q) ||
          r.destination_address?.toLowerCase().includes(q) ||
          r.id?.toLowerCase().startsWith(q) ||
          r.admin_notes?.toLowerCase().includes(q);
        if (!matchSearch) return false;
      }
      return true;
    });
  }, [rides, who, reasonFilter, search]);

  const kpis = useMemo(() => {
    const total = rides.length;
    const byPass = rides.filter((r) => r.who === "passenger").length;
    const byDrv = rides.filter((r) => r.who === "driver").length;
    const byReason = new Map<string, number>();
    rides.forEach((r) => {
      const k = classifyReason(r.admin_notes);
      byReason.set(k, (byReason.get(k) || 0) + 1);
    });
    const top = Array.from(byReason.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, byPass, byDrv, top };
  }, [rides]);

  const handleClearBlock = async (user_id: string, kind: "driver" | "passenger") => {
    if (!confirm("Liberar este bloqueio? O contador do dia também será zerado.")) return;
    const { error } = await supabase.rpc("admin_clear_cancellation_block" as any, { _user_id: user_id, _kind: kind });
    if (error) { toast.error(error.message); return; }
    toast.success("Bloqueio liberado");
    fetchData();
  };

  const handleApplyBlock = async () => {
    if (!blockDialog) return;
    if (!blockReason.trim()) { toast.error("Informe o motivo"); return; }
    setActionLoading(true);
    const { error } = await supabase.rpc("admin_apply_cancellation_block" as any, {
      _user_id: blockDialog.user_id,
      _kind: blockDialog.kind,
      _hours: blockHours,
      _reason: blockReason.trim(),
    });
    setActionLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Bloqueio de ${blockHours}h aplicado`);
    setBlockDialog(null);
    setBlockReason("");
    setBlockHours(2);
    fetchData();
  };

  return (
    <AdminLayout
      title="Cancelamentos"
      actions={
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      }
    >
      {/* Filtros de período */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border bg-card p-1">
          {(["today", "7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p === "today" ? "Hoje" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total cancelados" value={kpis.total.toString()} icon={XCircle} variant="warning" />
        <StatCard title="Por passageiros" value={kpis.byPass.toString()} icon={Users} variant="primary" />
        <StatCard title="Por motoristas" value={kpis.byDrv.toString()} icon={Car} />
        <StatCard title="Bloqueados agora" value={blocked.length.toString()} icon={Ban} variant="warning" />
      </div>

      {/* Breakdown por motivo */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Top motivos
        </h3>
        {kpis.top.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="space-y-2">
            {kpis.top.map(([k, c]) => {
              const pct = kpis.total > 0 ? (c / kpis.total) * 100 : 0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold">{reasonLabel(k)}</span>
                    <span className="text-muted-foreground">{c} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bloqueios ativos */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Ban className="h-4 w-4 text-warning" /> Bloqueios ativos ({blocked.length})
        </h3>
        {blocked.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguém bloqueado no momento. ✅</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2">Usuário</th>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-left py-2 px-2">Bloqueado até</th>
                  <th className="text-left py-2 px-2">Hoje</th>
                  <th className="text-left py-2 px-2">Bloqueios</th>
                  <th className="text-right py-2 px-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {blocked.map((b) => (
                  <tr key={`${b.kind}-${b.user_id}`} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-2 font-semibold">{b.full_name}</td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        b.kind === "driver" ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                      }`}>
                        {b.kind === "driver" ? <Car className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                        {b.kind === "driver" ? "Motorista" : "Passageiro"}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-warning font-semibold">{brDateTime(b.cancellation_block_until)}</td>
                    <td className="py-2 px-2">{b.daily_cancellations}</td>
                    <td className="py-2 px-2">{b.cancellation_block_count}</td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => handleClearBlock(b.user_id, b.kind)}
                        className="inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2 py-1 text-[11px] font-bold text-success hover:bg-success/20"
                      >
                        <Unlock className="h-3 w-3" /> Liberar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rankings */}
      <div className="grid lg:grid-cols-2 gap-4">
        {[
          { title: "Top passageiros que mais cancelam", icon: Users, data: rankPassengers, kind: "passenger" as const },
          { title: "Top motoristas que mais cancelam", icon: Car, data: rankDrivers, kind: "driver" as const },
        ].map((section) => (
          <div key={section.title} className="rounded-2xl border bg-card p-4">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <section.icon className="h-4 w-4" /> {section.title}
            </h3>
            {section.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem cancelamentos no período.</p>
            ) : (
              <ul className="space-y-1.5">
                {section.data.map((r, idx) => (
                  <li key={r.user_id} className="flex items-center gap-2 rounded-lg hover:bg-muted/30 px-2 py-1.5">
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground">{idx + 1}</span>
                    <span className="flex-1 text-xs font-semibold truncate">{r.full_name}</span>
                    <span className="text-xs font-bold text-destructive">{r.total}</span>
                    <button
                      onClick={() => setBlockDialog({ user_id: r.user_id, name: r.full_name, kind: section.kind })}
                      title="Aplicar bloqueio manual"
                      className="rounded-lg p-1 hover:bg-destructive/10 text-destructive"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Lista de canceladas */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" /> Corridas canceladas ({filteredRides.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-lg border bg-card px-2 py-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Buscar por nome, código, endereço..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none min-w-[160px]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="rounded-full p-0.5 hover:bg-muted" title="Limpar">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <select
              value={who}
              onChange={(e) => setWho(e.target.value as WhoFilter)}
              className="rounded-lg border bg-card px-2 py-1 text-xs"
            >
              <option value="all">Quem cancelou: todos</option>
              <option value="passenger">Passageiro</option>
              <option value="driver">Motorista</option>
            </select>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="rounded-lg border bg-card px-2 py-1 text-xs"
            >
              <option value="all">Motivo: todos</option>
              {REASON_TAGS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              <option value="outros">Outros</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : filteredRides.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Nenhum cancelamento encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2">Código</th>
                  <th className="text-left py-2 px-2">Quando</th>
                  <th className="text-left py-2 px-2">Quem cancelou</th>
                  <th className="text-left py-2 px-2">Passageiro</th>
                  <th className="text-left py-2 px-2">Motorista</th>
                  <th className="text-left py-2 px-2">Motivo</th>
                  <th className="text-right py-2 px-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredRides.map((r) => {
                  const reason = classifyReason(r.admin_notes);
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2 font-mono">{r.ride_code}</td>
                      <td className="py-2 px-2"><Clock className="h-3 w-3 inline mr-1 text-muted-foreground" />{brDateTime(r.cancelled_at)}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.who === "passenger" ? "bg-primary/10 text-primary" :
                          r.who === "driver" ? "bg-info/10 text-info" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {r.who === "passenger" ? "Passageiro" : r.who === "driver" ? "Motorista" : "Sistema"}
                        </span>
                      </td>
                      <td className="py-2 px-2 truncate max-w-[140px]">{r.passenger_name}</td>
                      <td className="py-2 px-2 truncate max-w-[140px]">{r.driver_name}</td>
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                          {reasonLabel(reason)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => setDetailsRide(r.id)}
                          className="inline-flex items-center gap-1 rounded-lg border bg-card px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                        >
                          <Eye className="h-3 w-3" /> Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal detalhes */}
      <RideDetailsModal rideId={detailsRide} onClose={() => setDetailsRide(null)} />

      {/* Modal aplicar bloqueio manual */}
      <Dialog open={!!blockDialog} onOpenChange={(o) => !o && !actionLoading && setBlockDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" /> Aplicar bloqueio manual
            </DialogTitle>
            <DialogDescription>
              {blockDialog?.kind === "driver" ? "Motorista" : "Passageiro"}: <strong>{blockDialog?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Duração do bloqueio</label>
              <div className="grid grid-cols-5 gap-1">
                {[2, 5, 12, 24, 48].map((h) => (
                  <button
                    key={h}
                    onClick={() => setBlockHours(h)}
                    className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                      blockHours === h ? "bg-destructive text-destructive-foreground border-destructive" : "bg-card hover:bg-muted"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={720}
                value={blockHours}
                onChange={(e) => setBlockHours(Math.max(1, Math.min(720, Number(e.target.value) || 1)))}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm mt-1"
                placeholder="Horas (1 a 720)"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Motivo (obrigatório)</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                maxLength={300}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm min-h-[70px]"
                placeholder="Explique o motivo do bloqueio para auditoria..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setBlockDialog(null)}
                disabled={actionLoading}
                className="flex-1 rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyBlock}
                disabled={actionLoading}
                className="flex-1 rounded-xl bg-destructive text-destructive-foreground py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {actionLoading ? "Aplicando..." : "Bloquear"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCancellations;