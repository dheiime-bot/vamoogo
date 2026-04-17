import { useEffect, useMemo, useState } from "react";
import { Wallet, Receipt, TrendingUp, Calendar, Loader2, Banknote } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import NotificationBell from "@/components/shared/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  debit: "Débito",
  credit: "Crédito",
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PassengerWallet = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("rides")
      .select("id,price,status,payment_method,created_at,completed_at,origin_address,destination_address")
      .eq("passenger_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .then(({ data }) => {
        setRides(data || []);
        setLoading(false);
      });
  }, [user]);

  const stats = useMemo(() => {
    const total = rides.reduce((s, r) => s + Number(r.price || 0), 0);
    const count = rides.length;
    const avg = count > 0 ? total / count : 0;

    // Mês atual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthRides = rides.filter((r) => new Date(r.completed_at || r.created_at).getTime() >= monthStart);
    const monthTotal = monthRides.reduce((s, r) => s + Number(r.price || 0), 0);

    // Por método de pagamento
    const byMethod: Record<string, number> = {};
    rides.forEach((r) => {
      const m = r.payment_method || "cash";
      byMethod[m] = (byMethod[m] || 0) + Number(r.price || 0);
    });

    return { total, count, avg, monthTotal, monthCount: monthRides.length, byMethod };
  }, [rides]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppMenu role="passenger" />
      <NotificationBell />

      <div className="px-4 pt-20 pb-4 max-w-2xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-display font-extrabold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Carteira
          </h1>
          <p className="text-sm text-muted-foreground">Acompanhe quanto você já gastou em corridas.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Card principal: Total gasto */}
            <div className="rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
              <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
                <Receipt className="h-3.5 w-3.5" /> TOTAL GASTO
              </div>
              <p className="mt-2 text-4xl font-display font-extrabold tracking-tight">
                {fmt(stats.total)}
              </p>
              <p className="mt-1 text-xs opacity-90">
                {stats.count} {stats.count === 1 ? "corrida concluída" : "corridas concluídas"}
              </p>
            </div>

            {/* Stats secundárias */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                  <Calendar className="h-3.5 w-3.5" /> Este mês
                </div>
                <p className="mt-1.5 text-lg font-bold">{fmt(stats.monthTotal)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {stats.monthCount} {stats.monthCount === 1 ? "corrida" : "corridas"}
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                  <TrendingUp className="h-3.5 w-3.5" /> Ticket médio
                </div>
                <p className="mt-1.5 text-lg font-bold">{fmt(stats.avg)}</p>
                <p className="text-[11px] text-muted-foreground">por corrida</p>
              </div>
            </div>

            {/* Breakdown por método */}
            {Object.keys(stats.byMethod).length > 0 && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-primary" /> Por forma de pagamento
                </h3>
                <div className="space-y-2">
                  {Object.entries(stats.byMethod)
                    .sort(([, a], [, b]) => b - a)
                    .map(([method, value]) => {
                      const pct = stats.total > 0 ? (value / stats.total) * 100 : 0;
                      return (
                        <div key={method} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{paymentLabels[method] || method}</span>
                            <span className="font-bold text-primary">{fmt(value)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-gradient-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Últimas corridas */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <h3 className="text-sm font-bold">Últimas corridas</h3>
              {rides.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Você ainda não tem corridas concluídas.
                </p>
              ) : (
                <ul className="divide-y">
                  {rides.slice(0, 10).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">
                          {(r.destination_address || "").split(" - ")[0]}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(r.completed_at || r.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" • "}
                          {paymentLabels[r.payment_method] || r.payment_method || "—"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary whitespace-nowrap">
                        {fmt(Number(r.price || 0))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PassengerWallet;
