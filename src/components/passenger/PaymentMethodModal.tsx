import { useState } from "react";
import { X, Banknote, QrCode, CreditCard, Check, MapPin, Clock, Navigation } from "lucide-react";

export type PaymentMethod = "cash" | "pix" | "debit" | "credit";

interface PaymentMethodModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (method: PaymentMethod) => void;
  originName: string;
  destinationName: string;
  distanceKm: number;
  durationMin: number;
  estimatedPrice: number;
  category: string;
}

const paymentOptions: { id: PaymentMethod; label: string; icon: typeof Banknote; desc: string }[] = [
  { id: "cash", label: "Dinheiro", icon: Banknote, desc: "Pague em espécie ao motorista" },
  { id: "pix", label: "Pix", icon: QrCode, desc: "QR Code ou chave Pix" },
  { id: "debit", label: "Débito", icon: CreditCard, desc: "Cartão na maquininha" },
  { id: "credit", label: "Crédito", icon: CreditCard, desc: "Cartão na maquininha" },
];

const PaymentMethodModal = ({
  open, onClose, onConfirm, originName, destinationName,
  distanceKm, durationMin, estimatedPrice, category,
}: PaymentMethodModalProps) => {
  const [selected, setSelected] = useState<PaymentMethod | null>(null);

  if (!open) return null;

  const catLabel = category === "moto" ? "Moto" : category === "premium" ? "Premium" : "Carro";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-t-3xl bg-card shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold font-display">Confirmar corrida</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
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

          {/* Confirm button */}
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="w-full rounded-xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {selected ? `Confirmar • R$ ${estimatedPrice.toFixed(2)}` : "Escolha a forma de pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodModal;
