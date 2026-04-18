/**
 * DriverOfferAlert — popup global de nova corrida para motorista.
 *
 * 100% à prova de falhas:
 *  - Polling rápido (1.5s) é a fonte PRIMÁRIA — não depende de WebSocket
 *  - Realtime postgres_changes funciona como bônus (entrega instantânea)
 *  - Não depende de `roles` carregado — basta `user.id` + ter linha em `drivers`
 *  - Som + vibração ao chegar; loop até interagir
 *  - Aceitar: update atômico (apenas 1 motorista vence)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, MapPin, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/brFormat";
import { toast } from "sonner";
import { playOfferAlert } from "@/lib/offerSound";

const DriverOfferAlert = () => {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<any>(null);
  const [ride, setRide] = useState<any>(null);
  const [countdown, setCountdown] = useState(15);
  const [accepting, setAccepting] = useState(false);
  const offerRef = useRef<any>(null);
  const seenOfferIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { offerRef.current = offer; }, [offer]);

  // Só dispara para usuários com o papel "driver" carregado.
  // Antes aceitávamos roles.length === 0 (ainda carregando), o que causava
  // o popup de oferta aparecer para passageiros (mesmo user.id em ambos os papéis em testes).
  const isDriver = !!user && roles.includes("driver");

  const handleNewOffer = useCallback(async (offerRow: any) => {
    if (!user) return;
    if (offerRef.current) return; // já tem uma sendo mostrada
    if (offerRow.status !== "pending") return;
    if (offerRow.expires_at && new Date(offerRow.expires_at).getTime() < Date.now()) return;
    if (seenOfferIdsRef.current.has(offerRow.id)) return;
    seenOfferIdsRef.current.add(offerRow.id);

    // Confirma motorista NÃO está em corrida ativa
    const { data: active } = await supabase
      .from("rides").select("id")
      .eq("driver_id", user.id)
      .in("status", ["accepted", "in_progress"])
      .limit(1);
    if (active && active.length > 0) {
      console.log("[offer-alert] driver busy with active ride, skipping");
      return;
    }

    const { data: r } = await supabase
      .from("rides").select("*").eq("id", offerRow.ride_id).maybeSingle();
    if (!r || r.status !== "requested") {
      console.log("[offer-alert] ride not in requested state:", r?.status);
      return;
    }

    console.log("[offer-alert] 🚗 NEW OFFER", offerRow.id);
    setOffer(offerRow);
    setRide(r);
    playOfferAlert({
      title: "Nova corrida! 🚗",
      body: `${r.origin_address?.slice(0, 60) ?? "Embarque"} → ${r.destination_address?.slice(0, 60) ?? "Destino"}`,
    });
    toast.success("Nova corrida! 🚗");
  }, [user]);

  // Realtime: novas ofertas (entrega instantânea, mas pode falhar — não confiamos só nele)
  useEffect(() => {
    if (!isPossiblyDriver || !user) return;
    console.log("[offer-alert] subscribe for", user.id);

    const channel = supabase
      .channel(`offer-alert-${user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_offers", filter: `driver_id=eq.${user.id}` },
        (payload) => {
          console.log("[offer-alert] RT INSERT", payload.new);
          handleNewOffer(payload.new as any);
        }
      )
      .subscribe((s) => console.log("[offer-alert] channel status:", s));
    return () => { supabase.removeChannel(channel); };
  }, [isPossiblyDriver, user, handleNewOffer]);

  // Polling AGRESSIVO a cada 1.5s (fonte primária — funciona mesmo sem WebSocket)
  useEffect(() => {
    if (!isPossiblyDriver || !user) return;
    let cancelled = false;
    const tick = async () => {
      if (offerRef.current) return;
      const { data, error } = await supabase
        .from("ride_offers")
        .select("*")
        .eq("driver_id", user.id)
        .eq("status", "pending")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (error) { console.warn("[offer-alert] poll error:", error); return; }
      if (!data || data.length === 0) return;
      handleNewOffer(data[0]);
    };
    tick();
    const i = setInterval(tick, 1500);
    return () => { cancelled = true; clearInterval(i); };
  }, [isPossiblyDriver, user, handleNewOffer]);

  // Countdown
  useEffect(() => {
    if (!offer) return;
    const expiresAt = new Date(offer.expires_at).getTime();
    setCountdown(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    const i = setInterval(() => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setCountdown(left);
      if (left <= 0) {
        setOffer(null);
        setRide(null);
        clearInterval(i);
      }
    }, 500);
    return () => clearInterval(i);
  }, [offer]);

  const handleAccept = async () => {
    if (!offer || !ride || !user) return;
    setAccepting(true);
    const { data: updated, error } = await supabase
      .from("rides")
      .update({ driver_id: user.id, status: "accepted" })
      .eq("id", ride.id)
      .eq("status", "requested")
      .is("driver_id", null)
      .select()
      .single();
    if (error || !updated) {
      toast.error("Outro motorista já aceitou esta corrida");
      setOffer(null); setRide(null); setAccepting(false);
      return;
    }
    await supabase.from("ride_offers")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", offer.id);
    setOffer(null); setRide(null); setAccepting(false);
    toast.success("Corrida aceita! 🚗");
    navigate("/driver");
  };

  const handleReject = async () => {
    if (!offer) return;
    await supabase.from("ride_offers")
      .update({ status: "rejected", responded_at: new Date().toISOString() })
      .eq("id", offer.id);
    setOffer(null); setRide(null);
    toast("Corrida recusada");
  };

  if (!offer || !ride) return null;

  const earning = Number(ride.driver_net ?? ride.price ?? 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-md bg-card border-t-4 sm:border border-primary rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center animate-pulse">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Nova corrida</span>
          </div>
          <span className={`text-2xl font-extrabold tabular-nums ${countdown <= 5 ? "text-destructive animate-pulse" : "text-warning"}`}>
            {countdown}s
          </span>
        </div>

        <div className="bg-success/10 border border-success/20 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-success uppercase">Você recebe</span>
          <span className="text-xl font-extrabold text-success">{formatBRL(earning)}</span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex gap-2">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-success shrink-0" />
            <p className="text-sm text-foreground line-clamp-2">{ride.origin_address}</p>
          </div>
          <div className="ml-1 border-l-2 border-dashed border-border h-3" />
          <div className="flex gap-2">
            <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-foreground line-clamp-2">{ride.destination_address}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-4">
          <span>{ride.passenger_count ?? 1} passageiro(s)</span>
          <span>{ride.payment_method === "pix" ? "Pix" : ride.payment_method === "cash" ? "Dinheiro" : ride.payment_method === "debit" ? "Débito" : ride.payment_method === "credit" ? "Crédito" : "—"}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={accepting}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-3.5 text-sm font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" /> Recusar
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-lg disabled:opacity-50"
          >
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverOfferAlert;
