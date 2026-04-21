import { useMemo, useState } from "react";
import { X, Save, Loader2, User, Mail, Phone, IdCard, Calendar as CalendarIcon, ShieldCheck, AlertTriangle } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { validateCPF, formatCPF, formatPhone } from "@/lib/validators";

interface Props {
  passenger: any;
  onClose: () => void;
  onSaved: () => void;
}

const today = new Date();
const minBirth = new Date(1900, 0, 1);
const maxBirth = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());

const toIsoDate = (d?: Date | null) => (d ? format(d, "yyyy-MM-dd") : "");
const fromIsoDate = (s?: string | null): Date | undefined => {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
};

const EditPassengerModal = ({ passenger, onClose, onSaved }: Props) => {
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    full_name: passenger.full_name || "",
    cpf: formatCPF(passenger.cpf || ""),
    email: passenger.email || "",
    phone: formatPhone(passenger.phone || ""),
    birth_date: passenger.birth_date || "",
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim() || form.full_name.trim().length < 3)
      e.full_name = "Informe o nome completo";
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) e.cpf = "CPF deve ter 11 dígitos";
    else if (!validateCPF(cpfDigits)) e.cpf = "CPF inválido (dígitos verificadores)";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "E-mail inválido";
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11))
      e.phone = "Telefone deve ter 10 ou 11 dígitos";
    if (form.birth_date) {
      const d = fromIsoDate(form.birth_date);
      if (!d) e.birth_date = "Data inválida";
      else if (d > maxBirth) e.birth_date = "Idade mínima 18 anos";
      else if (d < minBirth) e.birth_date = "Data muito antiga";
    }
    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleSave = async () => {
    setTouched({ full_name: true, cpf: true, email: true, phone: true, birth_date: true });
    if (hasErrors) {
      toast.error("Corrija os campos destacados antes de salvar");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_passenger_full", {
      _user_id: passenger.user_id,
      _full_name: form.full_name.trim(),
      _cpf: form.cpf.replace(/\D/g, ""),
      _email: form.email.trim(),
      _phone: form.phone.replace(/\D/g, ""),
      _birth_date: form.birth_date || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Erro ao salvar");
      return;
    }
    toast.success("Dados atualizados");
    onSaved();
    onClose();
  };

  const fieldCls = (key: string) =>
    cn(
      "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none transition-colors",
      "focus:border-primary focus:ring-2 focus:ring-primary/20",
      touched[key] && errors[key] ? "border-destructive focus:border-destructive focus:ring-destructive/20" : "",
    );

  const FieldLabel = ({ icon: Icon, label, required }: any) => (
    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
      <Icon className="h-3 w-3" />
      {label}
      {required && <span className="text-destructive">*</span>}
    </span>
  );

  const ErrMsg = ({ k }: { k: string }) =>
    touched[k] && errors[k] ? (
      <p className="flex items-center gap-1 text-[10px] text-destructive mt-0.5">
        <AlertTriangle className="h-3 w-3" />
        {errors[k]}
      </p>
    ) : null;

  const birthDate = fromIsoDate(form.birth_date);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold font-display">Editar passageiro</h2>
            <p className="text-[11px] text-muted-foreground">Validação completa de CPF e dados pessoais</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <label className="space-y-1 block">
            <FieldLabel icon={User} label="Nome completo" required />
            <input
              className={fieldCls("full_name")}
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              onBlur={() => touch("full_name")}
              placeholder="Ex: Maria Aparecida Silva"
            />
            <ErrMsg k="full_name" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <FieldLabel icon={IdCard} label="CPF" required />
              <input
                className={fieldCls("cpf")}
                value={form.cpf}
                onChange={(e) => set("cpf", formatCPF(e.target.value))}
                onBlur={() => touch("cpf")}
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
              />
              {touched.cpf && !errors.cpf && (
                <p className="flex items-center gap-1 text-[10px] text-success mt-0.5">
                  <ShieldCheck className="h-3 w-3" /> CPF válido
                </p>
              )}
              <ErrMsg k="cpf" />
            </label>

            <div className="space-y-1">
              <FieldLabel icon={CalendarIcon} label="Nascimento" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onBlur={() => touch("birth_date")}
                    className={cn(
                      "w-full justify-start text-left font-normal h-[38px]",
                      !birthDate && "text-muted-foreground",
                      touched.birth_date && errors.birth_date && "border-destructive",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                    {birthDate ? format(birthDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[80]" align="start">
                  <Calendar
                    mode="single"
                    selected={birthDate}
                    onSelect={(d) => {
                      set("birth_date", toIsoDate(d ?? null));
                      touch("birth_date");
                    }}
                    defaultMonth={birthDate ?? maxBirth}
                    captionLayout="dropdown-buttons"
                    fromYear={1900}
                    toYear={maxBirth.getFullYear()}
                    disabled={(date) => date > maxBirth || date < minBirth}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <ErrMsg k="birth_date" />
            </div>
          </div>

          <label className="space-y-1 block">
            <FieldLabel icon={Mail} label="E-mail" />
            <input
              type="email"
              className={fieldCls("email")}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              onBlur={() => touch("email")}
              placeholder="exemplo@dominio.com"
            />
            <ErrMsg k="email" />
          </label>

          <label className="space-y-1 block">
            <FieldLabel icon={Phone} label="Telefone" />
            <input
              className={fieldCls("phone")}
              value={form.phone}
              onChange={(e) => set("phone", formatPhone(e.target.value))}
              onBlur={() => touch("phone")}
              inputMode="numeric"
              placeholder="(11) 91234-5678"
              maxLength={15}
            />
            <ErrMsg k="phone" />
          </label>
        </div>

        <div className="border-t bg-card p-3 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border py-3 text-sm font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || hasErrors}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPassengerModal;
