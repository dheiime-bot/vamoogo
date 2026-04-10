import { Car, User, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const roles = [
  {
    id: "passenger",
    title: "Passageiro",
    description: "Solicite corridas com segurança e praticidade",
    icon: User,
    path: "/passenger",
    gradient: "bg-gradient-primary",
  },
  {
    id: "driver",
    title: "Motorista",
    description: "Dirija e ganhe com o modelo pré-pago",
    icon: Car,
    path: "/driver",
    gradient: "bg-gradient-accent",
  },
  {
    id: "admin",
    title: "Administrador",
    description: "Gerencie toda a plataforma",
    icon: Shield,
    path: "/admin",
    gradient: "bg-gradient-dark",
  },
];

const RoleSelector = () => {
  const navigate = useNavigate();

  return (
    <div className="grid gap-4 sm:grid-cols-3 w-full max-w-3xl mx-auto px-4">
      {roles.map((role, i) => (
        <button
          key={role.id}
          onClick={() => navigate(role.path)}
          className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-lg animate-slide-up"
          style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
        >
          <div className={`absolute inset-0 ${role.gradient} opacity-90`} />
          <div className="relative z-10 flex flex-col items-start gap-3">
            <div className="rounded-xl bg-primary-foreground/20 p-3">
              <role.icon className="h-7 w-7 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-bold text-primary-foreground">{role.title}</h3>
            <p className="text-sm text-primary-foreground/80">{role.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
};

export default RoleSelector;
