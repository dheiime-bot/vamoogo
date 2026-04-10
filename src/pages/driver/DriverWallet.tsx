import { useEffect, useState } from "react";
import { Wallet, CreditCard, QrCode, ArrowDownLeft, ArrowUpRight, Gift, History, Home, User, Loader2 } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import StatCard from "@/components/shared/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const navItems = [
  { icon: Home, label: "Início", path: "/driver" },
  { icon: Wallet, label: "Carteira", path: "/driver/wallet" },
  { icon: History, label: "Corridas", path: "/driver/rides" },
  { icon: User, label: "Perfil", path: "/driver/profile" },
];

const DriverWallet = () => {
  const { user, driverData } = useAuth();
  const [recharges, setRecharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const balance = driverData?.balance ?? 0;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("recharges")
      .select("*")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setRecharges(data); });
  }, [user]);

  const handleRecharge = async (amount: number) => {
    if (!user) return;
    setLoading(true);
    
    const bonus = amount >= 100 ? amount * 0.1 : amount >= 50 ? amount * 0.05 : 0;
    
    const { error } = await supabase.from("recharges").insert({
      driver_id: user.id,
      amount,
      bonus: Math.round(bonus * 100) / 100,
      method: "pix" as const,
      status: "completed" as const,
    });

    if (!error) {
      // Update driver balance
      await supabase
        .from("drivers")
        .update({ balance: balance + amount + bonus })
        .eq("user_id", user.id);

      toast.success(`Recarga de R$ ${amount.toFixed(2)} + bônus R$ ${bonus.toFixed(2)} realizada!`);
      
      // Refresh
      const { data } = await supabase.from("recharges").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (data) setRecharges(data);
    } else {
      toast.error("Erro na recarga: " + error.message);
    }
    setLoading(false);
  };

  const totalFees = recharges
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + (r.amount || 0), 0) * 0.15;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-primary p-6 pb-10">
        <h1 className="text-lg font-bold font-display text-primary-foreground mb-1">Carteira</h1>
        <p className="text-3xl font-extrabold text-primary-foreground">R$ {balance.toFixed(2)}</p>
        <p className="text-sm text-primary-foreground/70">Saldo disponível</p>
      </div>

      <div className="relative -mt-4 px-4">
        <div className="flex gap-3 mb-5">
          <button onClick={() => handleRecharge(50)} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card border py-3 shadow-sm text-sm font-semibold disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 text-primary" />} PIX
          </button>
          <button onClick={() => handleRecharge(100)} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card border py-3 shadow-sm text-sm font-semibold disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 text-primary" />} Cartão
          </button>
        </div>

        <div className="mb-5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recarga rápida</h3>
          <div className="grid grid-cols-4 gap-2">
            {[20, 50, 100, 200].map((val) => (
              <button
                key={val}
                onClick={() => handleRecharge(val)}
                disabled={loading}
                className="rounded-xl border bg-card py-2.5 text-sm font-bold hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                R$ {val}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Bônus: 5% para R$50+ | 10% para R$100+</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatCard title="Taxa atual" value="15%" icon={Wallet} variant="primary" subtitle={`Categoria: ${driverData?.category === "moto" ? "Moto" : driverData?.category === "premium" ? "Premium" : "Carro"}`} />
          <StatCard title="Gasto em taxas" value={`R$ ${totalFees.toFixed(2)}`} icon={ArrowUpRight} subtitle="Estimado" />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Histórico</h3>
          <div className="space-y-2">
            {recharges.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma transação ainda</p>
            )}
            {recharges.map((tx, i) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 animate-slide-up"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
              >
                <div className="rounded-lg p-2 bg-success/10">
                  {tx.bonus > 0 ? <Gift className="h-4 w-4 text-success" /> : <ArrowDownLeft className="h-4 w-4 text-success" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Recarga {tx.method === "pix" ? "PIX" : "Cartão"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-success">+R$ {(tx.amount + (tx.bonus || 0)).toFixed(2)}</p>
                  {tx.bonus > 0 && <p className="text-[10px] text-success">bônus +R$ {tx.bonus.toFixed(2)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav items={navItems} />
    </div>
  );
};

export default DriverWallet;
