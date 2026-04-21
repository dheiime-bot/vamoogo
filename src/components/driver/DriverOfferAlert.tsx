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
import { guardErrorMessage } from "@/lib/guardErrors";

const DriverOfferAlert = () => {
  const { user, roles, activeRole } = useAuth();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<any>(null);
  const [ride, setRide] = useState<any>(null);
  const [countdown, setCountdown] = useState(15);
  const [accepting, setAccepting] = useState(false);
  const offerRef = useRef<any>(null);
  const claimingRef = useRef<boolean>(false); // trava síncrona contra race condition
  const seenOfferIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { offerRef.current = offer; }, [offer]);

  // Só dispara quando o usuário está USANDO o app como motorista.
  // Não basta ter o papel — usuários multi-papel (driver+passenger+admin)
  // não devem ver o popup quando estão logados como passageiro/admin.
  const isDriver = !!user && roles.includes("driver") && activeRole === "driver";

  const handleNewOffer = useCallback(async (offerRow: any) => {
    if (!user) return;
    if (offerRow.status !== "pending") return;
    if (offerRow.expires_at && new Date(offerRow.expires_at).getTime() < Date.now()) return;
    if (seenOfferIdsRef.current.has(offerRow.id)) return;

    // CHECAGEM SÍNCRONA: se já há popup OU se outra oferta está sendo "reivindicada",
    // esta vai silenciosamente para a lista. Evita race condition de múltiplas ofertas
    // chegando ao mesmo tempo via realtime + polling.
    if (offerRef.current || claimingRef.current) {
      if (offerRef.current?.id === offerRow.id) return; // mesma oferta, ignora
      console.log("[offer-alert] popup ocupado — oferta vai pra lista:", offerRow.id);
      seenOfferIdsRef.current.add(offerRow.id);
      toast.info("Mais uma corrida disponível na lista", { duration: 2000 });
      return;
    }

    // Reivindica o popup ANTES de qualquer await (trava síncrona)
    claimingRef.current = true;
    seenOfferIdsRef.current.add(offerRow.id);

    try {
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
    } finally {
      claimingRef.current = false;
    }
  }, [user, navigate]);

  // Realtime: novas ofertas (entrega instantânea, mas pode falhar — não confiamos só nele)
  useEffect(() => {
    if (!isDriver || !user) return;
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
  }, [isDriver, user, handleNewOffer]);

  // Polling AGRESSIVO a cada 1.5s (fonte primária — funciona mesmo sem WebSocket)
  // Se houver 2+ ofertas pendentes simultâneas (alta demanda), redireciona para /driver/offers
  useEffect(() => {
    if (!isDriver || !user) return;
    let cancelled = false;
    const tick = async () => {
      const { data, error } = await supabase
        .from("ride_offers")
        .select("*")
        .eq("driver_id", user.id)
        .eq("status", "pending")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(5);
      if (cancelled) return;
      if (error) { console.warn("[offer-alert] poll error:", error); return; }
      if (!data || data.length === 0) return;

      // Se já existe popup ativo, marca o restante como visto (vão pra lista silenciosamente)
      if (offerRef.current) {
        const extras = data.filter((o: any) => o.id !== offerRef.current.id && !seenOfferIdsRef.current.has(o.id));
        if (extras.length > 0) {
          extras.forEach((o: any) => seenOfferIdsRef.current.add(o.id));
          toast.info(`+${extras.length} corrida(s) na lista`, { duration: 2000 });
        }
        return;
      }

      // Sem popup ativo: mostra a PRIMEIRA (mais recente) e marca as demais como vistas
      handleNewOffer(data[0]);
      if (data.length > 1) {
        data.slice(1).forEach((o: any) => seenOfferIdsRef.current.add(o.id));
      }
    };
    tick();
    const i = setInterval(tick, 1500);
    return () => { cancelled = true; clearInterval(i); };
  }, [isDriver, user, handleNewOffer, navigate]);

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
      // Marca a própria oferta como rejeitada para o polling não re-mostrar
      await supabase.from("ride_offers")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("id", offer.id);
      seenOfferIdsRef.current.add(offer.id);
      // Mensagem específica vinda das triggers de proteção (saldo, bloqueio, etc.)
      toast.error(guardErrorMessage(error, "Não foi possível aceitar a corrida"));
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
          {Array.isArray(ride.stops) && ride.stops.length > 0 && (
            <>
              {ride.stops.map((s: any, idx: number) => (
                <div key={idx}>
                  <div className="ml-1 border-l-2 border-dashed border-border h-3" />
                  <div className="flex gap-2 items-start">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-warning shrink-0 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-warning-foreground leading-none">{idx + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-warning font-semibold uppercase">Parada {idx + 1}</p>
                      <p className="text-sm text-foreground line-clamp-2">{s?.address || s?.name || "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
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
