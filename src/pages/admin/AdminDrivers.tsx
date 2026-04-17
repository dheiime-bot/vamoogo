import { useEffect, useState } from "react";
import { Search, Eye } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import DriverDetailsModal from "@/components/admin/DriverDetailsModal";
import { supabase } from "@/integrations/supabase/client";
import { getDriverStatusInfo } from "@/lib/driverStatus";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "cadastro_enviado", label: "Novos" },
  { id: "em_analise", label: "Em análise" },
  { id: "pendente_documentos", label: "Pendentes" },
  { id: "aprovado", label: "Aprovados" },
  { id: "reprovado", label: "Reprovados" },
  { id: "blocked", label: "Bloqueados" },
];

const AdminDrivers = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState<any>(null);

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from("drivers")
      .select("*, profiles!inner(full_name, cpf, phone, email, selfie_url, selfie_signup_url)")
      .order("created_at", { ascending: false });
    if (data) setDrivers(data);
  };

  useEffect(() => { fetchDrivers(); }, []);

  const updateStatus = async (newStatus: string, message?: string) => {
    if (!selectedDriver || !user) return;
    const { error } = await supabase.from("drivers").update({
      status: newStatus as any,
      analysis_message: message ?? null,
      analyzed_at: new Date().toISOString(),
      analyzed_by: user.id,
    }).eq("user_id", selectedDriver.user_id);

    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }

    // Notificação para o motorista
    const titles: Record<string, string> = {
      aprovado: "Cadastro aprovado! 🎉",
      reprovado: "Cadastro reprovado",
      pendente_documentos: "Documentos pendentes",
      blocked: "Conta bloqueada",
    };
    await supabase.from("notifications").insert({
      user_id: selectedDriver.user_id,
      type: "driver_status",
      title: titles[newStatus] || "Status atualizado",
      message: message || getDriverStatusInfo(newStatus).description,
      link: "/driver/status",
    });

    const labels: Record<string, string> = {
      aprovado: "aprovado",
      reprovado: "reprovado",
      pendente_documentos: "marcado como pendente",
      blocked: "bloqueado",
    };
    toast.success(`Motorista ${labels[newStatus] || "atualizado"}`);
    setSelectedDriver(null);
    fetchDrivers();
  };

  const filtered = drivers.filter((d) => {
    const profile = (d as any).profiles;
    const matchSearch = !search ||
      profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      profile?.cpf?.includes(search);
    const matchStatus =
      filterStatus === "all" ||
      d.status === filterStatus ||
      (filterStatus === "em_analise" && d.status === "pending") ||
      (filterStatus === "aprovado" && d.status === "approved") ||
      (filterStatus === "reprovado" && d.status === "rejected");
    return matchSearch && matchStatus;
  });

  return (
    <AdminLayout title="Motoristas">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)} className={`rounded-lg px-3 py-2 text-xs font-medium ${filterStatus === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {f.label}
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
                const info = getDriverStatusInfo(d.status);
                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedDriver(d)}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{profile?.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{profile?.phone || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{profile?.cpf ? `***-${profile.cpf.slice(-2)}` : "—"}</td>
                    <td className="px-4 py-3">{d.category === "moto" ? "Moto" : d.category === "conforto" ? "Conforto" : "Econômico"}</td>
                    <td className="px-4 py-3 font-semibold">R$ {d.balance?.toFixed(2)}</td>
                    <td className="px-4 py-3">{d.total_rides || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}>
                        {info.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedDriver(d); }} className="rounded-lg p-1.5 hover:bg-primary/10" title="Ver detalhes">
                        <Eye className="h-4 w-4 text-primary" />
                      </button>
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
            const info = getDriverStatusInfo(d.status);
            return (
              <button key={d.id} onClick={() => setSelectedDriver(d)} className="w-full p-4 text-left hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{profile?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{d.category} • {d.total_rides || 0} corridas • R$ {d.balance?.toFixed(2)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}>{info.label}</span>
                </div>
                <p className="text-xs text-primary flex items-center gap-1"><Eye className="h-3 w-3" /> Toque para analisar</p>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum motorista encontrado</p>}
      </div>

      {selectedDriver && (
        <DriverDetailsModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onAction={(status, msg) => updateStatus(status, msg)}
        />
      )}
    </AdminLayout>
  );
};

export default AdminDrivers;
