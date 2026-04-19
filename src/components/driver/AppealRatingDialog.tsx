import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, ShieldAlert } from "lucide-react";

interface AppealRatingDialogProps {
  open: boolean;
  onClose: () => void;
  ride: { id: string; ride_code: string | null; rating: number | null; rating_comment?: string | null } | null;
  onSuccess?: () => void;
}

const AppealRatingDialog = ({ open, onClose, ride, onSuccess }: AppealRatingDialogProps) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!ride) return;
    if (reason.trim().length < 10) {
      toast.error("Descreva com pelo menos 10 caracteres");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("appeal_rating" as any, { _ride_id: ride.id, _reason: reason.trim() });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Recurso enviado! O admin vai analisar.");
    setReason("");
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setReason(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-warning" /> Contestar avaliação
          </DialogTitle>
        </DialogHeader>
        {ride && (
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted p-3 text-sm">
              <p className="font-mono text-xs text-primary">{ride.ride_code}</p>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s <= (ride.rating || 0) ? "text-warning fill-warning" : "text-muted-foreground"}`}
                  />
                ))}
                <span className="ml-1 text-xs text-muted-foreground">({ride.rating}★ recebida)</span>
              </div>
              {ride.rating_comment && (
                <p className="mt-2 text-xs text-muted-foreground italic">"{ride.rating_comment}"</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Por que essa avaliação foi injusta? (mín. 10 caracteres)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: O passageiro deu nota baixa porque o trânsito estava parado, mas isso fugia ao meu controle."
                className="mt-1 w-full rounded-xl border bg-background p-3 text-sm outline-none resize-none h-24"
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{reason.length}/500</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ⚠️ Se o admin aceitar, sua nota será ajustada para 5★ e sua média recalculada.
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting || reason.trim().length < 10}
              className="w-full rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {submitting ? "Enviando..." : "Enviar recurso"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AppealRatingDialog;
