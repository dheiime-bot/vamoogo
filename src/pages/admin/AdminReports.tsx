import { useEffect, useState } from "react";
import { BarChart3, DollarSign, Car, Users, TrendingUp, Download } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import StatCard from "@/components/shared/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

const AdminReports = () => {
  const [stats, setStats] = useState({
    totalRides: 0, completedRides: 0, cancelledRides: 0,
    totalRevenue: 0, totalDrivers: 0, totalPassengers: 0,
    avgPrice: 0, cancelRate: 0,
  });
  const [dailyRides, setDailyRides] = useState<{ date: string; count: number; revenue: number }[]>([]);

  const fetch_ = async () => {
    const [allRides, drivers, passengers] = await Promise.all([
      supabase.from("rides").select("status, price, platform_fee, created_at"),
      supabase.from("drivers").select("id", { count: "exact" }),
      supabase.from("profiles").select("id", { count: "exact" }).eq("user_type", "passenger"),
    ]);

    const rides = allRides.data || [];
    const completed = rides.filter((r) => r.status === "completed");
    const cancelled = rides.filter((r) => r.status === "cancelled");
    const totalRevenue = completed.reduce((s, r) => s + (r.platform_fee || 0), 0);
    const avgPrice = completed.length > 0 ? completed.reduce((s, r) => s + (r.price || 0), 0) / completed.length : 0;

    setStats({
      totalRides: rides.length,
      completedRides: completed.length,
      cancelledRides: cancelled.length,
      totalRevenue,
      totalDrivers: drivers.count || 0,
      totalPassengers: passengers.count || 0,
      avgPrice,
      cancelRate: rides.length > 0 ? (cancelled.length / rides.length) * 100 : 0,
    });

    const days: Record<string, { count: number; revenue: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days[key] = { count: 0, revenue: 0 };
    }
    completed.forEach((r) => {
      const key = r.created_at?.split("T")[0];
      if (key && days[key]) {
        days[key].count++;
        days[key].revenue += r.platform_fee || 0;
      }
    });
    setDailyRides(Object.entries(days).map(([date, d]) => ({ date, ...d })));
  };
  useEffect(() => { fetch_(); }, []);
  useRealtimeRefresh(["rides", "drivers", "profiles"], fetch_, "admin-reports");

  const exportCSV = () => {
    const rows = [["Métrica", "Valor"]];
    rows.push(["Total corridas", String(stats.totalRides)]);
    rows.push(["Corridas concluídas", String(stats.completedRides)]);
    rows.push(["Corridas canceladas", String(stats.cancelledRides)]);
    rows.push(["Receita total (taxas)", `R$ ${stats.totalRevenue.toFixed(2)}`]);
    rows.push(["Ticket médio", `R$ ${stats.avgPrice.toFixed(2)}`]);
    rows.push(["Taxa cancelamento", `${stats.cancelRate.toFixed(1)}%`]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "relatorio_vamoo.csv"; a.click();
    toast.success("Relatório exportado!");
  };

  const maxRides = Math.max(...dailyRides.map((d) => d.count), 1);

  return (
    <AdminLayout title="BI / Relatórios" actions={
      <button onClick={exportCSV} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
        <Download className="h-3.5 w-3.5" /> Exportar CSV
      </button>
    }>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total corridas" value={String(stats.totalRides)} icon={Car} variant="primary" />
        <StatCard title="Concluídas" value={String(stats.completedRides)} icon={Car} variant="success" />
        <StatCard title="Canceladas" value={String(stats.cancelledRides)} icon={Car} variant="warning" subtitle={`${stats.cancelRate.toFixed(1)}%`} />
        <StatCard title="Receita total" value={`R$ ${stats.totalRevenue.toFixed(2)}`} icon={DollarSign} variant="primary" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Motoristas" value={String(stats.totalDrivers)} icon={Users} />
        <StatCard title="Passageiros" value={String(stats.totalPassengers)} icon={Users} />
        <StatCard title="Ticket médio" value={`R$ ${stats.avgPrice.toFixed(2)}`} icon={TrendingUp} />
        <StatCard title="BI Score" value="A+" icon={BarChart3} variant="success" />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-bold mb-4">Corridas - Últimos 7 dias</h3>
        <div className="flex items-end gap-2 h-40">
          {dailyRides.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold">{d.count}</span>
              <div className="w-full rounded-t-lg bg-gradient-primary transition-all" style={{ height: `${Math.max((d.count / maxRides) * 100, 5)}%` }} />
              <span className="text-[10px] text-muted-foreground">{new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
