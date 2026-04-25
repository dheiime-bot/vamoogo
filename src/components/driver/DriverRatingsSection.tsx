/**
 * DriverRatingsSection — Bloco "Minhas avaliações" embutido no perfil do motorista.
 *
 * Mostra:
 *  - Card de nota geral (gradient destaque)
 *  - Lista de avaliações baixas (≤2★) dos últimos 7 dias, totalmente anônimas
 *  - Recursos enviados (pendente/aceito/rejeitado) com a resposta do admin
 *  - Botão "Contestar avaliação" abrindo o AppealRatingDialog
 */
import { useEffect, useState } from "react";
import { Star, ShieldAlert, Clock, CheckCircle2, XCircle } from "lucide-react";
import AppealRatingDialog from "@/components/motorista/AppealRatingDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type LowRide = {
  id: string;
  ride_code: string | null;
  rating: number | null;
  rating_comment: string | null;
  completed_at: string | null;
};

type Appeal = {
  id: string;
  ride_id: string;
  original_rating: number;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
};

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

const DriverRatingsSection = () => {
  const { user } = useAuth();
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [totalRated, setTotalRated] = useState(0);
  const [lowRides, setLowRides] = useState<LowRide[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [appealRide, setAppealRide] = useState<LowRide | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!user) return;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [driverRes, ridesRes, ratedRes, appealsRes] = await Promise.all([
      supabase.from("drivers").select("rating").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("rides")
        .select("id, ride_code, rating, rating_comment, completed_at")
        .eq("driver_id", user.id)
        .lte("rating", 2)
        .gte("completed_at", since)
        .order("completed_at", { ascending: false }),
      supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", user.id)
        .not("rating", "is", null),
      supabase
        .from("rating_appeals" as any)
        .select("id, ride_id, original_rating, reason, status, admin_response, created_at, resolved_at")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (driverRes.data?.rating != null) setOverallRating(Number(driverRes.data.rating));
    setLowRides((ridesRes.data || []) as LowRide[]);
    setTotalRated(ratedRes.count || 0);
    setAppeals(((appealsRes.data || []) as any[]) as Appeal[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    reload();
    const channel = supabase
      .channel(`driver-ratings-section-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "rating_appeals", filter: `driver_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers", filter: `user_id=eq.${user.id}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const appealByRide = new Map(appeals.map((a) => [a.ride_id, a]));

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">Minhas avaliações</h3>

      {/* Nota geral */}
      <div className="rounded-2xl border bg-gradient-primary p-5 text-center shadow-glow">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/80">Nota geral</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <Star className="h-7 w-7 text-warning fill-warning" />
          <span className="text-3xl font-extrabold text-primary-foreground">
            {loading ? "…" : (overallRating ?? 5).toFixed(2)}
          </span>
          <span className="text-sm font-medium text-primary-foreground/70">/ 5,00</span>
        </div>
        <p className="mt-1 text-[11px] text-primary-foreground/80">
          {totalRated} avaliaç{totalRated === 1 ? "ão" : "ões"} · piso mínimo de 4,00
        </p>
      </div>

      {/* Avaliações baixas */}
      <div className="rounded-2xl border bg-card p-4">
        <h4 className="text-sm font-bold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning" />
          Avaliações baixas (últimos 7 dias)
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
          Apenas 1★ ou 2★ — você pode contestar dentro de 7 dias. As avaliações são anônimas.
        </p>

        {loading ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Carregando...</p>
        ) : lowRides.length === 0 ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-success mb-1" />
            <p className="text-sm font-semibold">Sem avaliações baixas 🎉</p>
            <p className="text-[11px] text-muted-foreground">Continue assim!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lowRides.map((ride) => {
              const appeal = appealByRide.get(ride.id);
              return (
                <div key={ride.id} className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <span className="text-xs font-mono text-primary">{ride.ride_code || `#${ride.id.slice(0, 8)}`}</span>
                      <p className="text-[11px] text-muted-foreground">{formatDate(ride.completed_at)}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${s <= (ride.rating || 0) ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                  </div>

                  {ride.rating_comment && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-warning/40 pl-2 my-2">
                      "{ride.rating_comment}"
                    </p>
                  )}

                  {appeal ? (
                    <div className="mt-2 pt-2 border-t border-dashed">
                      {appeal.status === "pending" && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Recurso enviado — aguardando análise do admin
                        </p>
                      )}
                      {appeal.status === "accepted" && (
                        <div className="text-[11px]">
                          <p className="flex items-center gap-1 text-success font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Recurso aceito — nota ajustada para 5★
                          </p>
                          {appeal.admin_response && (
                            <p className="text-muted-foreground mt-1">{appeal.admin_response}</p>
                          )}
                        </div>
                      )}
                      {appeal.status === "rejected" && (
                        <div className="text-[11px]">
                          <p className="flex items-center gap-1 text-destructive font-semibold">
                            <XCircle className="h-3 w-3" /> Recurso rejeitado
                          </p>
                          {appeal.admin_response && (
                            <p className="text-muted-foreground mt-1">{appeal.admin_response}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setAppealRide(ride)}
                      className="mt-2 w-full rounded-lg border border-warning/40 bg-warning/5 py-1.5 text-xs font-semibold text-warning flex items-center justify-center gap-1.5"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" /> Contestar avaliação
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AppealRatingDialog
        open={!!appealRide}
        onClose={() => setAppealRide(null)}
        ride={appealRide}
        onSuccess={reload}
      />
    </div>
  );
};

export default DriverRatingsSection;
