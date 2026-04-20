import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Save, Loader2, Clock, ShieldAlert, Users, Car, Plus, X, RotateCcw, Info,
} from "lucide-react";
import CancellationReasonsManager from "@/components/admin/CancellationReasonsManager";

interface Rules {
  grace_seconds: number;
  daily_limit: number;
  block_hours_sequence: number[];
  after_sequence_multiplier: number;
  apply_to_passenger: boolean;
  apply_to_driver: boolean;
}

const DEFAULTS: Rules = {
  grace_seconds: 120,
  daily_limit: 3,
  block_hours_sequence: [2, 5, 12, 24, 48],
  after_sequence_multiplier: 2,
  apply_to_passenger: true,
  apply_to_driver: true,
};

const AdminCancellationRules = () => {
  const [rules, setRules] = useState<Rules>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newHour, setNewHour] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "cancellation_rules")
      .maybeSingle();
    if (error) toast.error(error.message);
    if (data?.value) {
      const v = data.value as any;
      setRules({
        grace_seconds: Number(v.grace_seconds ?? DEFAULTS.grace_seconds),
        daily_limit: Number(v.daily_limit ?? DEFAULTS.daily_limit),
        block_hours_sequence: Array.isArray(v.block_hours_sequence)
          ? v.block_hours_sequence.map((h: any) => Number(h)).filter((h: number) => h > 0)
          : DEFAULTS.block_hours_sequence,
        after_sequence_multiplier: Number(v.after_sequence_multiplier ?? DEFAULTS.after_sequence_multiplier),
        apply_to_passenger: v.apply_to_passenger !== false,
        apply_to_driver: v.apply_to_driver !== false,
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (rules.grace_seconds < 0 || rules.grace_seconds > 3600) {
      toast.error("Cortesia deve estar entre 0 e 3600 segundos");
      return;
    }
    if (rules.daily_limit < 1 || rules.daily_limit > 50) {
      toast.error("Limite diário deve estar entre 1 e 50");
      return;
    }
    if (rules.block_hours_sequence.length === 0) {
      toast.error("Adicione ao menos uma faixa de bloqueio");
      return;
    }
    if (rules.after_sequence_multiplier < 1 || rules.after_sequence_multiplier > 10) {
      toast.error("Multiplicador deve estar entre 1 e 10");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: rules as any, updated_at: new Date().toISOString() })
      .eq("key", "cancellation_rules");
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Regras de cancelamento salvas");
  };

  const handleReset = () => {
    if (!confirm("Restaurar valores padrão? As alterações não serão salvas até clicar em Salvar.")) return;
    setRules(DEFAULTS);
  };

  const addHour = () => {
    if (newHour <= 0 || newHour > 720) { toast.error("Horas entre 1 e 720"); return; }
    setRules({ ...rules, block_hours_sequence: [...rules.block_hours_sequence, newHour] });
    setNewHour(0);
  };

  const removeHour = (idx: number) => {
    setRules({ ...rules, block_hours_sequence: rules.block_hours_sequence.filter((_, i) => i !== idx) });
  };

  // Preview de simulação
  const previewBlocks = (() => {
    const seq = rules.block_hours_sequence;
    const mult = rules.after_sequence_multiplier;
    const out: { n: number; hours: number }[] = [];
    for (let i = 1; i <= seq.length + 3; i++) {
      let h: number;
      if (i <= seq.length) h = seq[i - 1];
      else h = Math.round(seq[seq.length - 1] * Math.pow(mult, i - seq.length));
      out.push({ n: i, hours: h });
    }
    return out;
  })();

  if (loading) {
    return (
      <AdminLayout title="Regras de cancelamento">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Regras de cancelamento"
      actions={
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Padrão
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-1.5 text-xs font-bold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      {/* Info */}
      <div className="rounded-2xl border border-info/30 bg-info/5 p-4 flex gap-3">
        <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/80 space-y-1">
          <p><strong>Como funciona:</strong> dentro da janela de cortesia, o cancelamento não conta como punição.</p>
          <p>Após o limite diário, é aplicado um bloqueio progressivo (1ª, 2ª, 3ª vez...). Depois da última faixa, multiplica pelo fator definido.</p>
        </div>
      </div>

      {/* Aplicar a quem */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" /> Aplicar punição a
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Passageiros</span>
            </div>
            <input
              type="checkbox"
              checked={rules.apply_to_passenger}
              onChange={(e) => setRules({ ...rules, apply_to_passenger: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-info" />
              <span className="text-sm font-semibold">Motoristas</span>
            </div>
            <input
              type="checkbox"
              checked={rules.apply_to_driver}
              onChange={(e) => setRules({ ...rules, apply_to_driver: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      </div>

      {/* Cortesia + limite diário */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4" /> Janela de cortesia
          </h3>
          <p className="text-xs text-muted-foreground">
            Tempo após o motorista aceitar/chegar em que o cancelamento <strong>não conta</strong> como punição.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={3600}
              value={rules.grace_seconds}
              onChange={(e) => setRules({ ...rules, grace_seconds: Math.max(0, Math.min(3600, Number(e.target.value) || 0)) })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">segundos</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[60, 120, 180, 300, 600].map((s) => (
              <button
                key={s}
                onClick={() => setRules({ ...rules, grace_seconds: s })}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                  rules.grace_seconds === s ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                }`}
              >
                {s < 60 ? `${s}s` : `${Math.round(s / 60)}min`}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Equivale a aproximadamente <strong>{Math.round(rules.grace_seconds / 60)} min {rules.grace_seconds % 60}s</strong>.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Limite diário
          </h3>
          <p className="text-xs text-muted-foreground">
            Quantos cancelamentos puníveis o usuário pode ter em um dia antes de receber um bloqueio.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              value={rules.daily_limit}
              onChange={(e) => setRules({ ...rules, daily_limit: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">por dia</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[2, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setRules({ ...rules, daily_limit: n })}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                  rules.daily_limit === n ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sequência progressiva */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning" /> Bloqueio progressivo (em horas)
        </h3>
        <p className="text-xs text-muted-foreground">
          Cada vez que o usuário atinge o limite diário, recebe o próximo bloqueio da sequência.
        </p>

        <div className="flex flex-wrap gap-2">
          {rules.block_hours_sequence.map((h, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 border border-warning/30 px-3 py-1 text-xs font-bold text-warning-foreground dark:text-warning"
            >
              <span className="text-[10px] opacity-70">#{idx + 1}</span>
              {h}h
              <button
                onClick={() => removeHour(idx)}
                className="hover:bg-warning/20 rounded-full p-0.5"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            min={1}
            max={720}
            value={newHour || ""}
            onChange={(e) => setNewHour(Number(e.target.value) || 0)}
            placeholder="Horas (ex: 24)"
            className="w-32 rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={addHour}
            className="flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-bold hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar faixa
          </button>
        </div>

        <div className="border-t pt-3 mt-1">
          <label className="text-xs font-semibold flex items-center gap-2">
            Multiplicador após a última faixa
            <span className="text-muted-foreground font-normal">(ex: 2 = dobra)</span>
          </label>
          <div className="flex items-center gap-2 mt-1.5 max-w-xs">
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={rules.after_sequence_multiplier}
              onChange={(e) => setRules({ ...rules, after_sequence_multiplier: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
              className="w-24 rounded-lg border bg-background px-3 py-2 text-sm font-semibold"
            />
            <span className="text-xs text-muted-foreground">×</span>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-bold mb-3">Pré-visualização da progressão</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 px-2">Vez</th>
                <th className="text-left py-2 px-2">Bloqueio</th>
                <th className="text-left py-2 px-2">Origem</th>
              </tr>
            </thead>
            <tbody>
              {previewBlocks.map((p) => (
                <tr key={p.n} className="border-b last:border-0">
                  <td className="py-2 px-2 font-bold">{p.n}ª</td>
                  <td className="py-2 px-2">
                    <span className="font-bold text-warning">{p.hours}h</span>
                    <span className="text-muted-foreground ml-2">
                      ({p.hours >= 24 ? `${(p.hours / 24).toFixed(1)} dias` : `${p.hours} horas`})
                    </span>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">
                    {p.n <= rules.block_hours_sequence.length ? "Sequência" : `Multiplicador (×${rules.after_sequence_multiplier})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminCancellationRules;