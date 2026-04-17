import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, User, FileText, Calendar, Phone, Mail, Lock,
  Eye, EyeOff, Loader2, Camera, CheckCircle2, ShieldCheck, AlertCircle,
  Car, Bike, Sparkles, KeyRound, CreditCard, Hash, Palette, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, formatCPF, formatPhone, formatPlate } from "@/lib/validators";
import { validatePlate, isFakePlate } from "@/lib/plateValidator";
import { formatDateBR, parseDateBRtoISO, calcAgeBR } from "@/lib/brFormat";
import {
  isFakeName, isFakeEmail, isFakeCPF, isFakePhone, checkPasswordStrength,
} from "@/lib/antiFake";
import DocumentUpload from "@/components/auth/DocumentUpload";
import LiveSelfieCapture from "@/components/auth/LiveSelfieCapture";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/authErrors";

type StepKey = "dados" | "seguranca" | "selfie" | "veiculo" | "documentos" | "antecedentes" | "pix";

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "dados", label: "Dados pessoais" },
  { key: "seguranca", label: "Segurança" },
  { key: "selfie", label: "Selfie ao vivo" },
  { key: "veiculo", label: "Veículo" },
  { key: "documentos", label: "Documentos" },
  { key: "antecedentes", label: "Antecedentes" },
  { key: "pix", label: "Pix" },
];

const CATEGORIES = [
  { id: "moto", label: "Moto", icon: Bike, desc: "Entregas e corridas rápidas" },
  { id: "economico", label: "Econômico", icon: Car, desc: "Carros populares" },
  { id: "conforto", label: "Conforto", icon: Sparkles, desc: "Carros mais novos" },
];

const PIX_TYPES = [
  { id: "cpf", label: "CPF" },
  { id: "email", label: "E-mail" },
  { id: "phone", label: "Telefone" },
  { id: "random", label: "Chave aleatória" },
];

