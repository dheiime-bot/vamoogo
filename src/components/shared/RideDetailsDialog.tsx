/**
 * RideDetailsDialog — modal compartilhado (passageiro/motorista) com
 * detalhes completos de uma corrida. Aberto ao clicar no código VAMOO.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/brFormat";
import StatusBadge from "@/components/shared/StatusBadge";
import { MapPin, Clock, Navigation, CreditCard, User, Car, Star, Receipt, Loader2 } from "lucide-react";

type Props = {
  rideId: string | null;
  open: boolean;
  onClose: () => void;
  role: "passenger" | "driver";
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const catLabel = (c: string) => c === "moto" ? "Moto" : c === "conforto" ? "Conforto" : "Econômico";
const payLabel = (p?: string | null) =>
  p === "pix" ? "Pix" : p === "cash" ? "Dinheiro" : p === "debit" ? "Débito" : p === "credit" ? "Crédito" : "—";

const payStatusLabel = (s?: string | null) => {
  switch ((s || "").toLowerCase()) {
    case "paid": return "PAGO";
    case "pending": return "PENDENTE";
    case "failed": return "FALHOU";
    case "refunded": return "REEMBOLSADO";
    case "cancelled": return "CANCELADO";
    default: return (s || "—").toUpperCase();
  }
};

const RideDetailsDialog = ({ rideId, open, onClose, role }: Props) => {
  const [ride, setRide] = useState<any>(null);
  const [other, setOther] = useState<any>(null); // passageiro (p/ motorista) OU motorista (p/ passageiro)
  const [loading, setLoading] = useState(false);
  const [routeChanges, setRouteChanges] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !rideId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setRide(null); setOther(null); setRouteChanges([]);
      const { data: r } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
      if (!alive) return;
      setRide(r);
      if (r) {
        const otherId = role === "passenger" ? r.driver_id : r.passenger_id;
        if (otherId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, phone, selfie_url, rating")
            .eq("user_id", otherId).maybeSingle();
          if (!alive) return;
          let extra: any = {};
          if (role === "passenger") {
            const { data: drv } = await supabase
              .from("drivers")
              .select("vehicle_brand, vehicle_model, vehicle_color, vehicle_plate, category")
              .eq("user_id", otherId).maybeSingle();
            extra = drv || {};
          }
          setOther({ ...(prof || {}), ...extra });
        }
        // Histórico de mudanças de rota (auditoria visível ao passageiro/motorista)
        const { data: changes } = await supabase
          .from("ride_route_changes")
          .select("*")
          .eq("ride_id", rideId)
          .order("created_at", { ascending: true });
        if (!alive) return;
        setRouteChanges(changes || []);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open, rideId, role]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="font-mono text-primary">{ride?.ride_code || "Corrida"}</span>
            {ride && <StatusBadge status={ride.status} />}
          </DialogTitle>
        </DialogHeader>

        {loading || !ride ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {/* Datas */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Solicitada</span><span className="font-medium">{fmtDate(ride.created_at)}</span></div>
              {ride.started_at && <div className="flex justify-between"><span className="text-muted-foreground">Iniciada</span><span className="font-medium">{fmtDate(ride.started_at)}</span></div>}
              {ride.completed_at && <div className="flex justify-between"><span className="text-muted-foreground">Concluída</span><span className="font-medium">{fmtDate(ride.completed_at)}</span></div>}
              {ride.cancelled_at && <div className="flex justify-between"><span className="text-muted-foreground">Cancelada</span><span className="font-medium text-destructive">{fmtDate(ride.cancelled_at)}</span></div>}
              {ride.cancel_reason_code && <div className="flex justify-between"><span className="text-muted-foreground">Motivo</span><span className="font-medium">{ride.cancel_reason_code}</span></div>}
              {ride.cancel_reason_note && <p className="text-xs text-muted-foreground italic pt-1">"{ride.cancel_reason_note}"</p>}
            </div>

            {/* Rota completa */}
            <div className="rounded-xl border p-3 space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Rota</p>
              <div className="flex gap-2">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-success font-semibold uppercase">Embarque</p>
                  <p className="text-foreground break-words">{ride.origin_address}</p>
                </div>
              </div>
              {Array.isArray(ride.stops) && ride.stops.map((s: any, idx: number) => (
                <div key={idx}>
                  <div className="ml-1 border-l-2 border-dashed border-border h-3" />
                  <div className="flex gap-2">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-warning shrink-0 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-warning-foreground leading-none">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-warning font-semibold uppercase">Parada {idx + 1}{s?.name ? ` — ${s.name}` : ""}</p>
                      <p className="text-foreground break-words">{s?.address || s?.name || "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="ml-1 border-l-2 border-dashed border-border h-3" />
              <div className="flex gap-2">
                <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-destructive font-semibold uppercase">Destino</p>
                  <p className="text-foreground break-words">{ride.destination_address}</p>
                </div>
              </div>
            </div>

            {/* Mudanças de rota (auditoria) */}
            {routeChanges.length > 0 && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-3">
                <p className="text-xs font-bold uppercase text-warning flex items-center gap-1">
                  <Navigation className="h-3.5 w-3.5" /> Mudanças de rota ({routeChanges.length})
                </p>
                {routeChanges.map((c: any, i: number) => {
                  const prevAddr = (c.previous_destination_address || "").split(" - ")[0] || "—";
                  const newAddr = (c.new_destination_address || "").split(" - ")[0] || "—";
                  const prevPrice = Number(c.previous_price ?? 0);
                  const newPrice = Number(c.new_price ?? 0);
                  const diff = newPrice - prevPrice;
                  return (
                    <div key={c.id || i} className="rounded-lg bg-card border p-2.5 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Alteração #{i + 1} • {c.changed_by_role === "driver" ? "Motorista" : "Passageiro"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(c.created_at)}</span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md border bg-muted/30 p-1.5">
                            <p className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">Rota original</p>
                            <p className="text-success text-[11px]">● {(ride.origin_address || "").split(" - ")[0]}</p>
                            <p className="text-destructive line-through opacity-70 text-[11px] break-words">● {prevAddr}</p>
                            <p className="text-[10px] text-muted-foreground pt-0.5">
                              {Number(c.previous_distance_km ?? 0).toFixed(2)} km · {formatBRL(prevPrice)}
                            </p>
                          </div>
                          <div className="rounded-md border bg-card p-1.5">
                            <p className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">Rota final</p>
                            <p className="text-success text-[11px]">● {(ride.origin_address || "").split(" - ")[0]}</p>
                            <p className="text-info font-medium text-[11px] break-words">● {newAddr}</p>
                            <p className="text-[10px] text-foreground pt-0.5">
                              <span className="font-semibold">{Number(c.new_distance_km ?? 0).toFixed(2)} km</span>
                              {" · "}
                              <span className="font-semibold">{formatBRL(newPrice)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t">
                        {c.driven_km != null && (
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground uppercase">Já percorrido</p>
                            <p className="font-semibold">{Number(c.driven_km).toFixed(1)} km</p>
                            <p className="text-[10px] text-success">{formatBRL(Number(c.driven_price ?? 0))}</p>
                          </div>
                        )}
                        {c.new_leg_km != null && (
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground uppercase">Novo trecho</p>
                            <p className="font-semibold">{Number(c.new_leg_km).toFixed(1)} km</p>
                            <p className="text-[10px] text-success">{formatBRL(Number(c.new_leg_price ?? 0))}</p>
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground uppercase">Total novo</p>
                          <p className="font-semibold">{Number(c.new_distance_km ?? 0).toFixed(1)} km</p>
                          <p className="text-[10px] font-bold text-success">{formatBRL(newPrice)}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="text-muted-foreground">Antes: {formatBRL(prevPrice)} ({Number(c.previous_distance_km ?? 0).toFixed(1)} km)</span>
                        <span className={`font-bold ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                          {diff >= 0 ? "+" : ""}{formatBRL(diff)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border bg-card p-2 text-center">
                <Navigation className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">Distância</p>
                <p className="text-sm font-bold">{ride.distance_km ? `${Number(ride.distance_km).toFixed(1)} km` : "—"}</p>
              </div>
              <div className="rounded-xl border bg-card p-2 text-center">
                <Clock className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">Duração</p>
                <p className="text-sm font-bold">{ride.duration_minutes ? `${ride.duration_minutes} min` : "—"}</p>
              </div>
              <div className="rounded-xl border bg-card p-2 text-center">
                <User className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">Pass.</p>
                <p className="text-sm font-bold">{ride.passenger_count ?? 1}</p>
              </div>
            </div>

            {/* Outra parte */}
            {other && (
              <div className="rounded-xl border p-3 space-y-1.5">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">
                  {role === "passenger" ? "Motorista" : "Passageiro"}
                </p>
                <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span className="font-medium">{other.full_name || "—"}</span></div>
                {other.rating != null && (
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">Avaliação</span>
                    <span className="flex items-center gap-1 font-medium"><Star className="h-3 w-3 fill-warning text-warning" />{Number(other.rating).toFixed(1)}</span>
                  </div>
                )}
                {role === "passenger" && other.vehicle_plate && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Veículo</span><span className="font-medium">{[other.vehicle_brand, other.vehicle_model, other.vehicle_color].filter(Boolean).join(" ")}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Placa</span><span className="font-mono font-bold">{other.vehicle_plate}</span></div>
                    {other.category && <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><span className="font-medium">{catLabel(other.category)}</span></div>}
                  </>
                )}
              </div>
            )}

            {/* Para outra pessoa */}
            {ride.for_other_person && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-1">
                <p className="text-xs font-bold uppercase text-warning">Solicitado para outra pessoa</p>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Nome</span><span className="font-medium">{ride.other_person_name || "—"}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Telefone</span><span className="font-mono">{ride.other_person_phone || "—"}</span></div>
              </div>
            )}

            {/* Financeiro */}
            <div className="rounded-xl border p-3 space-y-1.5">
              <p className="text-xs font-bold uppercase text-muted-foreground mb-1 flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> Financeiro</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span className="font-medium flex items-center gap-1"><CreditCard className="h-3 w-3" />{payLabel(ride.payment_method)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status pagamento</span><span className="font-medium uppercase text-xs">{payStatusLabel(ride.payment_status)}</span></div>
              {role === "passenger" ? (
                <div className="flex justify-between border-t pt-1.5 mt-1"><span className="font-semibold">Valor pago</span><span className="font-extrabold text-success">{formatBRL(Number(ride.price ?? 0))}</span></div>
              ) : (
                <>
                  {ride.original_price && ride.original_price !== ride.price && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Preço original</span><span className="font-medium line-through">{formatBRL(Number(ride.original_price))}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor da corrida</span><span className="font-bold">{formatBRL(Number(ride.price ?? 0))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Taxa plataforma</span><span className="text-destructive">-{formatBRL(Number(ride.platform_fee ?? 0))}</span></div>
                  <div className="flex justify-between border-t pt-1.5 mt-1"><span className="font-semibold">Você recebeu</span><span className="font-extrabold text-success">{formatBRL(Number(ride.driver_net ?? 0))}</span></div>
                </>
              )}
            </div>

            {/* Avaliações */}
            {(ride.rating || ride.driver_rating) && (
              <div className="rounded-xl border p-3 space-y-1.5">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Avaliações</p>
                {ride.rating != null && (
                  <div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Passageiro avaliou</span>
                      <span className="flex items-center gap-1 font-medium"><Star className="h-3 w-3 fill-warning text-warning" />{ride.rating}</span>
                    </div>
                    {ride.rating_comment && <p className="text-xs italic text-muted-foreground mt-1">"{ride.rating_comment}"</p>}
                  </div>
                )}
                {ride.driver_rating != null && (
                  <div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Motorista avaliou</span>
                      <span className="flex items-center gap-1 font-medium"><Star className="h-3 w-3 fill-warning text-warning" />{ride.driver_rating}</span>
                    </div>
                    {ride.driver_rating_comment && <p className="text-xs italic text-muted-foreground mt-1">"{ride.driver_rating_comment}"</p>}
                  </div>
                )}
              </div>
            )}

            {/* Categoria + IDs (auditoria leve) */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><span className="font-medium flex items-center gap-1"><Car className="h-3 w-3" />{catLabel(ride.category)}</span></div>
              {ride.admin_notes && (
                <div className="pt-1 border-t mt-1">
                  <p className="text-muted-foreground">Nota administrativa</p>
                  <p className="italic">{ride.admin_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RideDetailsDialog;