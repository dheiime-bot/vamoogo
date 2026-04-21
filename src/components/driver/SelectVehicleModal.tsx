import { useEffect, useState } from "react";
import { Bike, Car, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryColor, getCategoryContentColor } from "@/lib/categoryStyle";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { guardErrorMessage } from "@/lib/guardErrors";

interface Vehicle {
  id: string;
  category: "moto" | "economico" | "conforto";
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_year: number | null;
  vehicle_plate: string;
  is_active: boolean;
}

const categoryLabel = (c: string) =>
  c === "moto" ? "Moto" : c === "conforto" ? "Conforto" : "Econômico";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Quando true, força o motorista a escolher (sem botão de fechar). */
  required?: boolean;
  /** Callback após troca bem-sucedida. */
  onSelected?: (vehicleId: string) => void;
}

const SelectVehicleModal = ({ open, onOpenChange, required = false, onSelected }: Props) => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    supabase
      .from("driver_vehicles")
      .select("id, category, vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate, is_active")
      .eq("driver_id", user.id)
      .eq("status", "approved")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setVehicles((data as Vehicle[]) || []);
        setLoading(false);
      });
  }, [open, user?.id]);

  const select = async (v: Vehicle) => {
    if (v.is_active) {
      onOpenChange(false);
      return;
    }
    setSubmitting(v.id);
    const { error } = await supabase.rpc("driver_set_active_vehicle", { _vehicle_id: v.id });
    setSubmitting(null);
    if (error) {
      toast.error(guardErrorMessage(error, "Não foi possível trocar de veículo"));
      return;
    }
    toast.success(`Você está rodando como ${categoryLabel(v.category)}`);
    onSelected?.(v.id);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (required && !o) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        className={`max-w-sm w-[calc(100vw-1.5rem)] ${required ? "[&>button]:hidden" : ""}`}
        onPointerDownOutside={(e) => required && e.preventDefault()}
        onEscapeKeyDown={(e) => required && e.preventDefault()}
        onInteractOutside={(e) => required && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-display">
            {required ? "Selecione o veículo" : "Trocar veículo"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {required
              ? "Você tem mais de um veículo aprovado. Escolha qual vai usar agora."
              : "Apenas veículos aprovados aparecem aqui. Você precisa estar offline para trocar."}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nenhum veículo aprovado.
          </div>
        ) : (
          <div className="space-y-2">
            {vehicles.map((v) => {
              const Icon = v.category === "moto" ? Bike : Car;
              const isBusy = submitting === v.id;
              const catColor = getCategoryColor(v.category);
              const catContent = getCategoryContentColor(v.category);
              return (
                <button
                  key={v.id}
                  onClick={() => select(v)}
                  disabled={!!submitting}
                  className={`w-full rounded-2xl border p-3 flex items-center gap-3 text-left transition-colors ${
                    v.is_active
                      ? "bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  } disabled:opacity-50`}
                  style={v.is_active ? { borderColor: catColor } : undefined}
                >
                  <div
                    className="rounded-xl p-2.5 shrink-0"
                    style={
                      v.is_active
                        ? { backgroundColor: catColor, color: catContent }
                        : { backgroundColor: `${catColor}1f`, color: catColor }
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">
                        {[v.vehicle_brand, v.vehicle_model].filter(Boolean).join(" ") || "Veículo"}
                      </p>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          v.is_active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {categoryLabel(v.category)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {v.vehicle_color || "-"} • <span className="font-mono">{v.vehicle_plate}</span>
                      {v.vehicle_year ? ` • ${v.vehicle_year}` : ""}
                    </p>
                  </div>
                  {isBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  ) : v.is_active ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SelectVehicleModal;