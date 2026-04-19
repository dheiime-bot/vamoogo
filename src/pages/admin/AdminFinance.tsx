import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, ArrowDownLeft, Wallet, Download } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import StatCard from "@/components/shared/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

const AdminFinance = () => {
  const [stats, setStats] = useState({ revenueToday: 0, revenueMonth: 0, rechargesToday: 0, totalBalance: 0 });
  const [recharges, setRecharges] = useState<any[]>([]);

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [ridesToday, ridesMonth, rechToday, driversBalance, rechargesData] = await Promise.all([
      supabase.from("rides").select("platform_fee").eq("status", "completed").gte("completed_at", today),
      supabase.from("rides").select("platform_fee").eq("status", "completed").gte("completed_at", monthStart),
      supabase.from("recharges").select("amount").gte("created_at", today),
      supabase.from("drivers").select("balance"),
      supabase.from("recharges").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    setStats({
      revenueToday: (ridesToday.data || []).reduce((s, r) => s + (r.platform_fee || 0), 0),
      revenueMonth: (ridesMonth.data || []).reduce((s, r) => s + (r.platform_fee || 0), 0),
      rechargesToday: (rechToday.data || []).reduce((s, r) => s + (r.amount || 0), 0),
      totalBalance: (driversBalance.data || []).reduce((s, d) => s + (d.balance || 0), 0),
    });
    setRecharges(rechargesData.data || []);
  };

  useEffect(() => { fetchData(); }, []);
  useRealtimeRefresh(["recharges", "rides", "drivers"], fetchData, "admin-finance");

  const exportCSV = () => {
    const rows = [["Tipo", "Valor", "Data", "Status"]];
    recharges.forEach((r) => rows.push(["Recarga", r.amount, new Date(r.created_at).toLocaleDateString("pt-BR"), r.status]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "financeiro_vamoo.csv"; a.click();
    toast.success("CSV exportado!");
  };

  return (
    <AdminLayout title="Financeiro" actions={
      <button onClick={exportCSV} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
        <Download className="h-3.5 w-3.5" /> Exportar CSV
      </button>
    }>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Receita hoje" value={`R$ ${stats.revenueToday.toFixed(2)}`} icon={DollarSign} variant="primary" />
        <StatCard title="Receita mensal" value={`R$ ${stats.revenueMonth.toFixed(2)}`} icon={TrendingUp} variant="success" />
        <StatCard title="Recargas hoje" value={`R$ ${stats.rechargesToday.toFixed(2)}`} icon={ArrowDownLeft} />
        <StatCard title="Saldo motoristas" value={`R$ ${stats.totalBalance.toFixed(2)}`} icon={Wallet} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="p-4 border-b"><h3 className="text-sm font-bold">Recargas recentes</h3></div>
        <div className="divide-y">
          {recharges.length === 0 && (
            <EmptyState icon={Wallet} title="Nenhuma recarga" description="As recargas feitas pelos motoristas serão listadas aqui." />
          )}
          {recharges.slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-4">
              <ArrowDownLeft className="h-4 w-4 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium">R$ {r.amount?.toFixed(2)}{r.bonus > 0 ? ` (+R$ ${r.bonus.toFixed(2)} bônus)` : ""}</p>
                <p className="text-xs text-muted-foreground">{r.method === "pix" ? "PIX" : "Cartão"} • {new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "completed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {r.status === "completed" ? "OK" : "Pendente"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFinance;
