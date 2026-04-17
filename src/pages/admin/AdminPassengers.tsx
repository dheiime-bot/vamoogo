import { useCallback, useEffect, useState } from "react";
import { Search, X, User as UserIcon, RefreshCw, AlertTriangle } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import PassengerDetailsModal from "@/components/admin/PassengerDetailsModal";
import PassengerActionsMenu from "@/components/admin/PassengerActionsMenu";

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

const AdminPassengers = () => {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPassengers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_type", "passenger")
      .order("created_at", { ascending: false });
    if (data) setPassengers(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadPassengers(); }, [loadPassengers]);

  // Realtime: novos passageiros aparecem automaticamente
  useEffect(() => {
    const ch = supabase
      .channel("admin-passengers")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: "user_type=eq.passenger" }, () => {
        loadPassengers();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPassengers]);

  // Resolve thumbs (signed URLs) p/ selfies
  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const p of passengers) {
        const url = p.selfie_url || p.selfie_signup_url;
        if (!url) continue;
        // Se for signed URL antiga, extrai o path interno e gera uma nova fresca
        const signedMatch = url.match(/\/object\/(?:sign|public)\/selfies\/([^?]+)/);
        const path = signedMatch ? decodeURIComponent(signedMatch[1]) : (url.startsWith("http") ? null : url);
        if (path) {
          const { data } = await supabase.storage.from("selfies").createSignedUrl(path, 3600);
          if (data?.signedUrl) { map[p.id] = data.signedUrl; continue; }
        }
        if (url.startsWith("http")) map[p.id] = url;
      }
      setThumbs(map);
    })();
  }, [passengers]);

  const filtered = passengers.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase().trim();
    const qDigits = onlyDigits(search);
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      (qDigits && (onlyDigits(p.cpf || "").includes(qDigits) || onlyDigits(p.phone || "").includes(qDigits))) ||
      p.user_id?.toLowerCase().startsWith(q) ||
      p.id?.toLowerCase().startsWith(q)
    );
  });

  return (
    <AdminLayout title="Passageiros" actions={
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{filtered.length} de {passengers.length}</span>
        <button onClick={loadPassengers} disabled={loading} className="rounded-lg border bg-card p-2 hover:bg-muted disabled:opacity-50" title="Atualizar">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    }>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            placeholder="Buscar por nome, CPF, telefone, email ou ID..."
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
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Selfie</th>
                <th className="px-4 py-3 text-left font-semibold">Passageiro</th>
                <th className="px-4 py-3 text-left font-semibold">CPF</th>
                <th className="px-4 py-3 text-left font-semibold">Nascimento</th>
                <th className="px-4 py-3 text-left font-semibold">Contato</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Verificações</th>
                <th className="px-4 py-3 text-left font-semibold">Cadastro</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const statusColor =
                  p.status === "bloqueado" ? "bg-destructive/10 text-destructive"
                  : p.status === "suspenso" ? "bg-warning/10 text-warning"
                  : "bg-success/10 text-success";
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(p)}>
                    <td className="px-3 py-2">
                      {thumbs[p.id] ? (
                        <button onClick={(e) => { e.stopPropagation(); setZoomImg(thumbs[p.id]); }} className="h-10 w-10 rounded-full overflow-hidden border-2 border-primary/30 hover:border-primary bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center" title="Ver selfie">
                          <img
                            src={thumbs[p.id]}
                            alt={p.full_name}
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
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        {p.full_name}
                        {p.is_suspect && <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-label="Suspeito" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{p.cpf || "—"}</td>
                    <td className="px-4 py-3 text-xs">{p.birth_date ? new Date(p.birth_date).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs">{p.phone || "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${statusColor}`}>
                        {p.status || "ativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${p.selfie_url || p.selfie_signup_url ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>Selfie</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${p.phone_verified ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>OTP</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-right">
                      <PassengerActionsMenu passenger={p} onView={() => setSelected(p)} onChanged={loadPassengers} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => setSelected(p)} className="flex items-center gap-3 p-4 w-full text-left hover:bg-muted/30">
              {thumbs[p.id] ? (
                <img src={thumbs[p.id]} alt={p.full_name} className="h-12 w-12 rounded-full object-cover border-2 border-primary/30" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center"><UserIcon className="h-6 w-6 text-primary/70" /></div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.phone || p.email}</p>
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && <EmptyState title="Nenhum passageiro encontrado" description="Não há passageiros que correspondam à busca atual." />}
      </div>

      {selected && <PassengerDetailsModal passenger={selected} onClose={() => setSelected(null)} />}

      {zoomImg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={() => setZoomImg(null)}>
          <button className="absolute top-4 right-4 rounded-full bg-card p-2"><X className="h-5 w-5" /></button>
          <img src={zoomImg} alt="Zoom" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminPassengers;