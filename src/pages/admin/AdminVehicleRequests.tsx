import { useEffect, useMemo, useState } from "react";
import { Loader2, Car, Bike, CheckCircle2, XCircle, Clock, ImageIcon, FileText } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RequestRow {
  id: string;
  driver_id: string;
  current_category: string | null;
  new_category: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_year: number | null;
  vehicle_plate: string;
  crlv_url: string | null;
  vehicle_photo_front_url: string | null;
  vehicle_photo_back_url: string | null;
  vehicle_photo_left_url: string | null;
  vehicle_photo_right_url: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_message: string | null;
  created_at: string;
  reviewed_at: string | null;
  driver_name?: string | null;
}

const categoryLabel = (c: string | null) =>
  c === "moto" ? "Moto" : c === "conforto" ? "Conforto" : c === "economico" ? "Econômico" : "—";
const CategoryIcon = ({ c, className }: { c: string; className?: string }) =>
  c === "moto" ? <Bike className={className} /> : <Car className={className} />;

const AdminVehicleRequests = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RequestRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const [active, setActive] = useState<RequestRow | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    let q = supabase
      .from("vehicle_change_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data: rows, error } = await q;
    if (error) {
      toast.error("Erro ao carregar solicitações");
      setLoading(false);
      return;
    }
    const list = (rows as RequestRow[]) || [];
    const ids = Array.from(new Set(list.map((r) => r.driver_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
      list.forEach((r) => (r.driver_name = map.get(r.driver_id) || "Motorista"));
    }
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  useRealtimeRefresh("vehicle_change_requests", load, "admin-vehicle-requests");

  const pendingCount = useMemo(() => items.filter((i) => i.status === "pending").length, [items]);

  const closeDialog = () => {
    setActive(null);
    setAction(null);
    setMessage("");
  };

  const handleConfirm = async () => {
    if (!active || !action) return;
    if (action === "reject" && message.trim().length < 3) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setBusy(true);
    const fnName = action === "approve" ? "admin_approve_vehicle_change" : "admin_reject_vehicle_change";
    const { error } = await supabase.rpc(fnName as any, {
      _request_id: active.id,
      _message: message.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success(action === "approve" ? "Veículo aprovado e ativado" : "Solicitação rejeitada");
    closeDialog();
    load();
  };

  const Photo = ({ url, label }: { url: string | null; label: string }) =>
    url ? (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted"
      >
        <img src={url} alt={label} className="h-full w-full object-cover" />
        <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold">
          {label}
        </span>
      </a>
    ) : (
      <div className="aspect-video flex items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">
        <ImageIcon className="h-4 w-4 mr-1" /> {label}
      </div>
    );

  return (
    <AdminLayout title="Mudanças de veículo">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("pending")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
            filter === "pending" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          Pendentes {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
            filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          Todas
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma solicitação {filter === "pending" ? "pendente" : ""} no momento.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => {
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
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CategoryIcon c={r.new_category} className="h-5 w-5 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.driver_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {categoryLabel(r.current_category)} → <strong>{categoryLabel(r.new_category)}</strong>
                      </p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {r.status === "pending" ? "Pendente" : r.status === "approved" ? "Aprovado" : r.status === "rejected" ? "Rejeitado" : "Cancelado"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Veículo</p>
                    <p className="font-medium">
                      {r.vehicle_brand} {r.vehicle_model} ({r.vehicle_color})
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Placa</p>
                    <p className="font-mono font-medium">{r.vehicle_plate}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  <Photo url={r.vehicle_photo_front_url} label="Frente" />
                  <Photo url={r.vehicle_photo_back_url} label="Trás" />
                  <Photo url={r.vehicle_photo_left_url} label="Esq." />
                  <Photo url={r.vehicle_photo_right_url} label="Dir." />
                </div>

                {r.crlv_url && (
                  <a
                    href={r.crlv_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> Abrir CRLV
                  </a>
                )}

                {r.reason && (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs italic">"{r.reason}"</p>
                )}

                {r.admin_message && (
                  <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
                    <strong>Resposta do admin:</strong> {r.admin_message}
                  </p>
                )}

                {r.status === "pending" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => {
                        setActive(r);
                        setAction("reject");
                      }}
                      className="flex-1 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      Rejeitar
                    </button>
                    <button
                      onClick={() => {
                        setActive(r);
                        setAction("approve");
                      }}
                      className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Aprovar
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!action} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Aprovar veículo" : "Rejeitar solicitação"}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <p>
                <strong>{active.driver_name}</strong> — {active.vehicle_brand} {active.vehicle_model} ({active.vehicle_plate})
              </p>
              <p className="text-muted-foreground text-xs">
                Categoria: {categoryLabel(active.current_category)} → {categoryLabel(active.new_category)}
              </p>
              <div>
                <Label>{action === "approve" ? "Mensagem ao motorista (opcional)" : "Motivo da rejeição"}</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder={action === "approve" ? "Bem-vindo à nova categoria!" : "Ex: CRLV ilegível, fotos com baixa qualidade..."}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={closeDialog} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={busy}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center gap-2 ${
                action === "approve" ? "bg-primary" : "bg-destructive"
              }`}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {action === "approve" ? "Aprovar" : "Rejeitar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminVehicleRequests;