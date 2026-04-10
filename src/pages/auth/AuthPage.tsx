import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Mail, Lock, User, Phone, FileText, Camera, ArrowLeft, ArrowRight, Bike, Crown } from "lucide-react";

type AuthMode = "login" | "register";
type UserType = "passenger" | "driver";
type RegisterStep = 1 | 2 | 3;

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [userType, setUserType] = useState<UserType>("passenger");
  const [step, setStep] = useState<RegisterStep>(1);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(userType === "passenger" ? "/passenger" : "/driver");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register" && step < 3) {
      setStep((s) => (s + 1) as RegisterStep);
      return;
    }
    navigate(userType === "passenger" ? "/passenger" : "/driver");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="bg-gradient-primary p-6 pb-10">
        <button onClick={() => mode === "register" && step > 1 ? setStep((s) => (s - 1) as RegisterStep) : navigate("/")} className="mb-4 text-primary-foreground/80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/20">
            <Car className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">UrbanGo</h1>
            <p className="text-xs text-primary-foreground/70">
              {mode === "login" ? "Entre na sua conta" : `Cadastro - Etapa ${step}/3`}
            </p>
          </div>
        </div>
      </div>

      <div className="relative -mt-4 flex-1 rounded-t-3xl bg-card p-6">
        {/* User type toggle */}
        <div className="mb-5 flex rounded-xl bg-muted p-1">
          {[
            { id: "passenger" as UserType, label: "Passageiro", icon: User },
            { id: "driver" as UserType, label: "Motorista", icon: Car },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setUserType(t.id); setStep(1); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                userType === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Auth mode toggle */}
        <div className="mb-5 flex gap-4 border-b">
          {[
            { id: "login" as AuthMode, label: "Entrar" },
            { id: "register" as AuthMode, label: "Cadastrar" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setStep(1); }}
              className={`pb-2 text-sm font-semibold transition-colors ${
                mode === m.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* LOGIN */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input type="email" placeholder="seu@email.com" className="flex-1 bg-transparent text-sm outline-none" required />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input type="password" placeholder="••••••••" className="flex-1 bg-transparent text-sm outline-none" required />
              </div>
            </div>
            <button type="submit" className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow">
              Entrar como {userType === "passenger" ? "Passageiro" : "Motorista"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              <button type="button" className="text-primary font-medium">Esqueci minha senha</button>
            </p>
          </form>
        )}

        {/* REGISTER */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
            {/* Step 1: Basic info */}
            {step === 1 && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome completo</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Seu nome" className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">CPF</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="000.000.000-00" className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Apenas 1 conta por CPF é permitida</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input type="email" placeholder="seu@email.com" className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <input type="tel" placeholder="(11) 99999-0000" className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Senha</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <input type="password" placeholder="Mínimo 8 caracteres" className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Verification */}
            {step === 2 && (
              <>
                <div className="rounded-xl bg-info/10 border border-info/30 p-4">
                  <p className="text-sm font-semibold text-info">Verificação de identidade</p>
                  <p className="text-xs text-muted-foreground mt-1">Precisamos verificar sua identidade para sua segurança.</p>
                </div>

                {/* OTP */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Código de verificação (SMS)</label>
                  <div className="mt-1 flex gap-2">
                    {[...Array(6)].map((_, i) => (
                      <input key={i} type="text" maxLength={1} className="h-11 w-11 rounded-lg border bg-background text-center text-lg font-bold outline-none focus:border-primary" />
                    ))}
                  </div>
                  <button type="button" className="mt-2 text-xs font-medium text-primary">Reenviar código</button>
                </div>

                {/* Selfie */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Selfie de verificação</label>
                  <button type="button" className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background py-8 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <Camera className="h-5 w-5" /> Tirar selfie
                  </button>
                </div>

                {/* Driver-specific */}
                {userType === "driver" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">CNH (frente)</label>
                      <button type="button" className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background py-6 text-sm text-muted-foreground hover:border-primary">
                        <Camera className="h-5 w-5" /> Fotografar CNH (frente)
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">CNH (verso)</label>
                      <button type="button" className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background py-6 text-sm text-muted-foreground hover:border-primary">
                        <Camera className="h-5 w-5" /> Fotografar CNH (verso)
                      </button>
                    </div>
                    <div className="rounded-xl bg-warning/10 border border-warning/30 p-3">
                      <p className="text-xs font-semibold text-warning">CNH com EAR obrigatória</p>
                      <p className="text-[10px] text-muted-foreground">Sua CNH deve ter a observação EAR (Exerce Atividade Remunerada).</p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 3: Driver vehicle / Passenger confirmation */}
            {step === 3 && (
              <>
                {userType === "driver" ? (
                  <>
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                      <p className="text-sm font-semibold">Dados do veículo</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                      <div className="mt-1 flex gap-2">
                        {[
                          { id: "moto", label: "Moto", icon: Bike },
                          { id: "car", label: "Carro", icon: Car },
                          { id: "premium", label: "Premium", icon: Crown },
                        ].map((cat) => (
                          <button key={cat.id} type="button" className="flex flex-1 flex-col items-center gap-1 rounded-xl border-2 border-transparent bg-muted p-3 hover:border-primary transition-colors">
                            <cat.icon className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs font-semibold">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {[
                      { label: "Modelo do veículo", placeholder: "Ex: Toyota Corolla 2022" },
                      { label: "Cor", placeholder: "Ex: Prata" },
                      { label: "Placa", placeholder: "Ex: ABC-1D23" },
                    ].map((f) => (
                      <div key={f.label}>
                        <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                        <div className="mt-1 rounded-xl border bg-background px-3 py-2.5">
                          <input type="text" placeholder={f.placeholder} className="w-full bg-transparent text-sm outline-none" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="space-y-4 text-center py-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                      <User className="h-8 w-8 text-success" />
                    </div>
                    <h3 className="text-lg font-bold">Quase lá!</h3>
                    <p className="text-sm text-muted-foreground">
                      Revise seus dados e confirme o cadastro. Após a verificação, você poderá solicitar corridas.
                    </p>
                    <div className="rounded-xl bg-muted p-4 text-left space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">CPF</span><span className="font-medium">Validado ✓</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Telefone</span><span className="font-medium">Verificado ✓</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Selfie</span><span className="font-medium">Enviada ✓</span></div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Progress dots */}
            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-2 rounded-full transition-all ${step === s ? "w-6 bg-primary" : "w-2 bg-muted"}`} />
              ))}
            </div>

            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow">
              {step < 3 ? <>Próximo <ArrowRight className="h-4 w-4" /></> : mode === "register" ? "Finalizar cadastro" : "Entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
