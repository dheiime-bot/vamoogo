import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  Route, CreditCard, Star, Phone, MessageCircle,
  AlertTriangle, FileText, User, Car, Copy, ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "@/components/shared/StatusBadge";
import GoogleMap from "@/components/shared/GoogleMap";

interface Props {
  rideId: string | null;
  onClose: () => void;
}

const Row = ({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className={`text-xs text-right ${mono ? "font-mono" : "font-medium"}`}>{value ?? "—"}</span>
  </div>
);

const copy = (text: string, label = "Copiado") => {
  navigator.clipboard.writeText(text);
  toast.success(label);
};

const RideDetailsModal = ({ rideId, onClose }: Props) => {
  const [ride, setRide] = useState<any>(null);
  const [passenger, setPassenger] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);

  const statusMap: Record<string, "active" | "completed" | "cancelled" | "pending"> = {
    requested: "pending", accepted: "active", in_progress: "active",
    completed: "completed", cancelled: "cancelled",
  };

  useEffect(() => {
    if (!rideId) {
      setRide(null);
      setPassenger(null);
      setDriver(null);
      setDriverProfile(null);
      return;
    }
    (async () => {
      const { data: r } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
      setRide(r);
      if (r?.passenger_id) {
        const { data: p } = await supabase.from("profiles")
          .select("user_id,full_name,phone,email,cpf").eq("user_id", r.passenger_id).maybeSingle();
        setPassenger(p);
      }
      if (r?.driver_id) {
        const { data: d } = await supabase.from("drivers")
          .select("user_id,vehicle_brand,vehicle_model,vehicle_color,vehicle_plate,rating,category")
          .eq("user_id", r.driver_id).maybeSingle();
        setDriver(d);
        const { data: dp } = await supabase.from("profiles")
          .select("user_id,full_name,phone,email").eq("user_id", r.driver_id).maybeSingle();
        setDriverProfile(dp);
      }
    })();
  }, [rideId]);

  const open = !!rideId;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        {ride && (
          <>
            <SheetHeader className="p-5 pb-2 border-b">
              <SheetTitle className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-primary">{ride.ride_code}</span>
                <StatusBadge status={statusMap[ride.status] || "pending"} />
                {ride.issue_flag && (
                  <span className="text-[10px] font-bold uppercase rounded-full bg-warning/15 text-warning px-2 py-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {ride.issue_flag}
                  </span>
                )}
              </SheetTitle>
              <SheetDescription className="text-xs flex items-center justify-between gap-2">
                <span>{new Date(ride.created_at).toLocaleString("pt-BR")} · {ride.category}</span>
                <Link
                  to={`/admin/audit?entity_type=ride&entity=${ride.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <ScrollText className="h-3 w-3" /> Ver na auditoria
                </Link>
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="details" className="px-5 pt-3">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="details" className="text-[11px]"><FileText className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="map" className="text-[11px]"><Route className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="people" className="text-[11px]"><User className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="payment" className="text-[11px]"><CreditCard className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="ratings" className="text-[11px]"><Star className="h-3.5 w-3.5" /></TabsTrigger>
              </TabsList>

              {/* ---------------- DETALHES ---------------- */}
              <TabsContent value="details" className="space-y-3 pt-3 pb-6">
                <div className="rounded-xl border bg-card p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-success mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Embarque</p>
                      <p className="text-sm">{ride.origin_address}</p>
                    </div>
                  </div>
                  {(ride.stops || []).map((s: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-warning mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Parada {i + 1}</p>
                        <p className="text-sm">{s.address || s.name}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Destino</p>
                      <p className="text-sm">{ride.destination_address}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-3">
                  <Row label="Distância" value={`${ride.distance_km ?? "—"} km`} />
                  <Row label="Duração" value={`${ride.duration_minutes ?? "—"} min`} />
                  <Row label="Passageiros" value={ride.passenger_count} />
                  <Row label="Categoria" value={ride.category} />
                  <Row label="Solicitada" value={new Date(ride.created_at).toLocaleString("pt-BR")} />
                  {ride.started_at && <Row label="Iniciada" value={new Date(ride.started_at).toLocaleString("pt-BR")} />}
                  {ride.completed_at && <Row label="Finalizada" value={new Date(ride.completed_at).toLocaleString("pt-BR")} />}
                  {ride.cancelled_at && <Row label="Cancelada" value={new Date(ride.cancelled_at).toLocaleString("pt-BR")} />}
                </div>

                <div className="rounded-xl border bg-card p-3">
                  <Row label="Valor" value={`R$ ${Number(ride.price ?? 0).toFixed(2)}`} />
                  <Row label="Taxa plataforma" value={`R$ ${Number(ride.platform_fee ?? 0).toFixed(2)}`} />
                  <Row label="Líquido motorista" value={`R$ ${Number(ride.driver_net ?? 0).toFixed(2)}`} />
                  {ride.original_price && (
                    <Row label="Valor original" value={`R$ ${Number(ride.original_price).toFixed(2)}`} />
                  )}
                </div>

                {ride.for_other_person && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <p className="text-[10px] font-bold uppercase text-primary">Corrida pedida para outra pessoa</p>
                    <Row label="Nome" value={ride.other_person_name} />
                    <Row label="Telefone" value={ride.other_person_phone} />
                  </div>
                )}

                {ride.admin_notes && (
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Histórico admin</p>
                    <pre className="text-[11px] whitespace-pre-wrap font-sans">{ride.admin_notes}</pre>
                  </div>
                )}
              </TabsContent>

              {/* ---------------- MAPA ---------------- */}
              <TabsContent value="map" className="pt-3 pb-6">
                <div className="rounded-xl overflow-hidden border">
                  <GoogleMap
                    className="h-[55vh]"
                    origin={ride.origin_lat && ride.origin_lng
                      ? { lat: Number(ride.origin_lat), lng: Number(ride.origin_lng), label: "Embarque" } : null}
                    destination={ride.destination_lat && ride.destination_lng
                      ? { lat: Number(ride.destination_lat), lng: Number(ride.destination_lng), label: "Destino" } : null}
                    stops={(ride.stops || []).filter((s: any) => s.lat && s.lng).map((s: any) => ({ lat: s.lat, lng: s.lng, label: s.name || s.address }))}
                    showRoute
                    interactive
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Origem · {(ride.stops || []).length} parada(s) · Destino
                </p>
              </TabsContent>

              {/* ---------------- PESSOAS / CONTATO ---------------- */}
              <TabsContent value="people" className="space-y-3 pt-3 pb-6">
                {/* Passageiro */}
                <div className="rounded-xl border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-primary" />
                    <p className="text-xs font-bold">Passageiro</p>
                  </div>
                  <Row label="Nome" value={passenger?.full_name} />
                  <Row label="Telefone" value={passenger?.phone} />
                  <Row label="E-mail" value={passenger?.email} />
                  <Row label="CPF" value={passenger?.cpf} mono />
                  {passenger?.phone && (
                    <div className="flex gap-2 mt-2">
                      <a href={`tel:${passenger.phone}`} className="flex-1 rounded-lg bg-success/15 text-success py-2 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Ligar
                      </a>
                      <button onClick={() => copy(passenger.phone, "Telefone copiado")} className="rounded-lg bg-muted py-2 px-3 text-xs font-semibold flex items-center gap-1.5">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Motorista */}
                <div className="rounded-xl border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="h-4 w-4 text-primary" />
                    <p className="text-xs font-bold">Motorista</p>
                  </div>
                  {driver ? (
                    <>
                      <Row label="Nome" value={driverProfile?.full_name} />
                      <Row label="Telefone" value={driverProfile?.phone} />
                      <Row label="Veículo" value={`${driver.vehicle_brand ?? ""} ${driver.vehicle_model ?? ""} ${driver.vehicle_color ?? ""}`} />
                      <Row label="Placa" value={driver.vehicle_plate} mono />
                      <Row label="Categoria" value={driver.category} />
                      <Row label="Avaliação" value={driver.rating ? `${Number(driver.rating).toFixed(2)} ⭐` : "—"} />
                      {driverProfile?.phone && (
                        <div className="flex gap-2 mt-2">
                          <a href={`tel:${driverProfile.phone}`} className="flex-1 rounded-lg bg-success/15 text-success py-2 text-xs font-semibold flex items-center justify-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" /> Ligar
                          </a>
                          <button onClick={() => copy(driverProfile.phone, "Telefone copiado")} className="rounded-lg bg-muted py-2 px-3 text-xs font-semibold flex items-center gap-1.5">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground py-3 text-center">Nenhum motorista atribuído</p>
                  )}
                </div>

                {/* Chat interno (se a corrida tiver) */}
                <div className="rounded-xl border bg-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold">Chat da corrida</span>
                  </div>
                  <a href="/admin/chats" className="text-xs font-semibold text-primary hover:underline">Abrir →</a>
                </div>
              </TabsContent>

              {/* ---------------- PAGAMENTO ---------------- */}
              <TabsContent value="payment" className="space-y-3 pt-3 pb-6">
                <div className="rounded-xl border bg-card p-3">
                  <Row label="Forma de pagamento" value={ride.payment_method?.toUpperCase() ?? "—"} />
                  <Row
                    label="Status"
                    value={
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                        ride.payment_status === "paid" ? "bg-success/15 text-success"
                        : ride.payment_status === "resolved" ? "bg-primary/15 text-primary"
                        : "bg-warning/15 text-warning"
                      }`}>{ride.payment_status || "pending"}</span>
                    }
                  />
                  {ride.pix_paid_at && <Row label="Confirmado em" value={new Date(ride.pix_paid_at).toLocaleString("pt-BR")} />}
                  {ride.payment_resolved_at && <Row label="Resolvido em" value={new Date(ride.payment_resolved_at).toLocaleString("pt-BR")} />}
                  <Row label="Valor cobrado" value={`R$ ${Number(ride.price ?? 0).toFixed(2)}`} />
                  <Row label="Taxa" value={`R$ ${Number(ride.platform_fee ?? 0).toFixed(2)}`} />
                  <Row label="Líquido motorista" value={`R$ ${Number(ride.driver_net ?? 0).toFixed(2)}`} />
                </div>
              </TabsContent>

              {/* ---------------- AVALIAÇÕES ---------------- */}
              <TabsContent value="ratings" className="space-y-3 pt-3 pb-6">
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Passageiro avaliou o motorista</p>
                  {ride.rating ? (
                    <>
                      <p className="text-2xl font-bold">{ride.rating} ⭐</p>
                      {ride.rating_comment && <p className="text-xs text-muted-foreground mt-1">"{ride.rating_comment}"</p>}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem avaliação</p>
                  )}
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Motorista avaliou o passageiro</p>
                  {ride.driver_rating ? (
                    <>
                      <p className="text-2xl font-bold">{ride.driver_rating} ⭐</p>
                      {ride.driver_rating_comment && <p className="text-xs text-muted-foreground mt-1">"{ride.driver_rating_comment}"</p>}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem avaliação</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RideDetailsModal;