const DriverSignup = () => {
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

  // Selfie (ao vivo, com liveness)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [selfieLivenessUrl, setSelfieLivenessUrl] = useState<string | null>(null);
  const [livenessVerified, setLivenessVerified] = useState(false);

  // Antecedentes criminais
  const [criminalRecordUrl, setCriminalRecordUrl] = useState<string | null>(null);
  const [criminalRecordDate, setCriminalRecordDate] = useState("");

  // Veículo
  const [category, setCategory] = useState<string>("economico");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  // Fotos do veículo (4 ângulos)
  const [vehiclePhotoFront, setVehiclePhotoFront] = useState<string | null>(null);
  const [vehiclePhotoBack, setVehiclePhotoBack] = useState<string | null>(null);
  const [vehiclePhotoLeft, setVehiclePhotoLeft] = useState<string | null>(null);
  const [vehiclePhotoRight, setVehiclePhotoRight] = useState<string | null>(null);

  // Documentos
  const [cnhNumber, setCnhNumber] = useState("");
  const [cnhEar, setCnhEar] = useState(false);
  const [cnhFrontUrl, setCnhFrontUrl] = useState<string | null>(null);
  const [cnhBackUrl, setCnhBackUrl] = useState<string | null>(null);
  const [crlvUrl, setCrlvUrl] = useState<string | null>(null);
  const [selfieDocUrl, setSelfieDocUrl] = useState<string | null>(null);

  // Pix
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixHolderName, setPixHolderName] = useState("");

  // Erros
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setErr = (k: string, msg: string) => setErrors((e) => ({ ...e, [k]: msg }));
  const clearErr = (k: string) => setErrors((e) => { const c = { ...e }; delete c[k]; return c; });

  const pwdStrength = useMemo(() => checkPasswordStrength(password), [password]);
  const age = useMemo(() => calcAgeBR(birthDate), [birthDate]);
  const currentYear = new Date().getFullYear();

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
    if (a < 20) return "Motorista precisa ter no mínimo 20 anos";
    if (a > 80) return "Data inválida";
    return "";
  };

  const validatePhoneField = (v: string) => {
    const cleaned = v.replace(/\D/g, "");
    if (cleaned.length === 0) return "Informe o telefone";
    if (cleaned.length < 10 || cleaned.length > 11) return "Telefone inválido";
    if (cleaned.length === 11 && cleaned[2] !== "9") return "Celular deve começar com 9";
    const fake = isFakePhone(cleaned);
    return fake.fake ? fake.reason || "Telefone inválido" : "";
  };

  const validateEmailField = (v: string) => {
    const cleaned = v.trim().toLowerCase();
    if (!cleaned) return "Informe o e-mail";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) return "E-mail inválido";
    const fake = isFakeEmail(cleaned);
    return fake.fake ? fake.reason || "E-mail inválido" : "";
  };

  const validatePlateField = (v: string) => {
    const cleaned = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!cleaned) return "Informe a placa";
    if (!validatePlate(cleaned)) return "Placa inválida (ex: ABC1D23 ou ABC1234)";
    const fake = isFakePlate(cleaned);
    return fake.fake ? fake.reason || "Placa inválida" : "";
  };

  const validateYear = (v: string) => {
    const y = parseInt(v, 10);
    if (!v) return "Informe o ano";
    if (isNaN(y) || y < 2000 || y > currentYear + 1) {
      return `Ano deve estar entre 2000 e ${currentYear + 1}`;
    }
    if (category === "conforto" && y < currentYear - 8) {
      return "Conforto exige veículo até 8 anos de uso";
    }
    return "";
  };

  const validateCnh = (v: string) => {
    const cleaned = v.replace(/\D/g, "");
    if (!cleaned) return "Informe o número da CNH";
    if (cleaned.length !== 11) return "CNH deve ter 11 dígitos";
    return "";
  };

  // ---------- Handlers ----------
  const handle = (
    setter: (v: string) => void,
    formatter: (v: string) => string,
    validator: (v: string) => string,
    field: string,
  ) => (v: string) => {
    const formatted = formatter(v);
    setter(formatted);
    const err = validator(formatted);
    err ? setErr(field, err) : clearErr(field);
  };

  const handleName = handle(setFullName, (v) => v, validateName, "name");
  const handleCpf = handle(setCpf, formatCPF, validateCpfField, "cpf");
  const handleBirth = handle(setBirthDate, formatDateBR, validateBirth, "birth");
  const handlePhone = handle(setPhone, formatPhone, validatePhoneField, "phone");
  const handleEmail = handle(setEmail, (v) => v, validateEmailField, "email");
  const handlePlate = handle(setVehiclePlate, formatPlate, validatePlateField, "plate");
  const handleYear = handle(setVehicleYear, (v) => v.replace(/\D/g, "").slice(0, 4), validateYear, "year");
  const handleCnhNumber = handle(setCnhNumber, (v) => v.replace(/\D/g, "").slice(0, 11), validateCnh, "cnh");

  // ---------- Step validation ----------
  const validateStepDados = async (): Promise<boolean> => {
    const errs: Record<string, string> = {};
    const e1 = validateName(fullName); if (e1) errs.name = e1;
    const e2 = validateCpfField(cpf); if (e2) errs.cpf = e2;
    const e3 = validateBirth(birthDate); if (e3) errs.birth = e3;
    const e4 = validatePhoneField(phone); if (e4) errs.phone = e4;
    const e5 = validateEmailField(email); if (e5) errs.email = e5;
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Corrija os campos destacados");
      return false;
    }

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

  const validateStepSelfie = (): boolean => {
    if (!selfieUrl) {
      toast.error("Tire sua selfie ao vivo para continuar");
      return false;
    }
    if (!livenessVerified) {
      toast.error("Verificação anti-fraude obrigatória. Repita a captura.");
      return false;
    }
    return true;
  };

  const validateStepAntecedentes = (): boolean => {
    const errs: Record<string, string> = {};
    if (!criminalRecordUrl) errs.criminal = "Envie a certidão de antecedentes criminais";
    if (!criminalRecordDate) errs.criminalDate = "Informe a data de emissão";
    else {
      const iso = parseDateBRtoISO(criminalRecordDate);
      if (!iso) errs.criminalDate = "Data inválida (DD/MM/AAAA)";
      else {
        const issued = new Date(iso);
        const days = (Date.now() - issued.getTime()) / (1000 * 60 * 60 * 24);
        if (days < 0) errs.criminalDate = "Data não pode ser futura";
        else if (days > 90) errs.criminalDate = "Certidão deve ter sido emitida nos últimos 90 dias";
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Corrija os campos destacados");
      return false;
    }
    return true;
  };

  const validateStepVeiculo = async (): Promise<boolean> => {
    const errs: Record<string, string> = {};
    if (!vehicleBrand.trim()) errs.brand = "Informe a marca";
    if (!vehicleModel.trim()) errs.model = "Informe o modelo";
    if (!vehicleColor.trim()) errs.color = "Informe a cor";
    const ey = validateYear(vehicleYear); if (ey) errs.year = ey;
    const ep = validatePlateField(vehiclePlate); if (ep) errs.plate = ep;
    if (!vehiclePhotoFront) errs.photoFront = "Envie a foto da frente do veículo";
    if (!vehiclePhotoBack) errs.photoBack = "Envie a foto da traseira do veículo";
    if (!vehiclePhotoLeft) errs.photoLeft = "Envie a foto da lateral esquerda";
    if (!vehiclePhotoRight) errs.photoRight = "Envie a foto da lateral direita";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Corrija os campos destacados");
      return false;
    }

    // Checa duplicidade da placa
    setLoading(true);
    try {
      const cleanPlate = vehiclePlate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const { data: dupPlate } = await supabase
        .from("drivers").select("id").eq("vehicle_plate", cleanPlate).maybeSingle();
      if (dupPlate) {
        setErr("plate", "Esta placa já está cadastrada");
        toast.error("Placa já cadastrada");
        return false;
      }
    } finally {
      setLoading(false);
    }
    return true;
  };

  const validateStepDocumentos = (): boolean => {
    const errs: Record<string, string> = {};
    const ec = validateCnh(cnhNumber); if (ec) errs.cnh = ec;
    if (!cnhEar) errs.cnhEar = "É obrigatório possuir CNH com observação EAR (Exerce Atividade Remunerada)";
    if (!cnhFrontUrl) errs.cnhFront = "Envie a frente da CNH";
    if (!cnhBackUrl) errs.cnhBack = "Envie o verso da CNH";
    if (!crlvUrl) errs.crlv = "Envie o CRLV do veículo";
    if (!selfieDocUrl) errs.selfieDoc = "Envie a selfie segurando o documento";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.cnhEar) toast.error(errs.cnhEar);
      else toast.error("Envie todos os documentos");
      return false;
    }
    return true;
  };

  const validateStepPix = (): boolean => {
    const errs: Record<string, string> = {};
    if (!pixKey.trim()) errs.pixKey = "Informe a chave Pix";
    if (!pixHolderName.trim() || pixHolderName.trim().length < 5) {
      errs.pixHolder = "Informe o nome completo do favorecido";
    }
    // Valida chave conforme tipo
    if (pixKeyType === "cpf") {
      const c = pixKey.replace(/\D/g, "");
      if (!validateCPF(c)) errs.pixKey = "CPF do Pix inválido";
    } else if (pixKeyType === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(pixKey.trim())) errs.pixKey = "E-mail Pix inválido";
    } else if (pixKeyType === "phone") {
      const c = pixKey.replace(/\D/g, "");
      if (c.length < 10 || c.length > 11) errs.pixKey = "Telefone Pix inválido";
    } else if (pixKeyType === "random") {
      if (pixKey.replace(/\s/g, "").length < 32) errs.pixKey = "Chave aleatória inválida";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Corrija os campos destacados");
      return false;
    }
    return true;
  };

  // ---------- Avanço ----------
  const next = async () => {
    let ok = false;
    if (step === 0) ok = await validateStepDados();
    else if (step === 1) ok = validateStepSeguranca();
    else if (step === 2) ok = validateStepSelfie();
    else if (step === 3) ok = await validateStepVeiculo();
    else if (step === 4) ok = validateStepDocumentos();
    else if (step === 5) ok = validateStepAntecedentes();
    else if (step === 6) {
      ok = validateStepPix();
      if (ok) return handleSubmit();
    }
    if (ok && step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => {
    if (step === 0) navigate("/auth");
    else setStep((s) => s - 1);
  };

  // ---------- Submissão ----------
  const handleSubmit = async () => {
    setLoading(true);
    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanPhone = phone.replace(/\D/g, "");
    const cleanPlate = vehiclePlate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const isoBirth = parseDateBRtoISO(birthDate);

    // Pré-checagem de duplicidade (evita o erro genérico do GoTrue)
    try {
      const { data: dupes } = await supabase.rpc("check_signup_dupes", {
        _cpf: cleanCpf,
        _phone: cleanPhone,
      });
      const row = Array.isArray(dupes) ? dupes[0] : dupes;
      if (row?.cpf_taken) {
        setLoading(false);
        toast.error("CPF já cadastrado em outra conta.", { duration: 6000 });
        setErr("cpf", "CPF já cadastrado em outra conta.");
        setStep(0);
        return;
      }
      if (row?.phone_taken) {
        setLoading(false);
        toast.error("Telefone já cadastrado em outra conta. Use outro número.", { duration: 6000 });
        setErr("phone", "Telefone já cadastrado em outra conta.");
        setStep(0);
        return;
      }
    } catch {/* ignore — segue para o signUp */}

    const metadata: Record<string, string> = {
      full_name: fullName.trim(),
      cpf: cleanCpf,
      phone: cleanPhone,
      birth_date: isoBirth || "",
      user_type: "driver",
      selfie_signup_url: selfieUrl || "",
      category,
      vehicle_brand: vehicleBrand.trim(),
      vehicle_model: vehicleModel.trim(),
      vehicle_color: vehicleColor.trim(),
      vehicle_year: vehicleYear,
      vehicle_plate: cleanPlate,
      cnh_number: cnhNumber,
      cnh_ear: cnhEar ? "true" : "false",
      cnh_front_url: cnhFrontUrl || "",
      cnh_back_url: cnhBackUrl || "",
      crlv_url: crlvUrl || "",
      selfie_with_document_url: selfieDocUrl || "",
      vehicle_photo_front_url: vehiclePhotoFront || "",
      vehicle_photo_back_url: vehiclePhotoBack || "",
      vehicle_photo_left_url: vehiclePhotoLeft || "",
      vehicle_photo_right_url: vehiclePhotoRight || "",
      criminal_record_url: criminalRecordUrl || "",
      criminal_record_issued_at: parseDateBRtoISO(criminalRecordDate) || "",
      selfie_liveness_url: selfieLivenessUrl || "",
      liveness_verified: livenessVerified ? "true" : "false",
      pix_key: pixKey.trim(),
      pix_key_type: pixKeyType,
      pix_holder_name: pixHolderName.trim(),
    };

    const { error } = await signUp(email.trim().toLowerCase(), password, metadata);
    setLoading(false);

    if (error) {
      const { message, field } = friendlyAuthError(error);
      toast.error(message, { duration: 6000 });
      if (field === "password") {
        setStep(1); // Segurança
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
      } else if (field === "plate") {
        setStep(3);
        setErr("plate", message);
      }
      return;
    }

    toast.success("Cadastro enviado! Aguarde a análise da equipe.");
    navigate("/driver/status");
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
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/20">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display">Cadastro de motorista</h1>
            <p className="text-xs text-primary-foreground/80">
              Etapa {step + 1} de {STEPS.length} · {STEPS[step].label}
            </p>
          </div>
        </div>
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

      <div className="relative -mt-6 flex-1 rounded-t-3xl bg-card p-6 pb-10">
        {/* STEP 0: Dados */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <Field label="Nome completo" icon={<User className="h-4 w-4" />} value={fullName} onChange={handleName} placeholder="Como aparece no RG" error={errors.name} autoComplete="name" />
            <Field label="CPF" icon={<FileText className="h-4 w-4" />} value={cpf} onChange={handleCpf} placeholder="000.000.000-00" error={errors.cpf} maxLength={14} inputMode="numeric" />
            <Field label="Data de nascimento" icon={<Calendar className="h-4 w-4" />} value={birthDate} onChange={handleBirth} placeholder="DD/MM/AAAA" error={errors.birth} maxLength={10} inputMode="numeric" hint={age !== null && age >= 21 ? `${age} anos` : undefined} />
            <Field label="Telefone celular" icon={<Phone className="h-4 w-4" />} value={phone} onChange={handlePhone} placeholder="(11) 99999-0000" error={errors.phone} maxLength={15} inputMode="tel" autoComplete="tel" />
            <Field label="E-mail" icon={<Mail className="h-4 w-4" />} value={email} onChange={handleEmail} placeholder="seu@email.com" error={errors.email} type="email" autoComplete="email" />
            <NextBtn onClick={next} loading={loading} />
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
            <PasswordField label="Senha" value={password} onChange={setPassword} show={showPwd} setShow={setShowPwd} placeholder="Mínimo 8 caracteres" error={errors.password} />
            {password && (
              <div className="space-y-1 -mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < pwdStrength.score ? pwdStrength.color : "bg-muted"}`} />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Força: <span className="font-semibold">{pwdStrength.label}</span>
                </p>
              </div>
            )}
            <PasswordField label="Confirmar senha" value={confirmPassword} onChange={setConfirmPassword} show={showPwd} setShow={setShowPwd} placeholder="Digite novamente" error={errors.confirm} match={!!confirmPassword && password === confirmPassword} />

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-primary" />
              <span className="text-xs text-muted-foreground">
                Li e aceito os <span className="text-primary font-semibold">Termos de Uso do Motorista</span>, a{" "}
                <span className="text-primary font-semibold">Política de Privacidade</span> e autorizo a verificação dos meus documentos.
              </span>
            </label>
            {errors.terms && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {errors.terms}</p>}
            <NextBtn onClick={next} loading={loading} />
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
                A captura é feita ao vivo pela câmera frontal. <strong>Não aceitamos</strong> fotos da galeria, fotos impressas, screenshots ou imagens em telas. Você precisará <strong>piscar</strong> durante a verificação.
              </p>
            </div>
            <LiveSelfieCapture
              label="Selfie obrigatória (com verificação anti-fraude)"
              bucket="selfies"
              pathPrefix={`signup/${cpf.replace(/\D/g, "")}/selfie`}
              value={selfieUrl}
              onChange={(url, meta) => {
                setSelfieUrl(url);
                setSelfieLivenessUrl(meta?.livenessUrl || null);
                setLivenessVerified(meta?.verified || false);
              }}
              liveness
              hint="Boa iluminação, sem óculos escuros, rosto centralizado no círculo"
            />
            <NextBtn onClick={next} loading={loading} disabled={!selfieUrl || !livenessVerified} />
          </div>
        )}

        {/* STEP 3: Veículo */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Categoria do veículo</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-colors ${
                      category === c.id ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50"
                    }`}
                  >
                    <c.icon className={`h-5 w-5 ${category === c.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-semibold">{c.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {CATEGORIES.find((c) => c.id === category)?.desc}
              </p>
            </div>

            <Field label="Marca" icon={<Car className="h-4 w-4" />} value={vehicleBrand} onChange={(v) => { setVehicleBrand(v); v.trim() ? clearErr("brand") : setErr("brand", "Informe a marca"); }} placeholder="Ex: Volkswagen" error={errors.brand} />
            <Field label="Modelo" icon={<Car className="h-4 w-4" />} value={vehicleModel} onChange={(v) => { setVehicleModel(v); v.trim() ? clearErr("model") : setErr("model", "Informe o modelo"); }} placeholder="Ex: Gol 1.0" error={errors.model} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor" icon={<Palette className="h-4 w-4" />} value={vehicleColor} onChange={(v) => { setVehicleColor(v); v.trim() ? clearErr("color") : setErr("color", "Informe a cor"); }} placeholder="Branco" error={errors.color} />
              <Field label="Ano" icon={<Calendar className="h-4 w-4" />} value={vehicleYear} onChange={handleYear} placeholder={String(currentYear)} error={errors.year} maxLength={4} inputMode="numeric" />
            </div>

            <Field label="Placa" icon={<Hash className="h-4 w-4" />} value={vehiclePlate} onChange={handlePlate} placeholder="ABC-1D23" error={errors.plate} maxLength={8} />

            <div className="rounded-xl border border-info/30 bg-info/10 p-3 mt-2">
              <p className="text-xs font-bold text-info">📸 Fotos do veículo</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Envie 4 fotos do veículo (frente, traseira e laterais). Use boa iluminação e mostre a placa visível.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <DocumentUpload
                  label="Frente (com placa)"
                  bucket="driver-documents"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/veiculo-frente`}
                  value={vehiclePhotoFront}
                  onChange={(url) => { setVehiclePhotoFront(url); url && clearErr("photoFront"); }}
                  capture="environment"
                />
                {errors.photoFront && <p className="text-[10px] text-destructive mt-1">{errors.photoFront}</p>}
              </div>
              <div>
                <DocumentUpload
                  label="Traseira (com placa)"
                  bucket="driver-documents"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/veiculo-traseira`}
                  value={vehiclePhotoBack}
                  onChange={(url) => { setVehiclePhotoBack(url); url && clearErr("photoBack"); }}
                  capture="environment"
                />
                {errors.photoBack && <p className="text-[10px] text-destructive mt-1">{errors.photoBack}</p>}
              </div>
              <div>
                <DocumentUpload
                  label="Lateral esquerda"
                  bucket="driver-documents"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/veiculo-lat-esq`}
                  value={vehiclePhotoLeft}
                  onChange={(url) => { setVehiclePhotoLeft(url); url && clearErr("photoLeft"); }}
                  capture="environment"
                />
                {errors.photoLeft && <p className="text-[10px] text-destructive mt-1">{errors.photoLeft}</p>}
              </div>
              <div>
                <DocumentUpload
                  label="Lateral direita"
                  bucket="driver-documents"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/veiculo-lat-dir`}
                  value={vehiclePhotoRight}
                  onChange={(url) => { setVehiclePhotoRight(url); url && clearErr("photoRight"); }}
                  capture="environment"
                />
                {errors.photoRight && <p className="text-[10px] text-destructive mt-1">{errors.photoRight}</p>}
              </div>
            </div>

            <NextBtn onClick={next} loading={loading} />
          </div>
        )}

        {/* STEP 4: Documentos */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border border-info/30 bg-info/10 p-3">
              <p className="text-xs text-info-foreground/90">
                Envie fotos nítidas e legíveis. Documentos ilegíveis serão recusados.
              </p>
            </div>

            <Field label="Número da CNH" icon={<FileText className="h-4 w-4" />} value={cnhNumber} onChange={handleCnhNumber} placeholder="11 dígitos" error={errors.cnh} maxLength={11} inputMode="numeric" />

            <div>
              <label className={`flex items-center gap-2 cursor-pointer rounded-xl border bg-background p-3 ${errors.cnhEar ? "border-destructive" : ""}`}>
                <input
                  type="checkbox"
                  checked={cnhEar}
                  onChange={(e) => { setCnhEar(e.target.checked); if (e.target.checked) clearErr("cnhEar"); }}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-xs">
                  Confirmo que minha CNH possui a observação <strong>EAR</strong> (Exerce Atividade Remunerada) — <span className="text-destructive">obrigatório</span>
                </span>
              </label>
              {errors.cnhEar && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> {errors.cnhEar}
                </p>
              )}
            </div>

            <DocumentUpload label="CNH (frente)" bucket="driver-documents" pathPrefix={`signup/${cpf.replace(/\D/g, "")}/cnh-frente`} value={cnhFrontUrl} onChange={setCnhFrontUrl} capture="environment" hint="Foto da frente da CNH, sem reflexos" />
            {errors.cnhFront && <p className="text-xs text-destructive flex items-center gap-1 -mt-2"><AlertCircle className="h-3 w-3" /> {errors.cnhFront}</p>}

            <DocumentUpload label="CNH (verso)" bucket="driver-documents" pathPrefix={`signup/${cpf.replace(/\D/g, "")}/cnh-verso`} value={cnhBackUrl} onChange={setCnhBackUrl} capture="environment" hint="Foto do verso com observações" />
            {errors.cnhBack && <p className="text-xs text-destructive flex items-center gap-1 -mt-2"><AlertCircle className="h-3 w-3" /> {errors.cnhBack}</p>}

            <DocumentUpload label="CRLV do veículo (PDF ou imagem)" bucket="driver-documents" pathPrefix={`signup/${cpf.replace(/\D/g, "")}/crlv`} value={crlvUrl} onChange={setCrlvUrl} capture="environment" acceptPdf hint="Documento do veículo (CRLV) atualizado — aceita PDF" />
            {errors.crlv && <p className="text-xs text-destructive flex items-center gap-1 -mt-2"><AlertCircle className="h-3 w-3" /> {errors.crlv}</p>}

            <DocumentUpload label="Selfie segurando a CNH" bucket="driver-documents" pathPrefix={`signup/${cpf.replace(/\D/g, "")}/selfie-doc`} value={selfieDocUrl} onChange={setSelfieDocUrl} capture="user" hint="Seu rosto + CNH visíveis na mesma foto" />
            {errors.selfieDoc && <p className="text-xs text-destructive flex items-center gap-1 -mt-2"><AlertCircle className="h-3 w-3" /> {errors.selfieDoc}</p>}

            <NextBtn onClick={next} loading={loading} />
          </div>
        )}

        {/* STEP 5: Antecedentes criminais */}
        {step === 5 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border-2 border-warning/30 bg-warning/10 p-4">
              <p className="text-sm font-bold text-warning flex items-center gap-2">
                <Shield className="h-4 w-4" /> Certidão de antecedentes criminais
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Envie a certidão emitida pelo <strong>Tribunal de Justiça</strong> do seu estado ou pela <strong>Polícia Federal</strong>. A certidão deve estar dentro do prazo de validade (até 90 dias da emissão).
              </p>
              <a
                href="https://www.tjsp.jus.br/CertidaoAntecedentes"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-primary underline"
              >
                Como emitir a certidão →
              </a>
            </div>

            <DocumentUpload
              label="Certidão de antecedentes criminais (PDF ou imagem)"
              bucket="driver-documents"
              pathPrefix={`signup/${cpf.replace(/\D/g, "")}/antecedentes`}
              value={criminalRecordUrl}
              onChange={setCriminalRecordUrl}
              acceptPdf
              hint="Documento completo, todas as páginas legíveis — aceita PDF"
            />
            {errors.criminal && <p className="text-xs text-destructive flex items-center gap-1 -mt-2"><AlertCircle className="h-3 w-3" /> {errors.criminal}</p>}

            <Field
              label="Data de emissão da certidão"
              icon={<Calendar className="h-4 w-4" />}
              value={criminalRecordDate}
              onChange={(v) => { setCriminalRecordDate(formatDateBR(v)); clearErr("criminalDate"); }}
              placeholder="DD/MM/AAAA"
              error={errors.criminalDate}
              maxLength={10}
              inputMode="numeric"
            />

            <NextBtn onClick={next} loading={loading} />
          </div>
        )}

        {/* STEP 6: Pix */}
        {step === 6 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4">
              <p className="text-sm font-bold text-success flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Conta para receber
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Você receberá seus ganhos via Pix. O nome do favorecido deve ser igual ao seu CPF.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo de chave Pix</label>
              <div className="grid grid-cols-2 gap-2">
                {PIX_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setPixKeyType(t.id); setPixKey(""); }}
                    className={`rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors ${
                      pixKeyType === t.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-muted/30"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label="Chave Pix"
              icon={<KeyRound className="h-4 w-4" />}
              value={pixKey}
              onChange={(v) => {
                if (pixKeyType === "cpf") setPixKey(formatCPF(v));
                else if (pixKeyType === "phone") setPixKey(formatPhone(v));
                else setPixKey(v);
                clearErr("pixKey");
              }}
              placeholder={
                pixKeyType === "cpf" ? "000.000.000-00"
                : pixKeyType === "email" ? "seu@email.com"
                : pixKeyType === "phone" ? "(11) 99999-0000"
                : "chave aleatória de 32 caracteres"
              }
              error={errors.pixKey}
            />

            <Field label="Nome do favorecido" icon={<User className="h-4 w-4" />} value={pixHolderName} onChange={(v) => { setPixHolderName(v); clearErr("pixHolder"); }} placeholder="Como cadastrado no banco" error={errors.pixHolder} />

            <div className="rounded-xl border bg-muted/30 p-4 space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Resumo do cadastro</p>
              <Row label="Nome" value={fullName} />
              <Row label="CPF" value={cpf} />
              <Row label="Categoria" value={CATEGORIES.find((c) => c.id === category)?.label || ""} />
              <Row label="Veículo" value={`${vehicleBrand} ${vehicleModel} ${vehicleYear}`} />
              <Row label="Placa" value={vehiclePlate} />
            </div>

            <button
              onClick={next}
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enviar para análise <CheckCircle2 className="h-4 w-4" /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Auxiliares ----------
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

const Field = ({ label, icon, value, onChange, placeholder, error, type = "text", maxLength, autoComplete, inputMode, hint }: FieldProps) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <div className={`mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 transition-colors ${error ? "border-destructive" : "focus-within:border-primary"}`}>
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
      {!error && value && hint && <span className="text-[10px] text-success font-semibold">{hint}</span>}
    </div>
    {error && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {error}</p>}
  </div>
);

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (s: boolean) => void;
  placeholder?: string;
  error?: string;
  match?: boolean;
}

const PasswordField = ({ label, value, onChange, show, setShow, placeholder, error, match }: PasswordFieldProps) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <div className={`mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 ${error ? "border-destructive" : ""}`}>
      <Lock className="h-4 w-4 text-muted-foreground" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none"
        autoComplete="new-password"
      />
      {match && <CheckCircle2 className="h-4 w-4 text-success" />}
      <button type="button" onClick={() => setShow(!show)} className="text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    {error && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {error}</p>}
  </div>
);

const NextBtn = ({ onClick, loading, disabled }: { onClick: () => void; loading: boolean; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continuar <ArrowRight className="h-4 w-4" /></>}
  </button>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium truncate ml-2">{value || "—"}</span>
  </div>
);

export default DriverSignup;
