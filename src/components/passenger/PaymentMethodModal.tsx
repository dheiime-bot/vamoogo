import { useState } from "react";
import { X, Banknote, QrCode, CreditCard, Check, MapPin, Clock, Navigation, Tag, Loader2, Users, RotateCcw, User as UserIcon, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PaymentMethod = "cash" | "pix" | "debit" | "credit";

export interface AppliedCoupon {
  id: string;
  code: string;
  discount: number;
}

export interface RouteStop {
  name: string;
  address?: string;
}

interface PaymentMethodModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, coupon: AppliedCoupon | null) => void;
  originName: string;
  originAddress?: string;
  destinationName: string;
  destinationAddress?: string;
  stops?: RouteStop[];
  returnToOrigin?: boolean;
  passengerCount?: number;
  forOtherPerson?: boolean;
  otherPersonName?: string;
  otherPersonPhone?: string;
  distanceKm: number;
  durationMin: number;
  estimatedPrice: number;
  category: string;
}

const paymentOptions: { id: PaymentMethod; label: string; icon: typeof Banknote; desc: string }[] = [
  { id: "cash", label: "Dinheiro", icon: Banknote, desc: "Pague em espécie" },
  { id: "pix", label: "Pix", icon: QrCode, desc: "QR Code ou chave" },
  { id: "debit", label: "Débito", icon: CreditCard, desc: "Cartão na maquininha" },
  { id: "credit", label: "Crédito", icon: CreditCard, desc: "Cartão na maquininha" },
];

