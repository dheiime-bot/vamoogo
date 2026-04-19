import VamooLogo from "@/components/shared/VamooLogo";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, User, FileText, Calendar, Phone, Mail, Lock,
  Eye, EyeOff, Loader2, Camera, CheckCircle2, ShieldCheck, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, formatCPF, formatPhone } from "@/lib/validators";
import { formatDateBR, parseDateBRtoISO, calcAgeBR } from "@/lib/brFormat";
import {
  isFakeName, isFakeEmail, isFakeCPF, isFakePhone, checkPasswordStrength,
} from "@/lib/antiFake";
import LiveSelfieCapture from "@/components/auth/LiveSelfieCapture";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/authErrors";

type StepKey = "dados" | "seguranca" | "selfie";

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "dados", label: "Dados pessoais" },
  { key: "seguranca", label: "Segurança" },
  { key: "selfie", label: "Selfie" },
];

const PassengerSignup = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Dados pessoais
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Segurança
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Selfie
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  // Erros por campo
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setErr = (k: string, msg: string) => setErrors((e) => ({ ...e, [k]: msg }));
  const clearErr = (k: string) => setErrors((e) => { const c = { ...e }; delete c[k]; return c; });

  const pwdStrength = useMemo(() => checkPasswordStrength(password), [password]);
  const age = useMemo(() => calcAgeBR(birthDate), [birthDate]);

  // ---------- Validações ----------
  const validateName = (v: string) => {
    if (!v.trim()) return "Informe seu nome";
    const fake = isFakeName(v);
    return fake.fake ? fake.reason || "Nome inválido" : "";
  };

  const validateCpfField = (v: string) => {
    const cleaned = v.replace(/\D/g, "");
    if (cleaned.length === 0) return "Informe o CPF";
    if (cleaned.length !== 11) return "CPF deve ter 11 dígitos";
    if (!validateCPF(cleaned)) return "CPF inválido";
    const fake = isFakeCPF(cleaned);
    return fake.fake ? fake.reason || "CPF inválido" : "";
  };

  const validateBirth = (v: string) => {
    if (!v) return "Informe a data de nascimento";
    const iso = parseDateBRtoISO(v);
    if (!iso) return "Data inválida (use DD/MM/AAAA)";
    const a = calcAgeBR(v);
    if (a === null) return "Data inválida";
    if (a < 16) return "Cadastro permitido a partir de 16 anos";
    if (a > 110) return "Data inválida";
    return "";
  };

  const validatePhone = (v: string) => {
    const cleaned = v.replace(/\D/g, "");
    if (cleaned.length === 0) return "Informe o telefone";
    if (cleaned.length < 10 || cleaned.length > 11) return "Telefone inválido";
    // celular precisa começar com 9 após o DDD (11 dígitos)
    if (cleaned.length === 11 && cleaned[2] !== "9") return "Celular deve começar com 9";
    const fake = isFakePhone(cleaned);
    return fake.fake ? fake.reason || "Telefone inválido" : "";
  };

  const validateEmail = (v: string) => {
    const cleaned = v.trim().toLowerCase();
    if (!cleaned) return "Informe o e-mail";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) return "E-mail inválido";
    const fake = isFakeEmail(cleaned);
    return fake.fake ? fake.reason || "E-mail inválido" : "";
  };

  // ---------- Handlers ----------
  const handleCpf = (v: string) => {
    setCpf(formatCPF(v));
    const err = validateCpfField(v);
    err ? setErr("cpf", err) : clearErr("cpf");
  };

  const handlePhone = (v: string) => {
    setPhone(formatPhone(v));
    const err = validatePhone(v);
    err ? setErr("phone", err) : clearErr("phone");
  };

  const handleBirth = (v: string) => {
    setBirthDate(formatDateBR(v));
    const err = validateBirth(formatDateBR(v));
    err ? setErr("birth", err) : clearErr("birth");
  };

  const handleEmail = (v: string) => {
    setEmail(v);
    const err = validateEmail(v);
    err ? setErr("email", err) : clearErr("email");
  };

  const handleName = (v: string) => {
    setFullName(v);
    const err = validateName(v);
    err ? setErr("name", err) : clearErr("name");
  };

  // ---------- Avanço de etapas ----------
  const validateStepDados = async (): Promise<boolean> => {
    const errs: Record<string, string> = {};
    const e1 = validateName(fullName); if (e1) errs.name = e1;
    const e2 = validateCpfField(cpf); if (e2) errs.cpf = e2;
    const e3 = validateBirth(birthDate); if (e3) errs.birth = e3;
    const e4 = validatePhone(phone); if (e4) errs.phone = e4;
    const e5 = validateEmail(email); if (e5) errs.email = e5;
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Corrija os campos destacados");
      return false;
    }

    // Verificação anti-duplicidade no banco
    setLoading(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      const cleanPhone = phone.replace(/\D/g, "");
      const cleanEmail = email.trim().toLowerCase();

      const { data: dupCpf } = await supabase
        .from("profiles").select("id").eq("cpf", cleanCpf).maybeSingle();
      if (dupCpf) {
        setErr("cpf", "Este CPF já está cadastrado");
        toast.error("CPF já cadastrado");
        return false;
      }

      const { data: dupPhone } = await supabase
        .from("profiles").select("id").eq("phone", cleanPhone).maybeSingle();
      if (dupPhone) {
        setErr("phone", "Este telefone já está cadastrado");
        toast.error("Telefone já cadastrado");
        return false;
      }

      const { data: dupEmail } = await supabase
        .from("profiles").select("id").ilike("email", cleanEmail).maybeSingle();
      if (dupEmail) {
        setErr("email", "Este e-mail já está cadastrado");
        toast.error("E-mail já cadastrado");
        return false;
      }
    } finally {
      setLoading(false);
    }

    return true;
  };

  const validateStepSeguranca = (): boolean => {
    const errs: Record<string, string> = {};
    if (!pwdStrength.ok) errs.password = "Senha precisa ter pelo menos 8 caracteres, com letras e números";
    if (password !== confirmPassword) errs.confirm = "As senhas não coincidem";
    if (!acceptTerms) errs.terms = "Você precisa aceitar os termos";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Corrija os campos destacados");
      return false;
    }
    return true;
  };

  const next = async () => {
    if (step === 0) {
      const ok = await validateStepDados();
      if (ok) setStep(1);
    } else if (step === 1) {
      if (validateStepSeguranca()) setStep(2);
    }
  };

  const back = () => {
    if (step === 0) navigate("/auth");
    else setStep((s) => s - 1);
  };

  // ---------- Submissão final ----------
  const handleSubmit = async () => {
    if (!selfieUrl) {
      toast.error("Tire sua selfie para continuar");
      return;
    }
    setLoading(true);

    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanPhone = phone.replace(/\D/g, "");
    const isoBirth = parseDateBRtoISO(birthDate);

    const metadata: Record<string, string> = {
      full_name: fullName.trim(),
      cpf: cleanCpf,
      phone: cleanPhone,
      birth_date: isoBirth || "",
      user_type: "passenger",
      selfie_signup_url: selfieUrl,
    };

    const { error } = await signUp(email.trim().toLowerCase(), password, metadata);
    setLoading(false);

    if (error) {
      const { message, field } = friendlyAuthError(error);
      toast.error(message, { duration: 6000 });
      if (field === "password") {
        setStep(1); // passo Segurança
        setErr("password", message);
      } else if (field === "email") {
        setStep(0);
        setErr("email", message);
      } else if (field === "cpf") {
        setStep(0);
        setErr("cpf", message);
      } else if (field === "phone") {
        setStep(0);
        setErr("phone", message);
      }
      return;
    }

    toast.success("Cadastro criado! Verifique seu e-mail para confirmar.");
    navigate("/passenger");
  };

  // ---------- UI ----------
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="bg-gradient-primary p-6 pb-10 text-primary-foreground">
        <button
          onClick={back}
          className="mb-4 flex items-center gap-1 text-primary-foreground/80 text-sm hover:text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex flex-col items-center text-center">
          <VamooLogo height={86} className="mb-3" />
          <h1 className="text-base font-bold font-display">Criar conta de passageiro</h1>
          <p className="text-xs text-primary-foreground/80">
            Etapa {step + 1} de {STEPS.length} · {STEPS[step].label}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-5 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= step ? "bg-primary-foreground" : "bg-primary-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative -mt-6 flex-1 rounded-t-3xl p-6 pb-10" style={{ backgroundColor: "#f5fbfb" }}>
        {/* STEP 0: Dados */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <Field
              label="Nome completo"
              icon={<User className="h-4 w-4" />}
              value={fullName}
              onChange={handleName}
              placeholder="Como aparece no seu RG"
              error={errors.name}
              autoComplete="name"
            />

            <Field
              label="CPF"
              icon={<FileText className="h-4 w-4" />}
              value={cpf}
              onChange={handleCpf}
              placeholder="000.000.000-00"
              error={errors.cpf}
              maxLength={14}
              inputMode="numeric"
            />

            <Field
              label="Data de nascimento"
              icon={<Calendar className="h-4 w-4" />}
              value={birthDate}
              onChange={handleBirth}
              placeholder="DD/MM/AAAA"
              error={errors.birth}
              maxLength={10}
              inputMode="numeric"
              hint={age !== null && age >= 18 ? `${age} anos` : undefined}
            />

            <Field
              label="Telefone celular"
              icon={<Phone className="h-4 w-4" />}
              value={phone}
              onChange={handlePhone}
              placeholder="(11) 99999-0000"
              error={errors.phone}
              maxLength={15}
              inputMode="tel"
              autoComplete="tel"
            />

            <Field
              label="E-mail"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={handleEmail}
              placeholder="seu@email.com"
              error={errors.email}
              type="email"
              autoComplete="email"
            />

            <button
              onClick={next}
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Continuar <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        )}

        {/* STEP 1: Segurança */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border border-info/30 bg-info/10 p-3 flex gap-2">
              <ShieldCheck className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <p className="text-xs text-info-foreground/90">
                Sua senha é criptografada com bcrypt. Nunca compartilhamos seus dados.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className={`mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 ${
                errors.password ? "border-destructive" : ""
              }`}>
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="flex-1 bg-transparent text-sm outline-none"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < pwdStrength.score ? pwdStrength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Força: <span className="font-semibold">{pwdStrength.label}</span>
                  </p>
                </div>
              )}
              {errors.password && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.password}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirmar senha</label>
              <div className={`mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 ${
                errors.confirm ? "border-destructive" : ""
              }`}>
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Digite a senha novamente"
                  className="flex-1 bg-transparent text-sm outline-none"
                  autoComplete="new-password"
                />
                {confirmPassword && password === confirmPassword && (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
              </div>
              {errors.confirm && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.confirm}
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                Li e aceito os <span className="text-primary font-semibold">Termos de Uso</span> e a{" "}
                <span className="text-primary font-semibold">Política de Privacidade</span>.
              </span>
            </label>
            {errors.terms && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.terms}
              </p>
            )}

            <button
              onClick={next}
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Selfie ao vivo */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border-2 border-info/30 bg-info/10 p-4">
              <p className="text-sm font-bold text-info flex items-center gap-2">
                <Camera className="h-4 w-4" /> Selfie ao vivo
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                A foto é capturada ao vivo pela câmera frontal. <strong>Não aceitamos</strong> imagens da galeria, fotos impressas, screenshots ou imagens em telas. Você precisará <strong>piscar</strong> durante a verificação. Se tudo estiver OK, sua conta é liberada na hora.
              </p>
            </div>

            <LiveSelfieCapture
              label="Selfie obrigatória (com verificação anti-fraude)"
              bucket="selfies"
              pathPrefix={`signup/${cpf.replace(/\D/g, "")}/selfie`}
              value={selfieUrl}
              onChange={(url) => setSelfieUrl(url)}
              liveness
              hint="Boa iluminação, sem óculos escuros, rosto centralizado no círculo"
            />

            {/* Resumo */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                Resumo do cadastro
              </p>
              <Row label="Nome" value={fullName} />
              <Row label="CPF" value={cpf} />
              <Row label="Nascimento" value={birthDate} />
              <Row label="Telefone" value={phone} />
              <Row label="E-mail" value={email} />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !selfieUrl}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Finalizar cadastro <CheckCircle2 className="h-4 w-4" /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Componentes auxiliares ----------
interface FieldProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  hint?: string;
}

const Field = ({
  label, icon, value, onChange, placeholder, error, type = "text",
  maxLength, autoComplete, inputMode, hint,
}: FieldProps) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <div className={`mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 transition-colors ${
      error ? "border-destructive" : "focus-within:border-primary"
    }`}>
      <span className="text-muted-foreground">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="flex-1 bg-transparent text-sm outline-none"
      />
      {!error && value && hint && (
        <span className="text-[10px] text-success font-semibold">{hint}</span>
      )}
    </div>
    {error && (
      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
        <AlertCircle className="h-3 w-3" /> {error}
      </p>
    )}
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium truncate ml-2">{value || "—"}</span>
  </div>
);

export default PassengerSignup;
