import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const FLAGS = [
  { value: "complaint", label: "Reclamação" },
  { value: "fraud", label: "Fraude" },
  { value: "price_dispute", label: "Divergência de valor" },
  { value: "other", label: "Outro" },
];

interface Props {
  ride: any | null;
  onClose: () => void;
  onDone: () => void;
}

const RideIssueDialog = ({ ride, onClose, onDone }: Props) => {
  const [flag, setFlag] = useState("complaint");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!ride) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error("Informe um motivo");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("admin_mark_ride_issue" as any, {
      _ride_id: ride.id,
      _flag: flag,
      _reason: reason.trim(),
      _note: note.trim() || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Falha ao marcar");
      return;
    }
    toast.success("Corrida marcada");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!ride} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" /> Marcar como problema
          </DialogTitle>
          <DialogDescription>
            Corrida <span className="font-mono">{ride.ride_code}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {FLAGS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFlag(f.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    flag === f.value ? "bg-warning/15 border-warning text-warning" : "bg-card hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Motivo</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              placeholder="Resumo curto do problema"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Observação interna (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm min-h-[60px]"
              placeholder="Anotações para a equipe"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !reason.trim()}
              className="flex-1 rounded-xl bg-warning text-warning-foreground py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Marcar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RideIssueDialog;
