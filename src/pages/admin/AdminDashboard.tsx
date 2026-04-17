import { useEffect, useState } from "react";
import { Car, DollarSign, AlertTriangle, Activity, ChevronRight, TrendingUp, Users, CheckCircle2, Wifi, MoreVertical, MapPin, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import AdminLayout from "@/components/admin/AdminLayout";
import GoogleMap from "@/components/shared/GoogleMap";
import StatusBadge from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["hsl(210,100%,56%)", "hsl(145,100%,39%)", "hsl(38,95%,55%)", "hsl(0,84%,60%)"];

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ ridesToday: 0, completedRides: 0, revenueToday: 0, driversOnline: 0, incidents: 0, totalDrivers: 0, totalPassengers: 0 });
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [cancelStats, setCancelStats] = useState({ total: 0, rate: 0, byPassenger: 0, byDriver: 0, bySystem: 0, byAdmin: 0, unknown: 0 });

  const load = async () => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const start7d = new Date(); start7d.setDate(start7d.getDate() - 6); start7d.setHours(0,0,0,0);

    const [todayRides, completedRes, driversRes, passRes, incidentsRes, ridesData, activeData, onlineRes, weekRides] = await Promise.all([
      supabase.from("rides").select("id, price, platform_fee, status, created_at", { count: "exact" }).gte("created_at", startToday.toISOString()),
      supabase.from("rides").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("drivers").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "passenger"),
      supabase.from("incidents").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("rides").select("*").in("status", ["requested", "accepted", "in_progress"]).order("created_at", { ascending: false }).limit(5),
      supabase.from("driver_locations").select("driver_id", { count: "exact", head: true }).eq("is_online", true),
      supabase.from("rides").select("created_at,status,platform_fee,price").gte("created_at", start7d.toISOString()),
    ]);

    const rides = todayRides.data || [];
    const revenue = rides.reduce((s, r) => s + Number(r.platform_fee || 0), 0);

    setStats({
      ridesToday: todayRides.count || rides.length,
      completedRides: completedRes.count || 0,
      revenueToday: revenue,
      driversOnline: onlineRes.count || 0,
      incidents: incidentsRes.count || 0,
      totalDrivers: driversRes.count || 0,
      totalPassengers: passRes.count || 0,
    });

    setRecentRides(ridesData.data || []);
    setActiveRides(activeData.data || []);

    // Real chart data — last 7 days
    const dayLabels = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    const buckets: Record<string, { count: number; rev: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      buckets[d.toISOString().slice(0,10)] = { count: 0, rev: 0 };
    }
    (weekRides.data || []).forEach((r: any) => {
      const k = new Date(r.created_at).toISOString().slice(0,10);
      if (buckets[k]) {
        buckets[k].count += 1;
        buckets[k].rev += Number(r.platform_fee || 0);
      }
    });
    const ordered = Object.entries(buckets).map(([k, v]) => {
      const d = new Date(k);
      return { name: dayLabels[d.getDay()], Vamoo: v.count, rev: Math.round(v.rev) };
    });
    setChartData(ordered.map(o => ({ name: o.name, Vamoo: o.Vamoo })));
    setRevenueData(ordered.map(o => ({ name: o.name, Vamoo: o.rev })));

    // Status pie — real numbers from last 7 days
    const wk = weekRides.data || [];
    const completed = wk.filter((r: any) => r.status === "completed").length;
    const inProgress = wk.filter((r: any) => ["in_progress","accepted","requested"].includes(r.status)).length;
    const cancelled = wk.filter((r: any) => r.status === "cancelled").length;
    setStatusData([
      { name: "Finalizada", value: completed },
      { name: "Em andamento", value: inProgress },
      { name: "Cancelada", value: cancelled },
    ]);

    // Breakdown de cancelamentos (últimos 7 dias) — auditoria
    const cancelledRides = await supabase
      .from("rides")
      .select("id, cancelled_by, passenger_id, driver_id")
      .eq("status", "cancelled")
      .gte("created_at", start7d.toISOString());
    const cRows = cancelledRides.data || [];
    let byPassenger = 0, byDriver = 0, bySystem = 0, byAdmin = 0, unknown = 0;
    cRows.forEach((r: any) => {
      if (!r.cancelled_by) { unknown++; return; }
      if (r.cancelled_by === SYSTEM_USER) bySystem++;
      else if (r.cancelled_by === r.passenger_id) byPassenger++;
      else if (r.driver_id && r.cancelled_by === r.driver_id) byDriver++;
      else byAdmin++;
    });
    const totalWk = wk.length;
    setCancelStats({
      total: cRows.length,
      rate: totalWk > 0 ? Math.round((cRows.length / totalWk) * 100) : 0,
      byPassenger, byDriver, bySystem, byAdmin, unknown,
    });
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, () => load())
      .subscribe();
    const t = setInterval(load, 30_000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rideStatusLabel = (s: string) => {
    const map: Record<string, string> = { requested: "Solicitada", accepted: "Aceita", in_progress: "Em andamento", completed: "Finalizada", cancelled: "Cancelada" };
    return map[s] || s;
  };
  const rideStatusColor = (s: string) => {
    const map: Record<string, string> = { requested: "bg-warning/10 text-warning", accepted: "bg-info/10 text-info", in_progress: "bg-success/10 text-success", completed: "bg-success/10 text-success", cancelled: "bg-destructive/10 text-destructive" };
    return map[s] || "bg-muted text-muted-foreground";
  };

  const firstActive = activeRides[0];

  return (
    <AdminLayout title="Dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Corridas Ativas", value: String(activeRides.length), icon: Car, color: "text-primary", bg: "bg-primary/10", trend: "+5%" },
          { label: "Corridas Finalizadas", value: String(stats.completedRides), icon: CheckCircle2, color: "text-success", bg: "bg-success/10", trend: "+10%" },
          { label: "Receita do Dia", value: `R$ ${stats.revenueToday.toFixed(0)}`, icon: DollarSign, color: "text-success", bg: "bg-success/10", trend: "+8%", large: true },
          { label: "Motoristas Online", value: String(stats.driversOnline), icon: Wifi, color: "text-info", bg: "bg-info/10", trend: `${stats.totalDrivers} total` },
          { label: "Incidentes", value: String(stats.incidents), icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", trend: "-1%" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <div className={`rounded-lg p-1.5 ${s.bg}`}>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <span className={`text-2xl font-extrabold ${s.color}`}>{s.value}</span>
                </div>
              </div>
              <span className={`text-xs font-bold ${s.trend?.startsWith("+") ? "text-success" : "text-destructive"}`}>{s.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Mapa ao Vivo</h3>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Passageiros</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-info" /> Motoristas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Incidentes</span>
          </div>
        </div>
        <GoogleMap
          className="h-[300px] lg:h-[350px] rounded-none"
          origin={firstActive ? { lat: firstActive.origin_lat, lng: firstActive.origin_lng, label: "Origem" } : null}
          destination={firstActive ? { lat: firstActive.destination_lat, lng: firstActive.destination_lng, label: "Destino" } : null}
          showRoute={!!firstActive}
        />
        {/* Real-time notification */}
        {activeRides.length > 0 && (
          <div className="absolute bottom-4 right-4 z-10">
            <div className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground text-sm font-semibold shadow-glow animate-fade-in">
              <Bell className="h-4 w-4" />
              Nova Corrida Atribuída!
            </div>
          </div>
        )}
      </div>

      {/* Charts + Table */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* BI Charts */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-bold">Charts de BI</h3>
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-4 grid grid-cols-3 gap-4">
            {/* Bar chart */}
            <div>
              <p className="text-xs font-semibold mb-1">Corridas por Dia</p>
              <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Vamoo</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Bar dataKey="Vamoo" fill="hsl(210,100%,56%)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Line chart */}
            <div>
              <p className="text-xs font-semibold mb-1">Receita Semanal</p>
              <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Vamoo</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={revenueData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <Line type="monotone" dataKey="Vamoo" stroke="hsl(145,100%,39%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Pie chart */}
            <div>
              <p className="text-xs font-semibold mb-1">Status das Corridas</p>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={25} outerRadius={45} dataKey="value" stroke="none">
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-1">
                {statusData.map((s, i) => (
                  <span key={s.name} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent rides table */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-bold">Últimas Corridas</h3>
            <button onClick={() => navigate("/admin/rides")} className="text-xs font-medium text-primary flex items-center gap-1">
              Ver todas <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">ID Corrida</th>
                  <th className="px-4 py-2 text-left font-medium">Passageiro</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentRides.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhuma corrida</td></tr>
                )}
                {recentRides.slice(0, 6).map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs font-bold">#{r.id.slice(0, 5).toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{r.origin_address?.split(" ")[0] || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rideStatusColor(r.status)}`}>
                        {rideStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5">
                      <button className="rounded-lg p-1 hover:bg-muted transition-colors">
                        <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};


export default AdminDashboard;
