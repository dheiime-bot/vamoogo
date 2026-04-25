import { useEffect, useMemo, useState } from "react";
import { Bike, Car, Crown, Loader2, Percent, Save, Timer, Route } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

type Category = "moto" | "economico" | "conforto";

type Tariff = {
  id: string;
  category: Category;
  region: string;
  per_km: number;
  min_fare: number;
  fee_percent: number | null;
  wait_free_minutes: number;
  wait_per_minute: number;
  additional_km_rate: number;
  base_fare?: number;
  per_minute?: number;
  passenger_extra?: number;
  region_multiplier?: number;
};

const categoryLabels: Record<Category, string> = {
  moto: "Moto",
  economico: "Econômico",
  conforto: "Conforto",
};

const categoryIcons: Record<Category, typeof Bike> = {
  moto: Bike,
  economico: Car,
  conforto: Crown,
};

const parseMoney = (value: string | number | null | undefined) => {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const parsePercent = (value: string | number | null | undefined) => {
  const parsed = parseMoney(value);
  return Math.max(0, Math.min(100, parsed));
};

const formatInput = (value: unknown) => String(value ?? "").replace(".", ",");

const AdminTariffs = () => {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [platformFee, setPlatformFee] = useState("10");
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    const [tariffsRes, settingsRes] = await Promise.all([
      supabase
        .from("tariffs")
        .select("id,category,region,base_fare,per_km,per_minute,min_fare,passenger_extra,region_multiplier,fee_percent,wait_free_minutes,wait_per_minute,additional_km_rate")
        .eq("region", "default")
        .order("category"),
      supabase
        .from("platform_settings")
        .select("key,value")
        .in("key", ["platform_fee_percent", "global_fee_percent"]),
    ]);

    if (tariffsRes.data) setTariffs(tariffsRes.data as Tariff[]);

    const settings = settingsRes.data || [];
    const publicFee = settings.find((item) => item.key === "platform_fee_percent")?.value;
    const legacyFee = settings.find((item) => item.key === "global_fee_percent")?.value;
    const fee = publicFee ?? legacyFee;
    if (fee !== undefined && fee !== null) setPlatformFee(String(fee));
  };

  useEffect(() => { loadAll(); }, []);
  useRealtimeRefresh(["tariffs", "platform_settings"], loadAll, "admin-tariffs");

  const defaultTariffs = useMemo(
    () => tariffs.filter((tariff) => tariff.region === "default"),
    [tariffs]
  );

  const updateTariff = (id: string, field: keyof Tariff, value: string) => {
    setTariffs((current) =>
      current.map((tariff) =>
        tariff.id === id ? { ...tariff, [field]: parseMoney(value) } : tariff
      )
    );
  };

  const saveTariffs = async () => {
    setSaving(true);
    try {
      const fee = parsePercent(platformFee);

      for (const tariff of defaultTariffs) {
        const updatePayload = {
          per_km: parseMoney(tariff.per_km),
          min_fare: parseMoney(tariff.min_fare),
          fee_percent: null,
          wait_free_minutes: parseMoney(tariff.wait_free_minutes),
          wait_per_minute: parseMoney(tariff.wait_per_minute),
          additional_km_rate: parseMoney(tariff.additional_km_rate),
        };

        const { error } = await supabase
          .from("tariffs")
          .update(updatePayload as any)
          .eq("id", tariff.id);

        if (error) throw error;
      }

      for (const key of ["platform_fee_percent", "global_fee_percent"]) {
        const { error } = await supabase
          .from("platform_settings")
          .upsert({ key, value: fee as any, description: "Percentual cobrado pela plataforma sobre o valor da corrida." } as any, { onConflict: "key" });
        if (error) throw error;
      }

      setPlatformFee(String(fee));
      await loadAll();
      toast.success("Tarifas conectadas ao banco e apps atualizadas!");
    } catch (error: any) {
      toast.error("Erro ao salvar tarifas: " + (error?.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Configurador de Tarifas">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          {defaultTariffs.length === 0 && (
            <EmptyState title="Nenhuma tarifa configurada" description="As categorias padrão ainda não foram encontradas no banco." />
          )}

          {defaultTariffs.map((tariff) => {
            const Icon = categoryIcons[tariff.category] || Car;
            return (
              <div key={tariff.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">{categoryLabels[tariff.category] || tariff.category}</h3>
                    <p className="text-xs text-muted-foreground">Valores usados nos apps para estimar e criar corridas.</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <TariffField
                    label="Valor por km"
                    value={tariff.per_km}
                    prefix="R$"
                    suffix="/km"
                    onChange={(value) => updateTariff(tariff.id, "per_km", value)}
                  />
                  <TariffField
                    label="Valor mínimo da corrida"
                    value={tariff.min_fare}
                    prefix="R$"
                    onChange={(value) => updateTariff(tariff.id, "min_fare", value)}
                  />
                  <TariffField
                    label="Valor por km adicional"
                    value={tariff.additional_km_rate || tariff.per_km}
                    prefix="R$"
                    suffix="/km"
                    onChange={(value) => updateTariff(tariff.id, "additional_km_rate", value)}
                  />
                  <TariffField
                    label="Tempo grátis de espera"
                    value={tariff.wait_free_minutes}
                    suffix="min"
                    onChange={(value) => updateTariff(tariff.id, "wait_free_minutes", value)}
                  />
                  <TariffField
                    label="Valor por minuto de espera"
                    value={tariff.wait_per_minute}
                    prefix="R$"
                    suffix="/min"
                    onChange={(value) => updateTariff(tariff.id, "wait_per_minute", value)}
                  />
                </div>
              </div>
            );
          })}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Percent className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold">Taxa da plataforma</h3>
                <p className="text-xs text-muted-foreground">Percentual descontado do valor da corrida.</p>
              </div>
            </div>
            <TariffField
              label="Taxa da plataforma %"
              value={platformFee}
              suffix="%"
              onChange={setPlatformFee}
            />
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Route className="h-4 w-4 text-primary" /> Apps conectados
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Passageiro: estimativa e solicitação usam valor por km e mínimo.</p>
              <p>Admin: salvamento grava direto no banco.</p>
              <p>Backend: taxa da plataforma fica pública para cálculo seguro nos apps.</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Timer className="h-4 w-4 text-primary" /> Espera
            </div>
            <p className="text-xs text-muted-foreground">
              Os valores de espera ficam salvos por categoria para uso nas próximas telas de cobrança/ajuste da corrida.
            </p>
          </div>
        </aside>
      </div>

      <button
        onClick={saveTariffs}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar e sincronizar tudo
      </button>
    </AdminLayout>
  );
};

type TariffFieldProps = {
  label: string;
  value: unknown;
  prefix?: string;
  suffix?: string;
  onChange: (value: string) => void;
};

const TariffField = ({ label, value, prefix, suffix, onChange }: TariffFieldProps) => (
  <label className="block">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <div className="mt-1 flex items-center rounded-lg border bg-background px-3 py-2">
      {prefix && <span className="mr-1 text-sm font-semibold text-muted-foreground">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={formatInput(value)}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
      />
      {suffix && <span className="ml-1 text-xs font-semibold text-muted-foreground">{suffix}</span>}
    </div>
  </label>
);

export default AdminTariffs;
