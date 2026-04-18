import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText } from "lucide-react";

interface Props {
  ride: any | null;
  onClose: () => void;
  onDone: () => void;
}

const RideAddNoteDialog = ({ ride, onClose, onDone }: Props) => {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!ride) return null;

  const handleConfirm = async () => {
    if (!note.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("admin_add_ride_note" as any, {
      _ride_id: ride.id, _note: note.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Falha");
      return;
    }
    toast.success("Observação registrada");
    setNote("");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!ride} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Observação interna
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono">{ride.ride_code}</span> — fica registrada em auditoria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm min-h-[100px]"
            placeholder="Anotação para a equipe..."
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !note.trim()}
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

export default RideAddNoteDialog;
