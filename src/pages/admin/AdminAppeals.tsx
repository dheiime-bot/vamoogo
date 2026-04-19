import { useEffect, useState } from "react";
import { Star, ShieldAlert, Check, X, Loader2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Appeal = {
  id: string;
  ride_id: string;
  driver_id: string;
  passenger_id: string;
  original_rating: number;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  admin_response: string | null;
  resolved_at: string | null;
  created_at: string;
  ride?: { ride_code: string | null; rating_comment: string | null; price: number | null };
  driver_profile?: { full_name: string };
  passenger_profile?: { full_name: string };
};

const AdminAppeals = () => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "accepted" | "rejected" | "all">("pending");
  const [resolving, setResolving] = useState<{ appeal: Appeal; accept: boolean } | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAppeals = async () => {
    const { data: appealsData } = await supabase
      .from("rating_appeals" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!appealsData) { setLoading(false); return; }

    // Hidrata com ride + profiles
    const rideIds = [...new Set((appealsData as any[]).map((a) => a.ride_id))];
    const userIds = [...new Set((appealsData as any[]).flatMap((a) => [a.driver_id, a.passenger_id]))];

    const [ridesRes, profilesRes] = await Promise.all([
      supabase.from("rides").select("id, ride_code, rating_comment, price").in("id", rideIds),
      supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
    ]);

    const ridesMap = new Map((ridesRes.data || []).map((r: any) => [r.id, r]));
    const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));

    const enriched = (appealsData as any[]).map((a) => ({
      ...a,
      ride: ridesMap.get(a.ride_id),
      driver_profile: profilesMap.get(a.driver_id),
      passenger_profile: profilesMap.get(a.passenger_id),
    }));
    setAppeals(enriched as Appeal[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAppeals();
    const channel = supabase
      .channel("admin-appeals")
      .on("postgres_changes", { event: "*", schema: "public", table: "rating_appeals" }, fetchAppeals)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = appeals.filter((a) => filter === "all" || a.status === filter);
  const pendingCount = appeals.filter((a) => a.status === "pending").length;

  const handleResolve = async () => {
    if (!resolving) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("admin_resolve_appeal" as any, {
      _appeal_id: resolving.appeal.id,
      _accept: resolving.accept,
      _response: response.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(resolving.accept ? "Recurso aceito — nota ajustada para 5★" : "Recurso rejeitado");
    setResolving(null);
    setResponse("");
    fetchAppeals();
  };

  return (
    <AdminLayout title="Recursos de avaliação">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "pending", label: `Pendentes (${pendingCount})` },
          { key: "accepted", label: "Aceitos" },
          { key: "rejected", label: "Rejeitados" },
          { key: "all", label: "Todos" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="Nenhum recurso encontrado"
          description={filter === "pending" ? "Não há recursos pendentes." : "Tente outro filtro."}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-mono text-xs text-primary">{a.ride?.ride_code || a.ride_id.slice(0, 8)}</p>
                  <p className="text-sm font-semibold mt-0.5">{a.driver_profile?.full_name || "Motorista"}</p>
                  <p className="text-xs text-muted-foreground">contesta avaliação de {a.passenger_profile?.full_name || "passageiro"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`h-3.5 w-3.5 ${s <= a.original_rating ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    a.status === "pending" ? "bg-warning/15 text-warning" :
                    a.status === "accepted" ? "bg-success/15 text-success" :
                    "bg-destructive/15 text-destructive"
                  }`}>
                    {a.status === "pending" ? "Pendente" : a.status === "accepted" ? "Aceito" : "Rejeitado"}
                  </span>
                </div>
              </div>

              {a.ride?.rating_comment && (
                <div className="rounded-lg bg-muted p-2 text-xs">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Comentário do passageiro:</p>
                  <p className="italic">"{a.ride.rating_comment}"</p>
                </div>
              )}

              <div className="rounded-lg border-l-2 border-primary bg-primary/5 p-2 text-xs">
                <p className="text-[10px] font-semibold text-primary mb-0.5">Justificativa do motorista:</p>
                <p>{a.reason}</p>
              </div>

              {a.admin_response && (
                <div className="rounded-lg bg-muted/50 p-2 text-xs">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Resposta do admin:</p>
                  <p>{a.admin_response}</p>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                Aberto em {new Date(a.created_at).toLocaleString("pt-BR")}
                {a.resolved_at && ` • Resolvido em ${new Date(a.resolved_at).toLocaleString("pt-BR")}`}
              </p>

              {a.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setResponse(""); setResolving({ appeal: a, accept: true }); }}
                    className="flex-1 rounded-lg bg-success/15 text-success py-2 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-success/25"
                  >
                    <Check className="h-3.5 w-3.5" /> Aceitar (vira 5★)
                  </button>
                  <button
                    onClick={() => { setResponse(""); setResolving({ appeal: a, accept: false }); }}
                    className="flex-1 rounded-lg bg-destructive/15 text-destructive py-2 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-destructive/25"
                  >
                    <X className="h-3.5 w-3.5" /> Rejeitar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!resolving} onOpenChange={(o) => { if (!o) setResolving(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {resolving?.accept ? "Aceitar recurso" : "Rejeitar recurso"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {resolving?.accept
                ? "A avaliação será ajustada para 5★ e a média do motorista será recalculada automaticamente."
                : "A avaliação original será mantida. Explique o motivo da rejeição."}
            </p>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder={resolving?.accept ? "Mensagem opcional para o motorista..." : "Motivo da rejeição (será enviado ao motorista)"}
              className="w-full rounded-xl border bg-background p-3 text-sm outline-none resize-none h-20"
              maxLength={500}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setResolving(null)}
                className="flex-1 rounded-xl border py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleResolve}
                disabled={submitting || (!resolving?.accept && response.trim().length < 5)}
                className={`flex-1 rounded-xl py-2 text-sm font-bold text-primary-foreground disabled:opacity-50 ${
                  resolving?.accept ? "bg-success" : "bg-destructive"
                }`}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAppeals;
