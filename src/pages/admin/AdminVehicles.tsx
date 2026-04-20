import { useEffect, useMemo, useState } from "react";
import { Loader2, Car, Bike, Search, ArrowLeftRight } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Row {
  id: string;
  driver_id: string;
  category: "moto" | "economico" | "conforto";
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_year: number | null;
  vehicle_plate: string;
  vehicle_renavam: string | null;
  status: string;
  is_active: boolean;
  driver_name?: string | null;
  driver_email?: string | null;
}

interface DriverOpt { user_id: string; full_name: string; email: string | null; }

const CategoryIcon = ({ c, className }: { c: string; className?: string }) =>
  c === "moto" ? <Bike className={className} /> : <Car className={className} />;

const AdminVehicles = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "approved" | "pending">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "moto" | "economico" | "conforto">("all");

  const [transferOpen, setTransferOpen] = useState(false);
  const [active, setActive] = useState<Row | null>(null);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [newDriverId, setNewDriverId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");

  const load = async () => {
    const { data: vehs, error } = await supabase
      .from("driver_vehicles")
      .select("id, driver_id, category, vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate, vehicle_renavam, status, is_active")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { toast.error("Erro ao carregar veículos"); setLoading(false); return; }
    const rows = (vehs as Row[]) || [];
    const ids = Array.from(new Set(rows.map(r => r.driver_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("user_id, full_name, email").in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      rows.forEach(r => {
        const p = map.get(r.driver_id);
        r.driver_name = p?.full_name || "—";
        r.driver_email = p?.email || null;
      });
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeRefresh("driver_vehicles", load, "admin-vehicles");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(r => {
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "approved" && r.status !== "approved") return false;
      if (statusFilter === "pending" && r.status !== "pending") return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        r.vehicle_plate?.toLowerCase().includes(term) ||
        r.vehicle_renavam?.toLowerCase().includes(term) ||
        r.driver_name?.toLowerCase().includes(term) ||
        r.driver_email?.toLowerCase().includes(term) ||
        r.vehicle_brand?.toLowerCase().includes(term) ||
        r.vehicle_model?.toLowerCase().includes(term)
      );
    });
  }, [items, q, statusFilter, categoryFilter]);

  const openTransfer = async (row: Row) => {
    setActive(row);
    setNewDriverId("");
    setReason("");
    setDriverSearch("");
    setTransferOpen(true);
    // carrega motoristas (excluindo o atual)
    const { data } = await supabase
      .from("drivers").select("user_id").limit(500);
    const ids = (data || []).map((d: any) => d.user_id).filter((id: string) => id !== row.driver_id);
    if (!ids.length) { setDrivers([]); return; }
    const { data: profs } = await supabase
      .from("profiles").select("user_id, full_name, email").in("user_id", ids).order("full_name");
    setDrivers(((profs || []) as DriverOpt[]));
  };

  const confirmTransfer = async () => {
    if (!active || !newDriverId) { toast.error("Selecione o motorista destino"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_transfer_vehicle", {
      _vehicle_id: active.id,
      _new_driver_id: newDriverId,
      _reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Veículo transferido");
    setTransferOpen(false);
    load();
  };

  const filteredDrivers = useMemo(() => {
    const t = driverSearch.trim().toLowerCase();
    if (!t) return drivers.slice(0, 50);
    return drivers.filter(d =>
      d.full_name?.toLowerCase().includes(t) || d.email?.toLowerCase().includes(t)
    ).slice(0, 50);
  }, [drivers, driverSearch]);

  return (
    <AdminLayout title="Veículos">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Placa, RENAVAM, motorista, modelo..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="rounded-xl border bg-card px-3 py-2 text-xs">
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="approved">Aprovados</option>
          <option value="pending">Pendentes</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)}
          className="rounded-xl border bg-card px-3 py-2 text-xs">
          <option value="all">Toda categoria</option>
          <option value="moto">Moto</option>
          <option value="economico">Econômico</option>
          <option value="conforto">Conforto</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum veículo encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Veículo</th>
                <th className="px-3 py-2 text-left">Placa</th>
                <th className="px-3 py-2 text-left">RENAVAM</th>
                <th className="px-3 py-2 text-left">Motorista</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CategoryIcon c={r.category} className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">{r.vehicle_brand} {r.vehicle_model}</p>
                        <p className="text-[11px] text-muted-foreground">{r.vehicle_color || "—"} • {r.vehicle_year || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono font-bold">{r.vehicle_plate}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.vehicle_renavam || "—"}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.driver_name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.driver_email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {r.is_active && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success w-fit">Ativo</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase w-fit ${
                        r.status === "approved" ? "bg-primary/10 text-primary" :
                        r.status === "pending" ? "bg-warning/10 text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>{r.status}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => openTransfer(r)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" /> Transferir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir veículo</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/40 p-3 text-xs">
                <p><strong>{active.vehicle_brand} {active.vehicle_model}</strong> • <span className="font-mono">{active.vehicle_plate}</span></p>
                <p className="text-muted-foreground">Atual: {active.driver_name}</p>
              </div>
              <div>
                <Label>Buscar motorista destino</Label>
                <input
                  value={driverSearch}
                  onChange={e => setDriverSearch(e.target.value)}
                  placeholder="Nome ou e-mail"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border">
                  {filteredDrivers.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground text-center">Nenhum motorista</p>
                  ) : filteredDrivers.map(d => (
                    <button
                      key={d.user_id}
                      type="button"
                      onClick={() => setNewDriverId(d.user_id)}
                      className={`w-full text-left px-3 py-2 text-xs border-b last:border-b-0 hover:bg-muted ${
                        newDriverId === d.user_id ? "bg-primary/10" : ""
                      }`}
                    >
                      <p className="font-medium">{d.full_name}</p>
                      <p className="text-muted-foreground">{d.email}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Motivo (opcional)</Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                  placeholder="Ex: motorista vendeu o carro" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                ⚠ O veículo será removido do motorista atual e ficará desativado no destino até ele ativar em "Meus veículos".
              </p>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setTransferOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button
              onClick={confirmTransfer}
              disabled={busy || !newDriverId}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Transferir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminVehicles;
