import { useEffect, useState } from "react";
import { Search, Eye, Ban } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import StatusBadge from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";

const AdminPassengers = () => {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("user_type", "passenger")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setPassengers(data); });
  }, []);

  const filtered = passengers.filter((p) =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.cpf?.includes(search) || p.email?.includes(search)
  );

  return (
    <AdminLayout title="Passageiros" actions={<span className="text-sm text-muted-foreground">{passengers.length} registrados</span>}>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar por nome, CPF ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Passageiro</th>
                <th className="px-4 py-3 text-left font-semibold">CPF</th>
                <th className="px-4 py-3 text-left font-semibold">Contato</th>
                <th className="px-4 py-3 text-left font-semibold">Verificações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.cpf ? `***-${p.cpf.slice(-2)}` : "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs">{p.phone || "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${p.selfie_url ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>Selfie</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${p.phone_verified ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>OTP</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y">
          {filtered.map((p) => (
            <div key={p.id} className="p-4">
              <p className="font-medium">{p.full_name}</p>
              <p className="text-xs text-muted-foreground">{p.email} • {p.phone}</p>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum passageiro encontrado</p>}
      </div>
    </AdminLayout>
  );
};

export default AdminPassengers;
