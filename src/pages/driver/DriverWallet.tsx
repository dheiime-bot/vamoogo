import { useEffect, useMemo, useState } from "react";
import { CreditCard, QrCode, ArrowDownLeft, Gift, Loader2, Banknote, History } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import DriverEarningsChip from "@/components/driver/DriverEarningsChip";

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PeriodId = "today" | "week" | "month" | "3m" | "6m" | "year" | "all";
const PERIODS: { id: PeriodId; label: string; days: number | null }[] = [
  { id: "today", label: "Hoje", days: 1 },
  { id: "week", label: "7 dias", days: 7 },
  { id: "month", label: "Mês", days: 30 },
  { id: "3m", label: "3 meses", days: 90 },
  { id: "6m", label: "6 meses", days: 180 },
  { id: "year", label: "12 meses", days: 365 },
  { id: "all", label: "Tudo", days: null },
];

const DriverWallet = () => {
  const { user, driverData } = useAuth();
  const [recharges, setRecharges] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [completedRides, setCompletedRides] = useState<{ driver_net: number | null; completed_at: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"recharge" | "withdraw" | "history">("recharge");
  const [period, setPeriod] = useState<PeriodId>("week");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const balance = driverData?.balance ?? 0;

  const reload = async () => {
    if (!user) return;
    const [rech, with_, ridesRes] = await Promise.all([
      supabase.from("recharges").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("withdrawals").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("rides").select("driver_net, completed_at, created_at").eq("driver_id", user.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(1000),
    ]);
    if (rech.data) setRecharges(rech.data);
    if (with_.data) setWithdrawals(with_.data);
    if (ridesRes.data) setCompletedRides(ridesRes.data as any);
  };

  useEffect(() => {
    if (!user) return;
    reload();
    // 🔄 Realtime: atualiza recargas/saques/ganhos sem precisar recarregar a página
    const channel = supabase
      .channel(`wallet-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "recharges", filter: `driver_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals", filter: `driver_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Resumo + gráfico do período selecionado ─────────────────────────────
  const { totalNet, totalCount, chartData, bucketLabel } = useMemo(() => {
    const now = new Date();
    const cfg = PERIODS.find((p) => p.id === period)!;
    const sinceMs = cfg.days == null ? 0 : (cfg.id === "today"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      : now.getTime() - cfg.days * 86400000);

    const inRange = cfg.days == null
      ? completedRides
      : completedRides.filter((r) => new Date(r.completed_at || r.created_at).getTime() >= sinceMs);
    const total = inRange.reduce((s, r) => s + Number(r.driver_net || 0), 0);

    let buckets: { name: string; value: number; key?: string }[] = [];
    let label = "";
    if (cfg.id === "today") {
      label = "por hora";
      buckets = Array.from({ length: 24 }, (_, h) => ({ name: `${h}h`, value: 0 }));
      inRange.forEach((r) => {
        const h = new Date(r.completed_at || r.created_at).getHours();
        buckets[h].value += Number(r.driver_net || 0);
      });
    } else if (cfg.days && cfg.days <= 31) {
      const days = cfg.days;
      label = "por dia";
      buckets = Array.from({ length: days }, (_, i) => {
        const d = new Date(now.getTime() - (days - 1 - i) * 86400000);
        return { name: `${d.getDate()}/${d.getMonth() + 1}`, value: 0, key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` };
      });
      const idx = new Map(buckets.map((b, i) => [b.key!, i]));
      inRange.forEach((r) => {
        const d = new Date(r.completed_at || r.created_at);
        const i = idx.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        if (i != null) buckets[i].value += Number(r.driver_net || 0);
      });
    } else {
      const months = cfg.days ? Math.max(3, Math.round(cfg.days / 30)) : 12;
      label = "por mês";
      buckets = Array.from({ length: months }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
        return { name: d.toLocaleDateString("pt-BR", { month: "short" }), value: 0, key: `${d.getFullYear()}-${d.getMonth()}` };
      });
      const idx = new Map(buckets.map((b, i) => [b.key!, i]));
      inRange.forEach((r) => {
        const d = new Date(r.completed_at || r.created_at);
        const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
        if (i != null) buckets[i].value += Number(r.driver_net || 0);
      });
    }

    return { totalNet: total, totalCount: inRange.length, chartData: buckets, bucketLabel: label };
  }, [completedRides, period]);

  const avgPerRide = totalCount > 0 ? totalNet / totalCount : 0;

  const handleRecharge = async (amount: number) => {
    if (!user) return;
    setLoading(true);
    const bonus = amount >= 100 ? amount * 0.1 : amount >= 50 ? amount * 0.05 : 0;
    const { error } = await supabase.from("recharges").insert({ driver_id: user.id, amount, bonus: Math.round(bonus * 100) / 100, method: "pix" as const, status: "completed" as const });
    if (!error) {
      await supabase.from("drivers").update({ balance: balance + amount + bonus }).eq("user_id", user.id);
      toast.success(`Recarga de R$ ${amount.toFixed(2)} + bônus R$ ${bonus.toFixed(2)} realizada!`);
      const { data } = await supabase.from("recharges").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (data) setRecharges(data);
    } else toast.error("Erro na recarga");
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount || !pixKey) { toast.error("Informe o valor e a chave Pix"); return; }
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 10) { toast.error("Valor mínimo: R$ 10"); return; }
    if (amount > balance) { toast.error("Saldo insuficiente"); return; }
    setLoading(true);
    const { error } = await supabase.from("withdrawals").insert({ driver_id: user.id, amount, pix_key: pixKey });
    if (!error) {
      toast.success("Saque solicitado!");
      setWithdrawAmount(""); setPixKey("");
      const { data } = await supabase.from("withdrawals").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (data) setWithdrawals(data);
    } else toast.error("Erro ao solicitar saque");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Balance header */}
      <div className="bg-gradient-dark p-6 pt-20 pb-6">
        <h1 className="text-lg font-bold font-display text-primary-foreground mb-1">Carteira</h1>
        <p className="text-3xl font-extrabold text-primary-foreground">R$ {balance.toFixed(2)}</p>
        <p className="text-sm text-primary-foreground/60">Saldo disponível</p>
      </div>

      {/* Ganhos por período */}
      <div className="px-4 -mt-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Ganhos no período</p>
              <p className="text-2xl font-extrabold text-success">R$ {totalNet.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">
                {totalCount} corrida{totalCount === 1 ? "" : "s"} • média R$ {avgPerRide.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  period === p.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <p className="text-[10px] text-muted-foreground mb-1">Distribuição {bucketLabel}</p>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v: any) => [`R$ ${Number(v).toFixed(2)}`, "Ganho"]}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="relative mt-4 px-4">
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
          {[
            { id: "recharge" as const, label: "Recarregar", icon: QrCode },
            { id: "withdraw" as const, label: "Sacar", icon: Banknote },
            { id: "history" as const, label: "Histórico", icon: History },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                activeTab === tab.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}>
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "recharge" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[20, 50, 100, 200].map((val) => (
                <button key={val} onClick={() => handleRecharge(val)} disabled={loading}
                  className="rounded-xl border bg-card py-3 text-sm font-bold hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50">
                  R$ {val}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">Bônus: 5% para R$ 50+ • 10% para R$ 100+</p>
            <div className="flex gap-3">
              <button onClick={() => handleRecharge(50)} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card border py-3 shadow-sm text-sm font-semibold disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 text-primary" />} Pix
              </button>
              <button onClick={() => handleRecharge(100)} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card border py-3 shadow-sm text-sm font-semibold disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 text-primary" />} Cartão
              </button>
            </div>
          </div>
        )}

        {activeTab === "withdraw" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">Solicitar saque via Pix</h3>
              <input type="number" placeholder="Valor (mín. R$ 10)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full rounded-lg bg-muted p-3 text-sm outline-none" />
              <input type="text" placeholder="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="w-full rounded-lg bg-muted p-3 text-sm outline-none" />
              <button onClick={handleWithdraw} disabled={loading || !withdrawAmount || !pixKey}
                className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Solicitar saque
              </button>
            </div>
            {withdrawals.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Saques recentes</h3>
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <Banknote className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">R$ {w.amount?.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      w.status === "paid" ? "bg-success/10 text-success" : w.status === "approved" ? "bg-primary/10 text-primary" : w.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                    }`}>
                      {w.status === "pending" ? "Pendente" : w.status === "approved" ? "Aprovado" : w.status === "paid" ? "Pago" : "Rejeitado"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-2">
            {recharges.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma transação</p>}
            {recharges.map((tx, i) => (
              <div key={tx.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 animate-slide-up" style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}>
                <div className="rounded-lg p-2 bg-success/10">
                  {tx.bonus > 0 ? <Gift className="h-4 w-4 text-success" /> : <ArrowDownLeft className="h-4 w-4 text-success" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Recarga {tx.method === "pix" ? "Pix" : "Cartão"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-success">+R$ {(tx.amount + (tx.bonus || 0)).toFixed(2)}</p>
                  {tx.bonus > 0 && <p className="text-[10px] text-success">bônus +R$ {tx.bonus.toFixed(2)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AppMenu role="driver" />
      <DriverEarningsChip />
      
    </div>
  );
};

export default DriverWallet;
