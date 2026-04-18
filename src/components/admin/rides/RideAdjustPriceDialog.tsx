import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";

interface Props {
  ride: any | null;
  onClose: () => void;
  onDone: () => void;
}

const RideAdjustPriceDialog = ({ ride, onClose, onDone }: Props) => {
  const [price, setPrice] = useState<string>("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ride) setPrice(Number(ride.price ?? 0).toFixed(2));
    else setPrice("");
    setReason("");
  }, [ride]);

  if (!ride) return null;

  const newPrice = Number(price.replace(",", "."));
  const validPrice = !isNaN(newPrice) && newPrice >= 0 && newPrice <= 5000;
  const validReason = reason.trim().length >= 3;

  const handleConfirm = async () => {
    if (!validPrice || !validReason) return;
    setLoading(true);
    const { error } = await supabase.rpc("admin_adjust_ride_price" as any, {
      _ride_id: ride.id,
      _new_price: newPrice,
      _reason: reason.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Falha ao ajustar valor");
      return;
    }
    toast.success("Valor ajustado");
    onDone();
    onClose();
  };

  const diff = newPrice - Number(ride.price ?? 0);

  return (
    <Dialog open={!!ride} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Ajustar valor
          </DialogTitle>
          <DialogDescription>
            Corrida <span className="font-mono">{ride.ride_code}</span> — valor atual{" "}
            <span className="font-bold">R$ {Number(ride.price ?? 0).toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Novo valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono"
              placeholder="0,00"
            />
            {validPrice && Math.abs(diff) > 0.001 && (
              <p className={`text-xs ${diff > 0 ? "text-success" : "text-destructive"}`}>
                Diferença: {diff > 0 ? "+" : ""}R$ {diff.toFixed(2)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">
              Motivo <span className="text-destructive">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm min-h-[70px]"
              placeholder="Ex: rota mais longa do que estimado, desconto por reclamação..."
            />
            {!validReason && reason.length > 0 && (
              <p className="text-xs text-destructive">Mínimo 3 caracteres.</p>
            )}
          </div>
          <div className="rounded-lg bg-muted p-2.5 text-xs space-y-0.5">
            <p className="font-semibold mb-1">A taxa e o líquido do motorista são recalculados automaticamente.</p>
            <p className="text-muted-foreground">Toda alteração fica registrada em auditoria com seu usuário e o motivo.</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !validPrice || !validReason}
              className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RideAdjustPriceDialog;
