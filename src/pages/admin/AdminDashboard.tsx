import { useEffect, useState } from "react";
import { Car, DollarSign, AlertTriangle, Activity, ChevronRight, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import StatCard from "@/components/shared/StatCard";
import StatusBadge from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ ridesToday: 0, driversOnline: 0, revenueToday: 0, fraudAlerts: 0, totalDrivers: 0, totalPassengers: 0 });
  const [recentDrivers, setRecentDrivers] = useState<any[]>([]);
  const [recentRides, setRecentRides] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    Promise.all([
      supabase.from("rides").select("id, price, platform_fee", { count: "exact" }).gte("created_at", today),
      supabase.from("drivers").select("id", { count: "exact" }),
      supabase.from("profiles").select("id", { count: "exact" }).eq("user_type", "passenger"),
      supabase.from("fraud_alerts").select("id", { count: "exact" }).eq("resolved", false),
      supabase.from("drivers").select("id, user_id, status, rating, total_rides, category, balance").order("created_at", { ascending: false }).limit(5),
      supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(5),
    ]).then(([ridesRes, driversRes, passRes, fraudRes, driversData, ridesData]) => {
      const rides = ridesRes.data || [];
      const revenue = rides.reduce((s, r) => s + (r.platform_fee || 0), 0);
      setStats({
        ridesToday: ridesRes.count || 0,
        driversOnline: 0,
        revenueToday: revenue,
        fraudAlerts: fraudRes.count || 0,
        totalDrivers: driversRes.count || 0,
        totalPassengers: passRes.count || 0,
      });
      setRecentDrivers(driversData.data || []);
      setRecentRides(ridesData.data || []);
    });
  }, []);

  const statusMap: Record<string, "pending" | "approved" | "blocked"> = {
    pending: "pending", approved: "approved", rejected: "blocked", blocked: "blocked",
  };

  const rideStatusMap: Record<string, "active" | "completed" | "cancelled" | "pending"> = {
    requested: "pending", accepted: "active", in_progress: "active", completed: "completed", cancelled: "cancelled",
  };

  return (
    <AdminLayout title="Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Corridas hoje" value={String(stats.ridesToday)} icon={Car} trend={{ value: "tempo real", positive: true }} variant="primary" />
        <StatCard title="Total motoristas" value={String(stats.totalDrivers)} icon={Activity} variant="success" />
        <StatCard title="Receita hoje" value={`R$ ${stats.revenueToday.toFixed(2)}`} icon={DollarSign} trend={{ value: "taxas", positive: true }} />
        <StatCard title="Alertas fraude" value={String(stats.fraudAlerts)} icon={AlertTriangle} variant="warning" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard title="Total passageiros" value={String(stats.totalPassengers)} icon={Users} />
        <StatCard title="Crescimento" value="+12%" icon={TrendingUp} variant="success" subtitle="vs. semana anterior" />
      </div>

      {/* Tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-bold">Motoristas recentes</h3>
            <button onClick={() => navigate("/admin/drivers")} className="text-xs font-medium text-primary flex items-center gap-1">
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y">
            {recentDrivers.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum motorista cadastrado</p>}
            {recentDrivers.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{d.category}</p>
                  <p className="text-xs text-muted-foreground">Saldo: R$ {d.balance?.toFixed(2)} • {d.total_rides || 0} corridas</p>
                </div>
                <StatusBadge status={statusMap[d.status] || "pending"} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-bold">Corridas recentes</h3>
            <button onClick={() => navigate("/admin/rides")} className="text-xs font-medium text-primary flex items-center gap-1">
              Ver todas <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y">
            {recentRides.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma corrida registrada</p>}
            {recentRides.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{r.origin_address?.split(" - ")[0]}</p>
                  <p className="text-xs text-muted-foreground">→ {r.destination_address?.split(" - ")[0]}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">R$ {r.price?.toFixed(2) || "—"}</p>
                  <StatusBadge status={rideStatusMap[r.status] || "pending"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
