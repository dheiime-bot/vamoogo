import { useEffect, useState } from "react";
import { Search, Ban, CheckCircle, XCircle } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import StatusBadge from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminDrivers = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from("drivers")
      .select("*, profiles!inner(full_name, cpf, phone, email)")
      .order("created_at", { ascending: false });
    if (data) setDrivers(data);
  };

  useEffect(() => { fetchDrivers(); }, []);

  const updateStatus = async (userId: string, status: "pending" | "approved" | "rejected" | "blocked") => {
    await supabase.from("drivers").update({ status }).eq("user_id", userId);
    toast.success(`Status atualizado para ${status}`);
    fetchDrivers();
  };

  const filtered = drivers.filter((d) => {
    const profile = (d as any).profiles;
    const matchSearch = !search || 
      profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      profile?.cpf?.includes(search);
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusMap: Record<string, "pending" | "approved" | "blocked"> = {
    pending: "pending", approved: "approved", rejected: "blocked", blocked: "blocked",
  };

  return (
    <AdminLayout title="Motoristas">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex gap-1">
          {["all", "pending", "approved", "blocked"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`rounded-lg px-3 py-2 text-xs font-medium ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : s === "approved" ? "Aprovados" : "Bloqueados"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Motorista</th>
                <th className="px-4 py-3 text-left font-semibold">CPF</th>
                <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                <th className="px-4 py-3 text-left font-semibold">Saldo</th>
                <th className="px-4 py-3 text-left font-semibold">Corridas</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((d) => {
                const profile = (d as any).profiles;
                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{profile?.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{profile?.phone || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{profile?.cpf ? `***-${profile.cpf.slice(-2)}` : "—"}</td>
                    <td className="px-4 py-3">{d.category === "moto" ? "Moto" : d.category === "premium" ? "Premium" : "Carro"}</td>
                    <td className="px-4 py-3 font-semibold">R$ {d.balance?.toFixed(2)}</td>
                    <td className="px-4 py-3">{d.total_rides || 0}</td>
                    <td className="px-4 py-3"><StatusBadge status={statusMap[d.status] || "pending"} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(d.user_id, "approved")} className="rounded-lg p-1.5 hover:bg-success/10" title="Aprovar"><CheckCircle className="h-4 w-4 text-success" /></button>
                        <button onClick={() => updateStatus(d.user_id, "rejected")} className="rounded-lg p-1.5 hover:bg-warning/10" title="Reprovar"><XCircle className="h-4 w-4 text-warning" /></button>
                        <button onClick={() => updateStatus(d.user_id, "blocked")} className="rounded-lg p-1.5 hover:bg-destructive/10" title="Bloquear"><Ban className="h-4 w-4 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y">
          {filtered.map((d) => {
            const profile = (d as any).profiles;
            return (
              <div key={d.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{profile?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{d.category} • {d.total_rides || 0} corridas • R$ {d.balance?.toFixed(2)}</p>
                  </div>
                  <StatusBadge status={statusMap[d.status] || "pending"} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => updateStatus(d.user_id, "approved")} className="rounded-lg p-1.5 bg-success/10"><CheckCircle className="h-4 w-4 text-success" /></button>
                  <button onClick={() => updateStatus(d.user_id, "blocked")} className="rounded-lg p-1.5 bg-destructive/10"><Ban className="h-4 w-4 text-destructive" /></button>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum motorista encontrado</p>}
      </div>
    </AdminLayout>
  );
};

export default AdminDrivers;
