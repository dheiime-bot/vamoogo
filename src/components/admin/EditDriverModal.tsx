import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  driver: any;
  onClose: () => void;
  onSaved: () => void;
}

const VEHICLE_CATEGORIES = ["economico", "conforto", "premium", "moto", "bag"] as const;
const PIX_TYPES = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const;

const EditDriverModal = ({ driver, onClose, onSaved }: Props) => {
  const profile = driver.profiles || {};
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    cpf: profile.cpf || "",
    email: profile.email || "",
    phone: profile.phone || "",
    birth_date: profile.birth_date || "",
    category: driver.category || "economico",
    vehicle_brand: driver.vehicle_brand || "",
    vehicle_model: driver.vehicle_model || "",
    vehicle_color: driver.vehicle_color || "",
    vehicle_plate: driver.vehicle_plate || "",
    vehicle_year: driver.vehicle_year ?? "",
    vehicle_renavam: driver.vehicle_renavam || "",
    cnh_number: driver.cnh_number || "",
    cnh_ear: !!driver.cnh_ear,
    pix_key: driver.pix_key || "",
    pix_key_type: driver.pix_key_type || "",
    pix_holder_name: driver.pix_holder_name || "",
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error("Nome obrigatório"); return; }
    if (form.cpf.replace(/\D/g, "").length !== 11) { toast.error("CPF inválido"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_driver_full", {
      _user_id: driver.user_id,
      _full_name: form.full_name,
      _cpf: form.cpf,
      _email: form.email,
      _phone: form.phone,
      _birth_date: form.birth_date || null,
      _category: form.category,
      _vehicle_brand: form.vehicle_brand,
      _vehicle_model: form.vehicle_model,
      _vehicle_color: form.vehicle_color,
      _vehicle_plate: form.vehicle_plate,
      _vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
      _vehicle_renavam: form.vehicle_renavam,
      _cnh_number: form.cnh_number,
      _cnh_ear: form.cnh_ear,
      _pix_key: form.pix_key,
      _pix_key_type: form.pix_key_type,
      _pix_holder_name: form.pix_holder_name,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao salvar"); return; }
    toast.success("Dados atualizados");
    onSaved();
    onClose();
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="space-y-1 block">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
  const inputCls = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold font-display">Editar motorista</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Dados pessoais</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Field label="Nome completo"><input className={inputCls} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field></div>
              <Field label="CPF"><input className={inputCls} value={form.cpf} onChange={(e) => set("cpf", e.target.value)} maxLength={14} /></Field>
              <Field label="Nascimento"><input type="date" className={inputCls} value={form.birth_date || ""} onChange={(e) => set("birth_date", e.target.value)} /></Field>
              <Field label="E-mail"><input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Telefone"><input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={15} /></Field>
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Veículo</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {VEHICLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Ano"><input type="number" className={inputCls} value={form.vehicle_year} onChange={(e) => set("vehicle_year", e.target.value)} /></Field>
              <Field label="Marca"><input className={inputCls} value={form.vehicle_brand} onChange={(e) => set("vehicle_brand", e.target.value)} /></Field>
              <Field label="Modelo"><input className={inputCls} value={form.vehicle_model} onChange={(e) => set("vehicle_model", e.target.value)} /></Field>
              <Field label="Cor"><input className={inputCls} value={form.vehicle_color} onChange={(e) => set("vehicle_color", e.target.value)} /></Field>
              <Field label="Placa"><input className={inputCls} value={form.vehicle_plate} onChange={(e) => set("vehicle_plate", e.target.value.toUpperCase())} maxLength={8} /></Field>
              <div className="col-span-2"><Field label="RENAVAM"><input className={inputCls} value={form.vehicle_renavam} onChange={(e) => set("vehicle_renavam", e.target.value)} maxLength={11} /></Field></div>
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">CNH</p>
            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label="Número da CNH"><input className={inputCls} value={form.cnh_number} onChange={(e) => set("cnh_number", e.target.value)} /></Field>
              <label className="flex items-center gap-2 text-sm pb-2">
                <input type="checkbox" checked={form.cnh_ear} onChange={(e) => set("cnh_ear", e.target.checked)} className="h-4 w-4 rounded" />
                Possui EAR
              </label>
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Dados Pix</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo da chave">
                <select className={inputCls} value={form.pix_key_type} onChange={(e) => set("pix_key_type", e.target.value)}>
                  <option value="">—</option>
                  {PIX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Chave"><input className={inputCls} value={form.pix_key} onChange={(e) => set("pix_key", e.target.value)} /></Field>
              <div className="col-span-2"><Field label="Favorecido"><input className={inputCls} value={form.pix_holder_name} onChange={(e) => set("pix_holder_name", e.target.value)} /></Field></div>
            </div>
          </section>
        </div>

        <div className="border-t bg-card p-3 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="rounded-xl border py-3 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditDriverModal;
