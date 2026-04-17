import { MapPin, Clock, Navigation, Banknote, QrCode, CreditCard, Star, Check, Copy } from "lucide-react";
import type { PaymentMethod } from "./PaymentMethodModal";
import { toast } from "sonner";

interface RideSummaryProps {
  ride: any;
  onRate: () => void;
}

const paymentLabels: Record<string, { label: string; icon: typeof Banknote }> = {
  cash: { label: "Dinheiro", icon: Banknote },
  pix: { label: "Pix", icon: QrCode },
  debit: { label: "Cartão Débito", icon: CreditCard },
  credit: { label: "Cartão Crédito", icon: CreditCard },
};

const RideSummary = ({ ride, onRate }: RideSummaryProps) => {
  const pm = paymentLabels[ride.payment_method || "cash"];

  const copyCode = async () => {
    if (!ride.ride_code) return;
    try {
      await navigator.clipboard.writeText(ride.ride_code);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Success header */}
      <div className="text-center py-2">
        <div className="mx-auto h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mb-3">
          <Check className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-lg font-bold font-display">Corrida finalizada!</h2>
        <p className="text-sm text-muted-foreground">Obrigado por viajar com a Vamoo</p>
        {ride.ride_code && (
          <button
            onClick={copyCode}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-mono font-semibold text-primary hover:bg-primary/10"
            title="Copiar código da corrida"
          >
            {ride.ride_code}
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Route */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-success shrink-0" />
          <p className="text-sm">{ride.origin_address?.split(" - ")[0]}</p>
        </div>
        <div className="ml-1 h-3 border-l-2 border-dashed border-muted-foreground/30" />
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />
          <p className="text-sm">{ride.destination_address?.split(" - ")[0]}</p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border p-3 text-center">
          <Navigation className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Distância</p>
          <p className="text-sm font-bold">{ride.distance_km} km</p>
        </div>
        <div className="rounded-xl border p-3 text-center">
          <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Tempo</p>
          <p className="text-sm font-bold">{ride.duration_minutes} min</p>
        </div>
        <div className="rounded-xl border p-3 text-center">
          <pm.icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Pagamento</p>
          <p className="text-sm font-bold">{pm.label}</p>
        </div>
      </div>

      {/* Total */}
      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
        <span className="text-sm font-medium">Valor total</span>
        <span className="text-2xl font-extrabold text-primary">R$ {ride.price?.toFixed(2)}</span>
      </div>

      {/* Payment instruction */}
      <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 text-center">
        {ride.payment_method === "cash" && (
          <p className="text-sm font-medium text-warning">💵 Pague em dinheiro ao motorista</p>
        )}
        {ride.payment_method === "pix" && (
          <p className="text-sm font-medium text-warning">⚡ Pague via Pix ao motorista</p>
        )}
        {(ride.payment_method === "debit" || ride.payment_method === "credit") && (
          <p className="text-sm font-medium text-warning">💳 Pague na maquininha do motorista</p>
        )}
      </div>

      {/* Rate button */}
      <button
        onClick={onRate}
        className="w-full rounded-xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow flex items-center justify-center gap-2"
      >
        <Star className="h-4 w-4" /> Avaliar motorista
      </button>
    </div>
  );
};

export default RideSummary;
