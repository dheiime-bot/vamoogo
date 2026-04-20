import VamooLogo from "@/components/shared/VamooLogo";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, User } from "lucide-react";
import vamooIcon from "@/assets/vamoo-icon.png";

const AuthPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="border border-border rounded-3xl shadow-xl p-8 sm:p-10" style={{ backgroundColor: "#f5fbfb" }}>
          {/* Botão voltar */}
          <button
            onClick={() => navigate("/")}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>

          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <VamooLogo height={109} card={false} className="mb-3" />
            <h1 className="text-2xl font-display font-extrabold text-foreground">Como você quer entrar?</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Escolha o app que você usa. Cada perfil tem seu próprio acesso.
            </p>
          </div>

          {/* Opções de login */}
          <div className="space-y-3">
            <button
              onClick={() => navigate("/auth/passenger/login")}
              className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-background p-5 text-left transition-all hover:border-primary hover:shadow-glow"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-primary">
                <User className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-base font-bold">Sou Passageiro</h2>
                <p className="text-xs text-muted-foreground">Peça corridas, acompanhe sua rota</p>
              </div>
              <span className="text-primary opacity-60 group-hover:opacity-100">→</span>
            </button>

            <button
              onClick={() => navigate("/auth/driver/login")}
              className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-background p-5 text-left transition-all hover:border-primary hover:shadow-glow"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-primary">
                <Car className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-base font-bold">Sou Motorista</h2>
                <p className="text-xs text-muted-foreground">Receba corridas e gerencie sua carteira</p>
              </div>
              <span className="text-primary opacity-60 group-hover:opacity-100">→</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="mb-3 text-center text-xs text-muted-foreground">Ainda não tem conta?</p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/auth/passenger")}
                className="flex-1 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                Cadastrar Passageiro
              </button>
              <button
                onClick={() => navigate("/auth/driver")}
                className="flex-1 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                Cadastrar Motorista
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-5">
              <img src={vamooIcon} alt="Vamoo" className="w-5 h-5" />
              <span className="font-display font-bold text-gradient-primary text-sm">Vamoo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
