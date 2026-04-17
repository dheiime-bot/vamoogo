import { useEffect, useState } from "react";
import { Search, X, ImageIcon, User as UserIcon, WifiOff } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import DriverDetailsModal from "@/components/admin/DriverDetailsModal";
import DriverActionsMenu from "@/components/admin/DriverActionsMenu";
import { supabase } from "@/integrations/supabase/client";
import { getDriverStatusInfo } from "@/lib/driverStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const normalizePlate = (s: string) => (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

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
  const [thumbs, setThumbs] = useState<Record<string, { selfie?: string; cnh?: string; vehicle?: string }>>({});
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  const fetchDrivers = async () => {
    const { data: drvs, error } = await supabase
      .from("drivers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar motoristas: " + error.message);
      console.error("[AdminDrivers] fetch error", error);
      return;
    }
    const ids = (drvs || []).map((d) => d.user_id).filter(Boolean);
    let profMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, cpf, phone, email, birth_date, selfie_url, selfie_signup_url, phone_verified")
        .in("user_id", ids);
      (profs || []).forEach((p) => { profMap[p.user_id] = p; });
    }
    setDrivers((drvs || []).map((d) => ({ ...d, profiles: profMap[d.user_id] || null })));
  };

  useEffect(() => { fetchDrivers(); }, []);
  useRealtimeRefresh(["drivers", "profiles"], fetchDrivers, "admin-drivers");

  // Thumbs: selfie / CNH frente / foto frontal do veículo
  useEffect(() => {
    const resolve = async (bucket: "selfies" | "driver-documents", url?: string | null) => {
      if (!url) return undefined;
      // Extrai caminho interno de signed URLs antigas e gera URL fresca
      const re = new RegExp(`/object/(?:sign|public)/${bucket}/([^?]+)`);
      const m = url.match(re);
      const path = m ? decodeURIComponent(m[1]) : (url.startsWith("http") ? null : url);
      if (path) {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (data?.signedUrl) return data.signedUrl;
      }
      if (url.startsWith("http")) return url;
      return undefined;
    };
    (async () => {
      const map: Record<string, { selfie?: string; cnh?: string; vehicle?: string }> = {};
      for (const d of drivers) {
        const profile = (d as any).profiles;
        map[d.id] = {
          selfie: await resolve("selfies", profile?.selfie_signup_url || profile?.selfie_url),
          cnh: await resolve("driver-documents", d.cnh_front_url),
          vehicle: await resolve("driver-documents", d.vehicle_photo_front_url),
        };
      }
      setThumbs(map);
    })();
  }, [drivers]);

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
    const matchSearch = (() => {
      if (!search) return true;
      const q = search.toLowerCase().trim();
      const qDigits = onlyDigits(search);
      const qPlate = normalizePlate(search);
      return (
        profile?.full_name?.toLowerCase().includes(q) ||
        profile?.email?.toLowerCase().includes(q) ||
        (qDigits && (onlyDigits(profile?.cpf || "").includes(qDigits) || onlyDigits(profile?.phone || "").includes(qDigits) || onlyDigits(d.cnh_number || "").includes(qDigits))) ||
        (qPlate && normalizePlate(d.vehicle_plate || "").includes(qPlate)) ||
        d.vehicle_model?.toLowerCase().includes(q) ||
        d.vehicle_brand?.toLowerCase().includes(q) ||
        d.user_id?.toLowerCase().startsWith(q) ||
        d.id?.toLowerCase().startsWith(q)
      );
    })();
    const matchStatus =
      filterStatus === "all" ||
      d.status === filterStatus ||
      (filterStatus === "em_analise" && d.status === "pending") ||
      (filterStatus === "aprovado" && d.status === "approved") ||
      (filterStatus === "reprovado" && d.status === "rejected");
    return matchSearch && matchStatus;
  });

  return (
    <AdminLayout title="Motoristas" actions={<span className="text-sm text-muted-foreground">{filtered.length} de {drivers.length}</span>}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            placeholder="Buscar por nome, CPF, telefone, CNH, placa, modelo ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="rounded-full p-1 hover:bg-muted" title="Limpar">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
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
                <th className="px-3 py-3 text-left font-semibold">Selfie</th>
                <th className="px-4 py-3 text-left font-semibold">Motorista</th>
                <th className="px-4 py-3 text-left font-semibold">CPF</th>
                <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                <th className="px-4 py-3 text-left font-semibold">Veículo</th>
                <th className="px-3 py-3 text-left font-semibold">CNH</th>
                <th className="px-3 py-3 text-left font-semibold">Foto veíc.</th>
                <th className="px-4 py-3 text-left font-semibold">Saldo</th>
                <th className="px-4 py-3 text-left font-semibold">Corridas</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Cadastro</th>
                <th className="px-4 py-3 text-left font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((d) => {
                const profile = (d as any).profiles;
                const info = getDriverStatusInfo(d.status);
                const t = thumbs[d.id] || {};
                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedDriver(d)}>
                    <td className="px-3 py-2">
                      {t.selfie ? (
                        <button onClick={(e) => { e.stopPropagation(); setZoomImg(t.selfie!); }} className="h-10 w-10 rounded-full overflow-hidden border-2 border-primary/30 hover:border-primary bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center" title="Ver selfie">
                          <img
                            src={t.selfie}
                            alt={profile?.full_name}
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        </button>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center" title="Sem selfie">
                          <UserIcon className="h-5 w-5 text-primary/70" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{profile?.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{profile?.phone || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{profile?.cpf || "—"}</td>
                    <td className="px-4 py-3">{d.category === "moto" ? "Moto" : d.category === "conforto" ? "Conforto" : "Econômico"}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium">{d.vehicle_brand || ""} {d.vehicle_model || "—"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{d.vehicle_plate || "—"} • {d.vehicle_color || "—"}{d.vehicle_year ? ` • ${d.vehicle_year}` : ""}</p>
                    </td>
                    <td className="px-3 py-2">
                      {t.cnh ? (
                        <button onClick={(e) => { e.stopPropagation(); setZoomImg(t.cnh!); }} className="h-10 w-14 rounded-md overflow-hidden border hover:border-primary" title="Ver CNH">
                          <img src={t.cnh} alt="CNH" className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="h-10 w-14 rounded-md bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {t.vehicle ? (
                        <button onClick={(e) => { e.stopPropagation(); setZoomImg(t.vehicle!); }} className="h-10 w-14 rounded-md overflow-hidden border hover:border-primary" title="Ver veículo">
                          <img src={t.vehicle} alt="Veículo" className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="h-10 w-14 rounded-md bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">R$ {d.balance?.toFixed(2)}</td>
                    <td className="px-4 py-3">{d.total_rides || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}>
                        {info.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {d.online_blocked && <WifiOff className="h-3.5 w-3.5 text-warning" aria-label="Bloqueado de ficar online" />}
                        <DriverActionsMenu driver={d} onView={() => setSelectedDriver(d)} onChanged={fetchDrivers} />
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
            const info = getDriverStatusInfo(d.status);
            const t = thumbs[d.id] || {};
            return (
              <div key={d.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                <button onClick={() => setSelectedDriver(d)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                {t.selfie ? (
                  <img
                    src={t.selfie}
                    alt={profile?.full_name}
                    className="h-12 w-12 rounded-full object-cover border-2 border-primary/30 shrink-0"
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      el.outerHTML = '<div class="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary/70"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
                    }}
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center shrink-0"><UserIcon className="h-6 w-6 text-primary/70" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium">{profile?.full_name || "—"}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}>{info.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.category} • {d.total_rides || 0} corridas • R$ {d.balance?.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{d.vehicle_plate || "—"} • {d.vehicle_brand || ""} {d.vehicle_model || ""}</p>
                  {d.online_blocked && <p className="text-[10px] text-warning flex items-center gap-1 mt-1"><WifiOff className="h-3 w-3" /> Impedido de ficar online</p>}
                </div>
                </button>
                <DriverActionsMenu driver={d} onView={() => setSelectedDriver(d)} onChanged={fetchDrivers} />
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <EmptyState title="Nenhum motorista encontrado" description="Não há motoristas que correspondam ao filtro/busca atual." />}
      </div>

      {selectedDriver && (
        <DriverDetailsModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onAction={(status, msg) => updateStatus(status, msg)}
        />
      )}

      {zoomImg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={() => setZoomImg(null)}>
          <button className="absolute top-4 right-4 rounded-full bg-card p-2"><X className="h-5 w-5" /></button>
          <img src={zoomImg} alt="Zoom" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDrivers;