import { useEffect, useState } from "react";
import { ArrowLeft, Car, Bike, Loader2, Plus, CheckCircle2, Clock, XCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import DriverHomeFab from "@/components/driver/DriverHomeFab";

interface Vehicle {
  id: string;
  category: "moto" | "economico" | "conforto";
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_year: number | null;
  vehicle_plate: string;
  is_active: boolean;
  status: string;
  created_at: string;
}

interface ChangeRequest {
  id: string;
  current_category: string | null;
  new_category: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_message: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const categoryLabel = (c: string) =>
  c === "moto" ? "Moto" : c === "conforto" ? "Conforto" : "Econômico";
const CategoryIcon = ({ c, className }: { c: string; className?: string }) =>
  c === "moto" ? <Bike className={className} /> : <Car className={className} />;

const DriverVehicles = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteRequest = async (id: string) => {
    if (!confirm("Excluir esta solicitação do histórico?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("vehicle_change_requests").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error("Não foi possível excluir a solicitação");
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success("Solicitação excluída");
  };

  const load = async () => {
    if (!user?.id) return;
    const [vRes, rRes] = await Promise.all([
      supabase
        .from("driver_vehicles")
        .select("*")
        .eq("driver_id", user.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("vehicle_change_requests")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setVehicles((vRes.data as Vehicle[]) || []);
    setRequests((rRes.data as ChangeRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useRealtimeRefresh("driver_vehicles", load, "driver-vehicles");
  useRealtimeRefresh("vehicle_change_requests", load, "driver-vehicle-requests");

  const pending = requests.find((r) => r.status === "pending");

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate("/driver/profile")}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-display font-bold flex-1">Meus veículos</h1>
      </header>

      <div className="px-4 py-4 space-y-5">
        <div className="rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <p>
            Cada veículo tem uma categoria (moto, econômico ou conforto). A aprovação
            é feita pelo administrador. Apenas veículos aprovados aparecem aqui.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Veículos aprovados
              </h2>
              {vehicles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhum veículo cadastrado.
                </div>
              ) : (
                vehicles.map((v) => (
                  <article
                    key={v.id}
                    className={`rounded-2xl border p-4 ${
                      v.is_active
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-xl p-2.5 ${
                          v.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <CategoryIcon c={v.category} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">
                            {[v.vehicle_brand, v.vehicle_model].filter(Boolean).join(" ") || "Veículo"}
                          </p>
                          {v.is_active && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {categoryLabel(v.category)} • {v.vehicle_color || "-"} •{" "}
                          <span className="font-mono">{v.vehicle_plate}</span>
                          {v.vehicle_year && ` • ${v.vehicle_year}`}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
              <button
                onClick={() => navigate("/driver/vehicles/request")}
                disabled={!!pending}
                className="w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                title={pending ? "Você já tem uma solicitação pendente" : "Cadastrar novo veículo"}
              >
                <Plus className="h-4 w-4" />
                {pending ? "Solicitação pendente em análise" : "Novo veículo"}
              </button>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Solicitações de mudança
              </h2>
              {requests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Você ainda não fez nenhuma solicitação.
                </div>
              ) : (
                requests.map((r) => {
                  const StatusIcon =
                    r.status === "pending" ? Clock : r.status === "approved" ? CheckCircle2 : XCircle;
                  const color =
                    r.status === "pending"
                      ? "text-warning"
                      : r.status === "approved"
                      ? "text-success"
                      : "text-destructive";
                  return (
                    <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {categoryLabel(r.current_category || "")} → {categoryLabel(r.new_category)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.vehicle_brand} {r.vehicle_model} • {r.vehicle_color} •{" "}
                            <span className="font-mono">{r.vehicle_plate}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Enviado em {new Date(r.created_at).toLocaleDateString("pt-BR")}
                            {r.reviewed_at && ` • Revisado em ${new Date(r.reviewed_at).toLocaleDateString("pt-BR")}`}
                          </p>
                          {r.admin_message && (
                            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs italic">
                              "{r.admin_message}"
                            </p>
                          )}
                        </div>
                        {r.status !== "pending" && (
                          <button
                            onClick={() => deleteRequest(r.id)}
                            disabled={deletingId === r.id}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            aria-label="Excluir solicitação"
                            title="Excluir do histórico"
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          </>
        )}
      </div>
    </div>
      <DriverHomeFab />
  );
};

export default DriverVehicles;