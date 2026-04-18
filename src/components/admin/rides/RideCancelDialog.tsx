import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { XCircle } from "lucide-react";

const REASONS = [
  { value: "passenger_no_show", label: "Passageiro não apareceu" },
  { value: "driver_no_show", label: "Motorista não apareceu" },
  { value: "system_error", label: "Erro no sistema" },
  { value: "duplicate", label: "Corrida duplicada" },
  { value: "other", label: "Outro motivo" },
];

interface Props {
  rideId: string | null;
  rideCode?: string;
  onClose: () => void;
  onDone: () => void;
}

const RideCancelDialog = ({ rideId, rideCode, onClose, onDone }: Props) => {
  const [reason, setReason] = useState("passenger_no_show");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!rideId) return;
    setLoading(true);
    const reasonLabel = REASONS.find((r) => r.value === reason)?.label || reason;
    const finalReason = extra ? `${reasonLabel} — ${extra}` : reasonLabel;
    const { error } = await supabase.rpc("admin_cancel_ride" as any, {
      _ride_id: rideId,
      _reason: finalReason,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Falha ao cancelar");
      return;
    }
    toast.success("Corrida cancelada");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!rideId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" /> Cancelar corrida
          </DialogTitle>
          <DialogDescription>
            {rideCode ? `Corrida ${rideCode}` : "Selecione um motivo para registrar o cancelamento."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Observação (opcional)</label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm min-h-[60px]"
              placeholder="Detalhes adicionais para auditoria..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Voltar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 rounded-xl bg-destructive text-destructive-foreground py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {loading ? "Cancelando..." : "Confirmar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RideCancelDialog;
