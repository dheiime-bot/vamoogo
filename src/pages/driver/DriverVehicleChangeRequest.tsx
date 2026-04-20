import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Car, Bike, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import DocumentUpload from "@/components/auth/DocumentUpload";
import { validatePlate } from "@/lib/plateValidator";

type Category = "moto" | "economico" | "conforto";

const categoryOptions: { value: Category; label: string; Icon: typeof Car }[] = [
  { value: "moto", label: "Moto", Icon: Bike },
  { value: "economico", label: "Econômico", Icon: Car },
  { value: "conforto", label: "Conforto", Icon: Sparkles },
];

const DriverVehicleChangeRequest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasPending, setHasPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newCategory, setNewCategory] = useState<Category>("economico");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");
  const [reason, setReason] = useState("");

  const [crlv, setCrlv] = useState<string | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("vehicle_change_requests")
      .select("id")
      .eq("driver_id", user.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => {
        setHasPending(!!data);
        setLoading(false);
      });
  }, [user?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!brand.trim() || !model.trim() || !color.trim() || !plate.trim()) {
      toast.error("Preencha marca, modelo, cor e placa");
      return;
    }
    if (!validatePlate(plate)) {
      toast.error("Placa inválida (formato AAA0000 ou AAA0A00)");
      return;
    }
    if (!crlv || !front || !back || !left || !right) {
      toast.error("Envie o CRLV e as 4 fotos do veículo");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("driver_request_vehicle_change", {
      _new_category: newCategory,
      _vehicle_brand: brand.trim(),
      _vehicle_model: model.trim(),
      _vehicle_color: color.trim(),
      _vehicle_year: year ? parseInt(year, 10) : null,
      _vehicle_plate: plate.trim().toUpperCase(),
      _crlv_url: crlv,
      _vehicle_photo_front_url: front,
      _vehicle_photo_back_url: back,
      _vehicle_photo_left_url: left,
      _vehicle_photo_right_url: right,
      _reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Solicitação enviada! Aguarde análise do admin.");
    navigate("/driver/vehicles");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate("/driver/vehicles")}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-display font-bold">Solicitar mudança de veículo</h1>
      </header>

      {hasPending ? (
        <div className="px-4 py-6">
          <div className="rounded-2xl border border-warning/40 bg-warning/10 p-5 text-center">
            <p className="text-sm font-semibold">Você já tem uma solicitação pendente</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aguarde a análise do administrador antes de enviar uma nova.
            </p>
            <button
              onClick={() => navigate("/driver/vehicles")}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Voltar para meus veículos
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="px-4 py-5 space-y-5 max-w-xl mx-auto">
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Nova categoria</p>
            <div className="grid grid-cols-3 gap-2">
              {categoryOptions.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNewCategory(value)}
                  className={`rounded-xl border p-3 flex flex-col items-center gap-1 transition-colors ${
                    newCategory === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Dados do veículo</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marca" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelo" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Cor" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Ano" inputMode="numeric" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="Placa (AAA0A00)" className="col-span-2 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary" maxLength={8} />
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Documentos & fotos</p>
            <DocumentUpload label="CRLV (frente)" bucket="driver-documents" pathPrefix={`${user?.id}/vehicle-change/crlv`} value={crlv} onChange={setCrlv} acceptPdf />
            <div className="grid grid-cols-2 gap-2">
              <DocumentUpload label="Foto frente" bucket="driver-documents" pathPrefix={`${user?.id}/vehicle-change/front`} value={front} onChange={setFront} capture="environment" />
              <DocumentUpload label="Foto traseira" bucket="driver-documents" pathPrefix={`${user?.id}/vehicle-change/back`} value={back} onChange={setBack} capture="environment" />
              <DocumentUpload label="Lateral esquerda" bucket="driver-documents" pathPrefix={`${user?.id}/vehicle-change/left`} value={left} onChange={setLeft} capture="environment" />
              <DocumentUpload label="Lateral direita" bucket="driver-documents" pathPrefix={`${user?.id}/vehicle-change/right`} value={right} onChange={setRight} capture="environment" />
            </div>
          </section>

          <section className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Motivo (opcional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Ex: Comprei um carro novo / mudança para conforto" />
          </section>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Enviando..." : "Enviar solicitação"}
          </button>
        </form>
      )}
    </div>
  );
};

export default DriverVehicleChangeRequest;