import { User, Camera, FileText, Phone, Mail, Shield, ChevronRight, ArrowLeft } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import StatusBadge from "@/components/shared/StatusBadge";
import { Home, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Início", path: "/passenger" },
  { icon: Clock, label: "Corridas", path: "/passenger/history" },
  { icon: User, label: "Perfil", path: "/passenger/profile" },
];

const PassengerProfile = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-primary p-6 pb-16">
        <button onClick={() => navigate("/passenger")} className="mb-4 text-primary-foreground/80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-primary-foreground">Meu Perfil</h1>
      </div>

      <div className="relative -mt-10 px-4">
        <div className="rounded-2xl border bg-card p-5 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Maria Silva</h2>
              <p className="text-sm text-muted-foreground">CPF: ***.***.***-12</p>
              <StatusBadge status="approved" />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {[
            { icon: Phone, label: "Telefone", value: "(11) 99999-0000", verified: true },
            { icon: Mail, label: "Email", value: "maria@email.com", verified: true },
            { icon: Camera, label: "Selfie", value: "Verificada", verified: true },
            { icon: FileText, label: "CPF", value: "Validado", verified: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.value}</p>
                </div>
              </div>
              {item.verified && <Shield className="h-4 w-4 text-success" />}
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate("/")}
          className="mt-6 w-full rounded-xl border border-destructive/30 py-3 text-sm font-semibold text-destructive"
        >
          Sair da conta
        </button>
      </div>

      <BottomNav items={navItems} />
    </div>
  );
};

export default PassengerProfile;
