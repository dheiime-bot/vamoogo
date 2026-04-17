import { useEffect, useState } from "react";
import { Wallet, CreditCard, QrCode, ArrowDownLeft, ArrowUpRight, Gift, Home, User, Loader2, Banknote, History, BarChart3 } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import NotificationBell from "@/components/shared/NotificationBell";
import UserMenu from "@/components/shared/UserMenu";
import { BarChart, Bar, XAxis, ResponsiveContainer } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


const DriverWallet = () => {
  const { user, driverData } = useAuth();
  const [recharges, setRecharges] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"recharge" | "withdraw" | "history">("recharge");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const balance = driverData?.balance ?? 0;

  const weekData = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => ({ name: d, value: Math.floor(Math.random() * 100 + 20) }));

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("recharges").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("withdrawals").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]).then(([rech, with_]) => {
      if (rech.data) setRecharges(rech.data);
      if (with_.data) setWithdrawals(with_.data);
    });
  }, [user]);

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
      <div className="bg-gradient-dark p-6 pb-10">
        <h1 className="text-lg font-bold font-display text-primary-foreground mb-1">Carteira</h1>
        <p className="text-3xl font-extrabold text-primary-foreground">R$ {balance.toFixed(2)}</p>
        <p className="text-sm text-primary-foreground/60">Saldo disponível</p>
        
        {/* Mini earnings chart */}
        <div className="mt-4 bg-primary-foreground/5 rounded-xl p-3">
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={weekData}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
              <Bar dataKey="value" fill="hsl(210,100%,56%)" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="relative -mt-4 px-4">
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
      <NotificationBell />
      <UserMenu role="driver" />
    </div>
  );
};

export default DriverWallet;
