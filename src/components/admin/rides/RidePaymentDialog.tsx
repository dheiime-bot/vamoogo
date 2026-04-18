import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, CheckCircle2 } from "lucide-react";

interface Props {
  ride: any | null;
  onClose: () => void;
  onDone: () => void;
}

const STATUSES = [
  { value: "pending", label: "Pendente", desc: "Aguardando pagamento" },
  { value: "paid", label: "Pago", desc: "Confirmado pelo motorista/sistema" },
  { value: "resolved", label: "Resolvido", desc: "Divergência encerrada manualmente" },
];

const RidePaymentDialog = ({ ride, onClose, onDone }: Props) => {
  const [status, setStatus] = useState<string>(ride?.payment_status || "pending");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!ride) return null;

  const handleConfirm = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("admin_resolve_ride_payment" as any, {
      _ride_id: ride.id,
      _new_status: status,
      _note: note.trim() || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Falha");
      return;
    }
    toast.success("Pagamento atualizado");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!ride} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Pagamento
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono">{ride.ride_code}</span> — {ride.payment_method?.toUpperCase() || "—"} —{" "}
            R$ {Number(ride.price ?? 0).toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Status</label>
            <div className="space-y-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    status === s.value ? "bg-primary/10 border-primary" : "bg-card hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    {status === s.value && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Observação (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm min-h-[60px]"
              placeholder="Ex: pagamento confirmado por PIX manual"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
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

export default RidePaymentDialog;
