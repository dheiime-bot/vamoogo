import { useEffect, useState } from "react";
import { Save, Bike, Car, Crown, Loader2, Percent, Heart } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

const AdminTariffs = () => {
  const [activeTab, setActiveTab] = useState("categories");
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [globalFee, setGlobalFee] = useState<string>("15");
  const [favoriteCallMaxKm, setFavoriteCallMaxKm] = useState<string>("5");
  const [saving, setSaving] = useState(false);

  const loadAll = () => {
    Promise.all([
      supabase.from("tariffs").select("*").order("category"),
      supabase.from("platform_settings").select("value").eq("key", "global_fee_percent").maybeSingle(),
      supabase.from("platform_settings").select("value").eq("key", "favorite_call_max_km").maybeSingle(),
    ]).then(([tRes, sRes, fRes]) => {
      if (tRes.data) setTariffs(tRes.data);
      if (sRes.data?.value !== undefined && sRes.data?.value !== null) {
        setGlobalFee(String(sRes.data.value));
      }
      if (fRes.data?.value !== undefined && fRes.data?.value !== null) {
        setFavoriteCallMaxKm(String(fRes.data.value));
      }
    });
  };
  useEffect(() => { loadAll(); }, []);
  useRealtimeRefresh(["tariffs", "platform_settings"], loadAll, "admin-tariffs");

  const updateTariff = (id: string, field: string, value: string) => {
    setTariffs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value === "" ? null : parseFloat(value.replace(",", ".")) || 0 } : t))
    );
  };

  const saveTariffs = async () => {
    setSaving(true);
    try {
      // Salva tarifas (incluindo override de fee_percent por categoria)
      for (const t of tariffs) {
        await supabase
          .from("tariffs")
          .update({
            base_fare: t.base_fare,
            per_km: t.per_km,
            per_minute: t.per_minute,
            min_fare: t.min_fare,
            passenger_extra: t.passenger_extra,
            region_multiplier: t.region_multiplier,
            fee_percent: t.fee_percent === null || t.fee_percent === undefined || t.fee_percent === "" ? null : Number(t.fee_percent),
          })
          .eq("id", t.id);
      }

      // Salva taxa global
      const pct = Math.max(0, Math.min(100, parseFloat(globalFee.replace(",", ".")) || 0));
      await supabase
        .from("platform_settings")
        .update({ value: pct as any })
        .eq("key", "global_fee_percent");

      // Salva distância máxima do botão Chamar (favoritos)
      const km = Math.max(0.5, Math.min(50, parseFloat(favoriteCallMaxKm.replace(",", ".")) || 5));
      await supabase
        .from("platform_settings")
        .upsert({ key: "favorite_call_max_km", value: km as any }, { onConflict: "key" });

      toast.success("Configurações salvas!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "categories", label: "Categorias" },
    { id: "passengers", label: "Passageiros" },
    { id: "fees", label: "Taxa da plataforma" },
  ];

  const catIcon: Record<string, any> = { moto: Bike, economico: Car, conforto: Crown };

  return (
    <AdminLayout title="Configuração de Tarifas">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "categories" && (
        <div className="space-y-4">
          {tariffs.length === 0 && (
            <EmptyState title="Nenhuma tarifa configurada" description="Configure as tarifas por categoria para começar a precificar corridas." />
          )}
          {tariffs.map((t) => {
            const Icon = catIcon[t.category] || Car;
            return (
              <div key={t.id} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-bold capitalize">{t.category}</h3>
                  <span className="text-xs text-muted-foreground">({t.region})</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Taxa base", field: "base_fare", value: t.base_fare, suffix: "" },
                    { label: "Por KM", field: "per_km", value: t.per_km, suffix: "/km" },
                    { label: "Por minuto", field: "per_minute", value: t.per_minute, suffix: "/min" },
                    { label: "Tarifa mínima", field: "min_fare", value: t.min_fare, suffix: "" },
                    { label: "Extra por passageiro", field: "passenger_extra", value: t.passenger_extra, suffix: "/km", hint: "R$ por km, por passageiro além do 1º" },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                      <div className="mt-1 flex items-center rounded-lg border bg-background px-3 py-2">
                        <span className="text-sm text-muted-foreground mr-1">R$</span>
                        <input
                          type="text"
                          value={f.value?.toFixed(2)}
                          onChange={(e) => updateTariff(t.id, f.field, e.target.value)}
                          className="flex-1 bg-transparent text-sm font-semibold outline-none"
                        />
                        {f.suffix && <span className="text-[10px] text-muted-foreground ml-1">{f.suffix}</span>}
                      </div>
                      {f.hint && <p className="text-[10px] text-muted-foreground mt-0.5">{f.hint}</p>}
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
          <h3 className="font-bold mb-1">Adicional por passageiro extra</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Valor cobrado <strong>por km</strong> para cada passageiro além do primeiro (até o 4º).
            O 1º passageiro paga apenas o preço calculado normalmente.
          </p>
          {tariffs.slice(0, 1).map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">R$ por km, por passageiro extra</span>
                <div className="flex items-center rounded-lg border bg-background px-3 py-2">
                  <span className="text-sm text-muted-foreground mr-1">+R$</span>
                  <input
                    type="text"
                    value={t.passenger_extra?.toFixed(2)}
                    onChange={(e) => updateTariff(t.id, "passenger_extra", e.target.value)}
                    className="w-16 bg-transparent text-sm font-bold outline-none"
                  />
                  <span className="text-xs text-muted-foreground ml-1">/km</span>
                </div>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground">
                Ex.: corrida de 10 km com 3 passageiros → preço base + (2 extras × R$ {(t.passenger_extra || 3).toFixed(2)} × 10 km) = + R$ {((t.passenger_extra || 3) * 2 * 10).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "fees" && (
        <div className="space-y-4">
          {/* Taxa global */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Percent className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold">Taxa global da plataforma</h3>
                <p className="text-xs text-muted-foreground">
                  Aplicada em todas as corridas, exceto quando uma categoria tem override.
                </p>
              </div>
            </div>
            <div className="mt-4 max-w-xs">
              <label className="text-xs font-medium text-muted-foreground">Percentual padrão</label>
              <div className="mt-1 flex items-center rounded-lg border bg-background px-3 py-2">
                <input
                  type="text"
                  value={globalFee}
                  onChange={(e) => setGlobalFee(e.target.value)}
                  className="flex-1 bg-transparent text-base font-bold outline-none"
                />
                <span className="text-sm font-bold text-muted-foreground ml-1">%</span>
              </div>
            </div>
          </div>

          {/* Overrides por categoria */}
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="text-base font-bold mb-1">Override por categoria</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Deixe em branco para usar a taxa global. Preencha para sobrescrever apenas a categoria.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {tariffs.map((t) => {
                const Icon = catIcon[t.category] || Car;
                return (
                  <div key={t.id} className="rounded-xl border bg-background p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold capitalize">{t.category}</span>
                    </div>
                    <div className="flex items-center rounded-lg border bg-card px-3 py-2">
                      <input
                        type="text"
                        placeholder={`global (${globalFee}%)`}
                        value={t.fee_percent ?? ""}
                        onChange={(e) => updateTariff(t.id, "fee_percent", e.target.value)}
                        className="flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground/60 placeholder:font-normal"
                      />
                      <span className="text-xs font-bold text-muted-foreground ml-1">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={saveTariffs}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar configurações
      </button>
    </AdminLayout>
  );
};

export default AdminTariffs;
