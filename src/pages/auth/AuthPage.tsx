import VamooLogo from "@/components/shared/VamooLogo";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, User } from "lucide-react";
import vamooIcon from "@/assets/vamoo-icon.png";

const AuthPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-gradient-primary p-6 pb-12">
        <button onClick={() => navigate("/")} className="mb-4 text-primary-foreground/80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <VamooLogo height={109} className="mb-3" />
          <p className="mt-1 text-sm text-primary-foreground/80">Como você quer entrar?</p>
        </div>
      </div>

      <div className="relative -mt-6 flex-1 rounded-t-3xl p-6" style={{ backgroundColor: "#f5fbfb" }}>
        <p className="mb-6 text-center text-xs text-muted-foreground">
          Escolha o app que você usa. Cada perfil tem seu próprio acesso.
        </p>

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

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-2 text-center">
          <p className="text-xs text-muted-foreground">Ainda não tem conta?</p>
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
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
