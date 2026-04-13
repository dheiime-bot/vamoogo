import { useEffect, useState } from "react";
import { Save, Bike, Car, Crown, Loader2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminTariffs = () => {
  const [activeTab, setActiveTab] = useState("categories");
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("tariffs").select("*").order("category").then(({ data }) => {
      if (data) setTariffs(data);
    });
  }, []);

  const updateTariff = (id: string, field: string, value: string) => {
    setTariffs((prev) => prev.map((t) => t.id === id ? { ...t, [field]: parseFloat(value.replace(",", ".")) || 0 } : t));
  };

  const saveTariffs = async () => {
    setSaving(true);
    for (const t of tariffs) {
      await supabase.from("tariffs").update({
        base_fare: t.base_fare,
        per_km: t.per_km,
        per_minute: t.per_minute,
        min_fare: t.min_fare,
        passenger_extra: t.passenger_extra,
        region_multiplier: t.region_multiplier,
      }).eq("id", t.id);
    }
    setSaving(false);
    toast.success("Tarifas salvas!");
  };

  const tabs = [
    { id: "categories", label: "Categorias" },
    { id: "passengers", label: "Passageiros" },
    { id: "fees", label: "Taxas" },
  ];

  const catIcon: Record<string, any> = { moto: Bike, car: Car, premium: Crown };

  return (
    <AdminLayout title="Configuração de Tarifas">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "categories" && (
        <div className="space-y-4">
          {tariffs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarifa configurada. Insira tarifas no banco.</p>}
          {tariffs.map((t) => {
            const Icon = catIcon[t.category] || Car;
            return (
              <div key={t.id} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-xl bg-primary/10 p-2.5"><Icon className="h-5 w-5 text-primary" /></div>
                  <h3 className="text-base font-bold capitalize">{t.category}</h3>
                  <span className="text-xs text-muted-foreground">({t.region})</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Taxa base", field: "base_fare", value: t.base_fare },
                    { label: "Por KM", field: "per_km", value: t.per_km },
                    { label: "Por minuto", field: "per_minute", value: t.per_minute },
                    { label: "Tarifa mínima", field: "min_fare", value: t.min_fare },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                      <div className="mt-1 flex items-center rounded-lg border bg-background px-3 py-2">
                        <span className="text-sm text-muted-foreground mr-1">R$</span>
                        <input type="text" value={f.value?.toFixed(2)} onChange={(e) => updateTariff(t.id, f.field, e.target.value)}
                          className="flex-1 bg-transparent text-sm font-semibold outline-none" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "passengers" && (
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-bold mb-4">Adicional por passageiro</h3>
          {tariffs.slice(0, 1).map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Valor extra por passageiro adicional</span>
                <div className="flex items-center rounded-lg border bg-background px-3 py-2">
                  <span className="text-sm text-muted-foreground mr-1">+R$</span>
                  <input type="text" value={t.passenger_extra?.toFixed(2)} onChange={(e) => updateTariff(t.id, "passenger_extra", e.target.value)}
                    className="w-16 bg-transparent text-sm font-bold outline-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "fees" && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <h3 className="font-bold">Taxa da plataforma</h3>
          <p className="text-sm text-muted-foreground">A taxa é de 15% aplicada sobre o valor total da corrida. Configurável via platform_settings.</p>
        </div>
      )}

      <button onClick={saveTariffs} disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar configurações
      </button>
    </AdminLayout>
  );
};

export default AdminTariffs;
