import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { guardErrorMessage } from "@/lib/guardErrors";

type Role = "passenger" | "driver";

const REASONS: Record<Role, { value: string; label: string }[]> = {
  passenger: [
    { value: "changed_mind", label: "Mudei de ideia" },
    { value: "long_wait", label: "Motorista está demorando" },
    { value: "wrong_address", label: "Errei o endereço" },
    { value: "driver_no_show", label: "Motorista não veio" },
    { value: "other", label: "Outro motivo" },
  ],
  driver: [
    { value: "passenger_no_show", label: "Passageiro não apareceu" },
    { value: "wrong_pickup", label: "Endereço de embarque inacessível" },
    { value: "vehicle_problem", label: "Problema no veículo" },
    { value: "passenger_request", label: "Passageiro pediu para cancelar" },
    { value: "other", label: "Outro motivo" },
  ],
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
  rideId: string | null;
  /** Quem está cancelando — define a lista de motivos exibida. */
  role: Role;
  /** true se a corrida já foi aceita pelo motorista (mostra aviso de punição). */
  afterAccept: boolean;
}

/**
 * Modal único de cancelamento (passageiro/motorista).
 * - Antes do aceite: cancelamento livre, sem aviso de punição.
 * - Após o aceite: mostra aviso e exige motivo. A janela de cortesia (2 min)
 *   é tratada no backend (RPC `cancel_ride`).
 */
const CancelRideDialog = ({ open, onClose, onCancelled, rideId, role, afterAccept }: Props) => {
  const reasons = REASONS[role];
  const [reason, setReason] = useState(reasons[0].value);
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!rideId) return;
    setLoading(true);
    const reasonLabel = reasons.find((r) => r.value === reason)?.label || reason;
    const finalReason = extra.trim() ? `${reasonLabel} — ${extra.trim().slice(0, 280)}` : reasonLabel;
    const { data, error } = await supabase.rpc("cancel_ride" as any, {
      _ride_id: rideId,
      _reason: finalReason,
    });
    setLoading(false);
    if (error) {
      toast.error(guardErrorMessage(error, "Não foi possível cancelar"));
      return;
    }
    const counted = (data as any)?.counted_for_punishment;
    if (counted) {
      toast.warning("Corrida cancelada. Esta ação foi registrada e pode resultar em bloqueio.");
    } else {
      toast.success("Corrida cancelada");
    }
    onCancelled();
    onClose();
    setExtra("");
    setReason(reasons[0].value);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" /> Cancelar corrida
          </DialogTitle>
          <DialogDescription>
            {afterAccept
              ? "Selecione um motivo para o cancelamento."
              : "Tem certeza que deseja cancelar?"}
          </DialogDescription>
        </DialogHeader>

        {afterAccept && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-warning">Atenção: pode gerar punição</p>
              <p className="text-muted-foreground">
                Cancelar nos primeiros 2 minutos após o aceite não conta. Após esse prazo,
                cada cancelamento é registrado. <span className="font-semibold">A cada 3 cancelamentos no mesmo dia
                você fica bloqueado temporariamente</span> (2h, 5h, 12h, 24h, 48h…).
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              disabled={loading}
            >
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Detalhes (opcional)</label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              maxLength={280}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm min-h-[60px]"
              placeholder="Conte rapidamente o que aconteceu..."
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 rounded-xl bg-destructive text-destructive-foreground py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Cancelando..." : "Confirmar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelRideDialog;