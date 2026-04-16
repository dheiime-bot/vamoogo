import { useState } from "react";
import { X, Banknote, QrCode, CreditCard, Check, MapPin, Clock, Navigation, Tag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PaymentMethod = "cash" | "pix" | "debit" | "credit";

export interface AppliedCoupon {
  id: string;
  code: string;
  discount: number;
}

interface PaymentMethodModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, coupon: AppliedCoupon | null) => void;
  originName: string;
  destinationName: string;
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
  open, onClose, onConfirm, originName, destinationName,
  distanceKm, durationMin, estimatedPrice, category,
}: PaymentMethodModalProps) => {
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  if (!open) return null;

  const catLabel = category === "moto" ? "Moto" : category === "premium" ? "Premium" : "Carro";
  const finalPrice = appliedCoupon ? Math.max(0, estimatedPrice - appliedCoupon.discount) : estimatedPrice;

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setValidatingCoupon(true);

    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    setValidatingCoupon(false);

    if (error || !data) { toast.error("Cupom inválido"); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { toast.error("Cupom expirado"); return; }
    if (data.max_uses && data.used_count >= data.max_uses) { toast.error("Cupom esgotado"); return; }
    if (data.min_fare && estimatedPrice < Number(data.min_fare)) {
      toast.error(`Valor mínimo: R$ ${Number(data.min_fare).toFixed(2)}`); return;
    }

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
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
          {/* Route summary */}
          <div className="rounded-2xl border bg-muted/50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-success shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Origem</p>
                <p className="text-sm font-medium truncate">{originName}</p>
              </div>
            </div>
            <div className="ml-1 h-4 border-l-2 border-dashed border-muted-foreground/30" />
            <div className="flex items-start gap-3">
              <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Destino</p>
                <p className="text-sm font-medium truncate">{destinationName}</p>
              </div>
            </div>
          </div>

          {/* Trip details */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
              <Navigation className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Distância</p>
              <p className="text-sm font-bold">{distanceKm} km</p>
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
