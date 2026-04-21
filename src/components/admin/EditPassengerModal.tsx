import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  passenger: any;
  onClose: () => void;
  onSaved: () => void;
}

const EditPassengerModal = ({ passenger, onClose, onSaved }: Props) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: passenger.full_name || "",
    cpf: passenger.cpf || "",
    email: passenger.email || "",
    phone: passenger.phone || "",
    birth_date: passenger.birth_date || "",
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error("Nome obrigatório"); return; }
    if (form.cpf.replace(/\D/g, "").length !== 11) { toast.error("CPF inválido"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_passenger_full", {
      _user_id: passenger.user_id,
      _full_name: form.full_name,
      _cpf: form.cpf,
      _email: form.email,
      _phone: form.phone,
      _birth_date: form.birth_date || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao salvar"); return; }
    toast.success("Dados atualizados");
    onSaved();
    onClose();
  };

  const inputCls = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary";
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="space-y-1 block">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold font-display">Editar passageiro</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <Field label="Nome completo"><input className={inputCls} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF"><input className={inputCls} value={form.cpf} onChange={(e) => set("cpf", e.target.value)} maxLength={14} /></Field>
            <Field label="Nascimento"><input type="date" className={inputCls} value={form.birth_date || ""} onChange={(e) => set("birth_date", e.target.value)} /></Field>
          </div>
          <Field label="E-mail"><input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Telefone"><input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={15} /></Field>
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

export default EditPassengerModal;
