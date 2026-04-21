import { useEffect, useMemo, useState } from "react";
import { CreditCard, QrCode, ArrowDownLeft, Gift, Loader2, History, TrendingUp, Wallet, Sparkles, Calendar } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import DriverHomeFab from "@/components/driver/DriverHomeFab";

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
  const [completedRides, setCompletedRides] = useState<{ driver_net: number | null; completed_at: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"recharge" | "history">("recharge");
  const [period, setPeriod] = useState<PeriodId>("week");
  const balance = driverData?.balance ?? 0;

  const reload = async () => {
    if (!user) return;
    const [rech, ridesRes] = await Promise.all([
      supabase.from("recharges").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("rides").select("driver_net, completed_at, created_at").eq("driver_id", user.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(1000),
    ]);
    if (rech.data) setRecharges(rech.data);
    if (ridesRes.data) setCompletedRides(ridesRes.data as any);
  };

  useEffect(() => {
    if (!user) return;
    reload();
    const channel = supabase
      .channel(`wallet-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "recharges", filter: `driver_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "balance_adjustments", filter: `driver_id=eq.${user.id}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const lowBalance = balance < 20;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* === Hero Card: Cartão estilo bank === */}
      <div className="relative overflow-hidden bg-gradient-dark px-4 pt-16 pb-12">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-base font-bold font-display text-primary-foreground/90 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Minha Carteira
            </h1>
            {lowBalance && (
              <span className="rounded-full bg-warning/20 border border-warning/30 px-2.5 py-0.5 text-[10px] font-bold text-warning">
                Saldo baixo
              </span>
            )}
          </div>

          {/* Card visual */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent backdrop-blur-sm border border-primary-foreground/10 p-5 shadow-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-primary-foreground/60 font-semibold mb-1">Saldo disponível</p>
                <p className="text-4xl font-extrabold text-primary-foreground tracking-tight">
                  R$ {balance.toFixed(2).replace(".", ",")}
                </p>
              </div>
              <div className="rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-2.5">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-primary-foreground/70">
              <span className="font-mono tracking-widest">VAMOO • DRIVER</span>
              <span className="font-semibold">{driverData?.full_name?.split(" ")[0]?.toUpperCase() || "MOTORISTA"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* === Card de ganhos no período === */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-success/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Ganhos no período</p>
                <p className="text-2xl font-extrabold text-foreground">R$ {totalNet.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Média/corrida</p>
              <p className="text-sm font-bold text-foreground">R$ {avgPerRide.toFixed(2).replace(".", ",")}</p>
              <p className="text-[10px] text-muted-foreground">{totalCount} {totalCount === 1 ? "corrida" : "corridas"}</p>
            </div>
          </div>

          {/* Period chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-3 scrollbar-none">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all ${
                  period === p.id
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-muted/30 p-2 pt-3">
            <p className="text-[10px] text-muted-foreground mb-1 px-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Distribuição {bucketLabel}
            </p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--primary) / 0.1)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 11,
                    boxShadow: "0 4px 12px hsl(var(--foreground) / 0.1)",
                  }}
                  formatter={(v: any) => [`R$ ${Number(v).toFixed(2)}`, "Ganho"]}
                />
                <Bar dataKey="value" fill="url(#barFill)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* === Tabs === */}
      <div className="mt-5 px-4">
        <div className="flex gap-1 bg-muted rounded-2xl p-1 mb-4">
          {[
            { id: "recharge" as const, label: "Recarregar", icon: QrCode },
            { id: "history" as const, label: "Histórico", icon: History },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                activeTab === tab.id ? "bg-card shadow-md text-foreground" : "text-muted-foreground"
              }`}>
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "recharge" && (
          <div className="space-y-4 animate-slide-up">
            {/* Quick amounts */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">Escolha um valor</p>
              <div className="grid grid-cols-4 gap-2">
                {[20, 50, 100, 200].map((val) => {
                  const bonusPct = val >= 100 ? 10 : val >= 50 ? 5 : 0;
                  return (
                    <button
                      key={val}
                      onClick={() => handleRecharge(val)}
                      disabled={loading}
                      className="relative rounded-2xl border-2 border-border bg-card py-4 text-sm font-bold hover:border-primary hover:bg-primary/5 hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50"
                    >
                      {bonusPct > 0 && (
                        <span className="absolute -top-2 -right-1 rounded-full bg-success px-1.5 py-0.5 text-[9px] font-extrabold text-success-foreground shadow-md">
                          +{bonusPct}%
                        </span>
                      )}
                      <p className="text-[10px] text-muted-foreground font-normal">R$</p>
                      <p className="text-base">{val}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bonus banner */}
            <div className="rounded-2xl bg-gradient-to-r from-success/10 to-primary/5 border border-success/20 p-3 flex items-center gap-3">
              <div className="rounded-full bg-success/20 p-2 shrink-0">
                <Gift className="h-4 w-4 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">Ganhe bônus em recargas!</p>
                <p className="text-[10px] text-muted-foreground">5% para R$ 50+ • 10% para R$ 100+</p>
              </div>
            </div>

            {/* Payment methods */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleRecharge(50)}
                  disabled={loading}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-card border-2 border-border py-4 hover:border-primary hover:shadow-md transition-all disabled:opacity-50"
                >
                  <div className="rounded-xl bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <QrCode className="h-5 w-5 text-primary" />}
                  </div>
                  <span className="text-xs font-semibold">Pix</span>
                </button>
                <button
                  onClick={() => handleRecharge(100)}
                  disabled={loading}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-card border-2 border-border py-4 hover:border-primary hover:shadow-md transition-all disabled:opacity-50"
                >
                  <div className="rounded-xl bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <CreditCard className="h-5 w-5 text-primary" />}
                  </div>
                  <span className="text-xs font-semibold">Cartão</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-2 animate-slide-up">
            {recharges.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 py-10 text-center">
                <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma transação ainda</p>
              </div>
            )}
            {recharges.map((tx, i) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 hover:shadow-md transition-shadow animate-slide-up"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
              >
                <div className="rounded-xl p-2.5 bg-success/10">
                  {tx.bonus > 0 ? <Gift className="h-4 w-4 text-success" /> : <ArrowDownLeft className="h-4 w-4 text-success" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">Recarga {tx.method === "pix" ? "Pix" : "Cartão"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-success">+R$ {(tx.amount + (tx.bonus || 0)).toFixed(2).replace(".", ",")}</p>
                  {tx.bonus > 0 && (
                    <p className="text-[10px] text-success/80 font-medium">bônus +R$ {tx.bonus.toFixed(2).replace(".", ",")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AppMenu role="driver" />
      <DriverHomeFab />
    </div>
  );
};

export default DriverWallet;