const PaymentMethodModal = ({
  open, onClose, onConfirm, originName, originAddress, destinationName, destinationAddress,
  stops = [], returnToOrigin = false, passengerCount = 1,
  forOtherPerson = false, otherPersonName, otherPersonPhone,
  distanceKm, durationMin, estimatedPrice, category,
}: PaymentMethodModalProps) => {
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  if (!open) return null;

  const catLabel = category === "moto" ? "Moto" : category === "conforto" ? "Conforto" : "Econômico";
  const finalPrice = appliedCoupon ? Math.max(0, estimatedPrice - appliedCoupon.discount) : estimatedPrice;

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setValidatingCoupon(true);

    // Valida via RPC segura (não expõe a tabela coupons)
    const { data: rows, error } = await supabase.rpc("passenger_validate_coupon", {
      _code: code,
      _fare: estimatedPrice,
    });

    setValidatingCoupon(false);

    const data = Array.isArray(rows) ? rows[0] : null;
    if (error || !data) { toast.error("Cupom inválido ou não aplicável"); return; }

    const discount = data.discount_type === "percentage"
      ? estimatedPrice * (Number(data.discount_value) / 100)
      : Number(data.discount_value);

    setAppliedCoupon({ id: data.id, code: data.code, discount: Math.min(discount, estimatedPrice) });
    toast.success(`Cupom aplicado! -R$ ${discount.toFixed(2)}`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-t-3xl bg-card shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-bold font-display">Confirmar corrida</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Roteiro detalhado */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" /> Roteiro da viagem
            </p>
            <div className="rounded-2xl border bg-muted/50 p-4">
              {/* Origem */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className="mt-1.5 h-3 w-3 rounded-full bg-success ring-4 ring-success/20" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-success">Origem</p>
                  <p className="text-sm font-semibold truncate">{originName}</p>
                  {originAddress && originAddress !== originName && (
                    <p className="text-xs text-muted-foreground truncate">{originAddress}</p>
                  )}
                </div>
              </div>

              {/* Paradas intermediárias */}
              {stops.map((stop, i) => (
                <div key={i}>
                  <div className="ml-1.5 h-4 border-l-2 border-dashed border-muted-foreground/40" />
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="mt-1.5 h-3 w-3 rounded-full bg-warning ring-4 ring-warning/20 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-warning-foreground">{i + 1}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-warning">Parada {i + 1}</p>
                      <p className="text-sm font-semibold truncate">{stop.name}</p>
                      {stop.address && stop.address !== stop.name && (
                        <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Destino */}
              <div className="ml-1.5 h-4 border-l-2 border-dashed border-muted-foreground/40" />
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className="mt-1.5 h-3 w-3 rounded-full bg-destructive ring-4 ring-destructive/20" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-destructive">Destino</p>
                  <p className="text-sm font-semibold truncate">{destinationName}</p>
                  {destinationAddress && destinationAddress !== destinationName && (
                    <p className="text-xs text-muted-foreground truncate">{destinationAddress}</p>
                  )}
                </div>
              </div>

              {/* Retorno à origem */}
              {returnToOrigin && (
                <>
                  <div className="ml-1.5 h-4 border-l-2 border-dashed border-primary/50" />
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="mt-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20 flex items-center justify-center">
                        <RotateCcw className="h-2 w-2 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Retorno</p>
                      <p className="text-sm font-semibold truncate">{originName}</p>
                      <p className="text-xs text-muted-foreground">Volta ao ponto de origem</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Resumo de paradas + passageiros */}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium">
                <MapPin className="h-3 w-3 text-primary" />
                {stops.length === 0
                  ? "Sem paradas"
                  : `${stops.length} ${stops.length === 1 ? "parada" : "paradas"}`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium">
                <Users className="h-3 w-3 text-primary" />
                {passengerCount} {passengerCount === 1 ? "passageiro" : "passageiros"}
              </span>
              {returnToOrigin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  <RotateCcw className="h-3 w-3" /> Ida e volta
                </span>
              )}
            </div>
          </div>

          {/* Para outra pessoa */}
          {forOtherPerson && (otherPersonName || otherPersonPhone) && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-2 flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Corrida para outra pessoa
              </p>
              <div className="space-y-1">
                {otherPersonName && (
                  <div className="flex items-center gap-2 text-sm">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-semibold truncate">{otherPersonName}</span>
                  </div>
                )}
                {otherPersonPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{otherPersonPhone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detalhes da viagem */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
              <Navigation className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Distância</p>
              <p className="text-sm font-bold">{distanceKm.toFixed(1)} km</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
              <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Tempo</p>
              <p className="text-sm font-bold">~{durationMin} min</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
              <MapPin className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{catLabel}</p>
              <p className="text-sm font-bold text-primary">R$ {estimatedPrice.toFixed(2)}</p>
            </div>
          </div>

          {/* Coupon */}
          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> Cupom de desconto</p>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-xl border-2 border-success bg-success/5 p-3">
                <div>
                  <p className="text-sm font-bold text-success">{appliedCoupon.code}</p>
                  <p className="text-xs text-muted-foreground">−R$ {appliedCoupon.discount.toFixed(2)}</p>
                </div>
                <button onClick={handleRemoveCoupon} className="rounded-lg p-1.5 hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Código do cupom"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border bg-muted px-3 py-2.5 text-sm outline-none uppercase placeholder:normal-case"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim() || validatingCoupon}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
                >
                  {validatingCoupon && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Aplicar
                </button>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div>
            <p className="text-sm font-semibold mb-3">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelected(opt.id)}
                  className={`relative flex items-center gap-3 rounded-xl border-2 p-3.5 transition-all text-left ${
                    selected === opt.id
                      ? "border-primary bg-primary/5 shadow-glow"
                      : "border-transparent bg-muted hover:border-border"
                  }`}
                >
                  <opt.icon className={`h-5 w-5 shrink-0 ${selected === opt.id ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{opt.desc}</p>
                  </div>
                  {selected === opt.id && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky footer with confirm button */}
        <div className="border-t bg-card p-4 shrink-0 space-y-2">
          {appliedCoupon && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="line-through text-muted-foreground">R$ {estimatedPrice.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total a pagar</span>
            <span className="text-xl font-extrabold text-primary">R$ {finalPrice.toFixed(2)}</span>
          </div>
          <button
            onClick={() => selected && onConfirm(selected, appliedCoupon)}
            disabled={!selected}
            className="w-full rounded-xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {selected ? `Confirmar corrida • R$ ${finalPrice.toFixed(2)}` : "Escolha a forma de pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodModal;
