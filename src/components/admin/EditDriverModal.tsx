import { useMemo, useState } from "react";
import {
  X, Save, Loader2, User, Mail, Phone, IdCard, Calendar as CalendarIcon,
  Car, Palette, Hash, FileText, KeyRound, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  validateCPF, formatCPF, formatPhone,
  formatPlate, formatRenavam, validateRenavam,
} from "@/lib/validators";

interface Props {
  driver: any;
  onClose: () => void;
  onSaved: () => void;
}

const VEHICLE_CATEGORIES = [
  { value: "moto", label: "Moto" },
  { value: "economico", label: "Econômico" },
  { value: "conforto", label: "Conforto" },
] as const;

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Aleatória" },
] as const;

const today = new Date();
const minBirth = new Date(1900, 0, 1);
const maxBirth = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
const currentYear = today.getFullYear();
const oldestVehicleYear = currentYear - 30;

// Conversão UTC-safe — evita "data retroativa" por causa do timezone local.
// O banco devolve `birth_date` como `YYYY-MM-DD` puro ou ISO completo. Sempre
// extraímos só os 10 primeiros caracteres e construímos no fuso local ao meio-dia
// para que o usuário enxergue exatamente o mesmo dia que digitou/selecionou.
const toIsoDate = (d?: Date | null) => {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fromIsoDate = (s?: string | null): Date | undefined => {
  if (!s) return undefined;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const result = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (
    result.getFullYear() !== y ||
    result.getMonth() !== mo - 1 ||
    result.getDate() !== d
  )
    return undefined;
  return result;
};

// Aceita ABC1234 (antigo) ou ABC1D23 (Mercosul)
const PLATE_REGEX = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/;

const EditDriverModal = ({ driver, onClose, onSaved }: Props) => {
  const profile = driver.profiles || {};
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    cpf: formatCPF(profile.cpf || ""),
    email: profile.email || "",
    phone: formatPhone(profile.phone || ""),
    birth_date: profile.birth_date || "",
    category: driver.category || "economico",
    vehicle_brand: driver.vehicle_brand || "",
    vehicle_model: driver.vehicle_model || "",
    vehicle_color: driver.vehicle_color || "",
    vehicle_plate: formatPlate(driver.vehicle_plate || ""),
    vehicle_year: driver.vehicle_year ? String(driver.vehicle_year) : "",
    vehicle_renavam: formatRenavam(driver.vehicle_renavam || ""),
    cnh_number: (driver.cnh_number || "").replace(/\D/g, ""),
    cnh_ear: !!driver.cnh_ear,
    pix_key: driver.pix_key || "",
    pix_key_type: driver.pix_key_type || "",
    pix_holder_name: driver.pix_holder_name || "",
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim() || form.full_name.trim().length < 3)
      e.full_name = "Informe o nome completo";

    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) e.cpf = "CPF deve ter 11 dígitos";
    else if (!validateCPF(cpfDigits)) e.cpf = "CPF inválido";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "E-mail inválido";

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!phoneDigits) e.phone = "Telefone obrigatório";
    else if (phoneDigits.length < 10 || phoneDigits.length > 11)
      e.phone = "Telefone deve ter 10 ou 11 dígitos";

    if (form.birth_date) {
      const d = fromIsoDate(form.birth_date);
      if (!d) e.birth_date = "Data inválida";
      else if (d > maxBirth) e.birth_date = "Idade mínima 18 anos";
      else if (d < minBirth) e.birth_date = "Data muito antiga";
    } else {
      e.birth_date = "Nascimento obrigatório";
    }

    if (!form.vehicle_brand.trim()) e.vehicle_brand = "Obrigatório";
    if (!form.vehicle_model.trim()) e.vehicle_model = "Obrigatório";
    if (!form.vehicle_color.trim()) e.vehicle_color = "Obrigatório";

    const plate = form.vehicle_plate.toUpperCase();
    if (!plate) e.vehicle_plate = "Placa obrigatória";
    else if (!PLATE_REGEX.test(plate)) e.vehicle_plate = "Formato AAA-1A23 / AAA-1234";

    const yr = Number(form.vehicle_year);
    if (!form.vehicle_year) e.vehicle_year = "Ano obrigatório";
    else if (!Number.isFinite(yr) || yr < oldestVehicleYear || yr > currentYear + 1)
      e.vehicle_year = `Ano entre ${oldestVehicleYear} e ${currentYear + 1}`;

    if (form.vehicle_renavam && !validateRenavam(form.vehicle_renavam))
      e.vehicle_renavam = "RENAVAM com 9 a 11 dígitos";

    if (form.cnh_number) {
      const c = form.cnh_number.replace(/\D/g, "");
      if (c.length < 9 || c.length > 11) e.cnh_number = "CNH com 9 a 11 dígitos";
    }

    if (form.pix_key && !form.pix_key_type) e.pix_key_type = "Selecione o tipo";
    if (form.pix_key_type === "cpf" && form.pix_key) {
      const d = form.pix_key.replace(/\D/g, "");
      if (d.length !== 11 || !validateCPF(d)) e.pix_key = "Chave Pix CPF inválida";
    }
    if (form.pix_key_type === "email" && form.pix_key && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.pix_key))
      e.pix_key = "Chave Pix e-mail inválida";

    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleSave = async () => {
    const allKeys = Object.keys(form).reduce<Record<string, boolean>>((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allKeys);
    if (hasErrors) {
      toast.error("Corrija os campos destacados antes de salvar");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_driver_full", {
      _user_id: driver.user_id,
      _full_name: form.full_name.trim(),
      _cpf: form.cpf.replace(/\D/g, ""),
      _email: form.email.trim(),
      _phone: form.phone.replace(/\D/g, ""),
      _birth_date: form.birth_date,
      _category: form.category,
      _vehicle_brand: form.vehicle_brand.trim(),
      _vehicle_model: form.vehicle_model.trim(),
      _vehicle_color: form.vehicle_color.trim(),
      _vehicle_plate: form.vehicle_plate.replace(/-/g, "").toUpperCase(),
      _vehicle_year: Number(form.vehicle_year),
      _vehicle_renavam: form.vehicle_renavam,
      _cnh_number: form.cnh_number.replace(/\D/g, ""),
      _cnh_ear: form.cnh_ear,
      _pix_key: form.pix_key.trim(),
      _pix_key_type: form.pix_key_type,
      _pix_holder_name: form.pix_holder_name.trim(),
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
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold font-display">Editar motorista</h2>
            <p className="text-[11px] text-muted-foreground">
              Validação BR: CPF, placa Mercosul, RENAVAM e CNH
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Dados pessoais */}
          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Dados pessoais</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="space-y-1 block">
                  <FieldLabel icon={User} label="Nome completo" required />
                  <input
                    className={fieldCls("full_name")}
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                    onBlur={() => touch("full_name")}
                    placeholder="Como aparece no documento"
                  />
                  <ErrMsg k="full_name" />
                </label>
              </div>

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
                <FieldLabel icon={CalendarIcon} label="Nascimento" required />
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

              <label className="space-y-1 block">
                <FieldLabel icon={Mail} label="E-mail" />
                <input
                  type="email"
                  className={fieldCls("email")}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  onBlur={() => touch("email")}
                />
                <ErrMsg k="email" />
              </label>

              <label className="space-y-1 block">
                <FieldLabel icon={Phone} label="Telefone" required />
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
          </section>

          {/* Veículo */}
          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Veículo</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <FieldLabel icon={Car} label="Categoria" required />
                <select
                  className={fieldCls("category")}
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  {VEHICLE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 block">
                <FieldLabel icon={CalendarIcon} label="Ano" required />
                <input
                  type="number"
                  inputMode="numeric"
                  min={oldestVehicleYear}
                  max={currentYear + 1}
                  className={fieldCls("vehicle_year")}
                  value={form.vehicle_year}
                  onChange={(e) => set("vehicle_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onBlur={() => touch("vehicle_year")}
                  placeholder={String(currentYear)}
                />
                <ErrMsg k="vehicle_year" />
              </label>

              <label className="space-y-1 block">
                <FieldLabel icon={Car} label="Marca" required />
                <input
                  className={fieldCls("vehicle_brand")}
                  value={form.vehicle_brand}
                  onChange={(e) => set("vehicle_brand", e.target.value)}
                  onBlur={() => touch("vehicle_brand")}
                  placeholder="Ex: Fiat"
                />
                <ErrMsg k="vehicle_brand" />
              </label>

              <label className="space-y-1 block">
                <FieldLabel icon={Car} label="Modelo" required />
                <input
                  className={fieldCls("vehicle_model")}
                  value={form.vehicle_model}
                  onChange={(e) => set("vehicle_model", e.target.value)}
                  onBlur={() => touch("vehicle_model")}
                  placeholder="Ex: Argo Drive"
                />
                <ErrMsg k="vehicle_model" />
              </label>

              <label className="space-y-1 block">
                <FieldLabel icon={Palette} label="Cor" required />
                <input
                  className={fieldCls("vehicle_color")}
                  value={form.vehicle_color}
                  onChange={(e) => set("vehicle_color", e.target.value)}
                  onBlur={() => touch("vehicle_color")}
                  placeholder="Ex: Prata"
                />
                <ErrMsg k="vehicle_color" />
              </label>

              <label className="space-y-1 block">
                <FieldLabel icon={Hash} label="Placa" required />
                <input
                  className={cn(fieldCls("vehicle_plate"), "uppercase tracking-wider")}
                  value={form.vehicle_plate}
                  onChange={(e) => set("vehicle_plate", formatPlate(e.target.value))}
                  onBlur={() => touch("vehicle_plate")}
                  placeholder="ABC-1D23"
                  maxLength={8}
                />
                <ErrMsg k="vehicle_plate" />
              </label>

              <div className="col-span-2">
                <label className="space-y-1 block">
                  <FieldLabel icon={FileText} label="RENAVAM" />
                  <input
                    className={fieldCls("vehicle_renavam")}
                    value={form.vehicle_renavam}
                    onChange={(e) => set("vehicle_renavam", formatRenavam(e.target.value))}
                    onBlur={() => touch("vehicle_renavam")}
                    inputMode="numeric"
                    placeholder="11 dígitos do documento"
                    maxLength={11}
                  />
                  <ErrMsg k="vehicle_renavam" />
                </label>
              </div>
            </div>
          </section>

          {/* CNH */}
          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">CNH</p>
            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="space-y-1 block">
                <FieldLabel icon={IdCard} label="Número da CNH" />
                <input
                  className={fieldCls("cnh_number")}
                  value={form.cnh_number}
                  onChange={(e) => set("cnh_number", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  onBlur={() => touch("cnh_number")}
                  inputMode="numeric"
                  placeholder="9 a 11 dígitos"
                  maxLength={11}
                />
                <ErrMsg k="cnh_number" />
              </label>
              <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.cnh_ear}
                  onChange={(e) => set("cnh_ear", e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Possui observação EAR (atividade remunerada)
              </label>
            </div>
          </section>

          {/* Pix */}
          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Dados Pix</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <FieldLabel icon={KeyRound} label="Tipo da chave" />
                <select
                  className={fieldCls("pix_key_type")}
                  value={form.pix_key_type}
                  onChange={(e) => set("pix_key_type", e.target.value)}
                  onBlur={() => touch("pix_key_type")}
                >
                  <option value="">—</option>
                  {PIX_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ErrMsg k="pix_key_type" />
              </label>
              <label className="space-y-1 block">
                <FieldLabel icon={KeyRound} label="Chave Pix" />
                <input
                  className={fieldCls("pix_key")}
                  value={form.pix_key}
                  onChange={(e) => set("pix_key", e.target.value)}
                  onBlur={() => touch("pix_key")}
                />
                <ErrMsg k="pix_key" />
              </label>
              <div className="col-span-2">
                <label className="space-y-1 block">
                  <FieldLabel icon={User} label="Favorecido" />
                  <input
                    className={fieldCls("pix_holder_name")}
                    value={form.pix_holder_name}
                    onChange={(e) => set("pix_holder_name", e.target.value)}
                    placeholder="Nome do titular da chave"
                  />
                </label>
              </div>
            </div>
          </section>
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

export default EditDriverModal;
