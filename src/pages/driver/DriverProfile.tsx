import { User, Camera, FileText, Phone, Car as CarIcon, Shield, Star, ArrowLeft, Wallet, Home, History } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import StatusBadge from "@/components/shared/StatusBadge";
import { useNavigate } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Início", path: "/driver" },
  { icon: Wallet, label: "Carteira", path: "/driver/wallet" },
  { icon: History, label: "Corridas", path: "/driver/rides" },
  { icon: User, label: "Perfil", path: "/driver/profile" },
];

const DriverProfile = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-dark p-6 pb-16">
        <button onClick={() => navigate("/driver")} className="mb-4 text-primary-foreground/80"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold text-primary-foreground">Meu Perfil</h1>
      </div>

      <div className="relative -mt-10 px-4">
        <div className="rounded-2xl border bg-card p-5 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Carlos Mendes</h2>
              <p className="text-sm text-muted-foreground">Motorista • Carro</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status="approved" />
                <span className="flex items-center gap-0.5 text-xs"><Star className="h-3 w-3 text-warning" /> 4.92</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "Corridas", value: "342" },
            { label: "Avaliação", value: "4.92" },
            { label: "Cancelamentos", value: "0/3" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Documents */}
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Documentos & Verificações</h3>
          {[
            { icon: FileText, label: "CPF", value: "***.***.***-12", verified: true },
            { icon: CarIcon, label: "CNH (EAR)", value: "Verificada", verified: true },
            { icon: Camera, label: "Selfie facial", value: "Verificada", verified: true },
            { icon: Camera, label: "Foto CNH (frente)", value: "Enviada", verified: true },
            { icon: Camera, label: "Foto CNH (verso)", value: "Enviada", verified: true },
            { icon: Phone, label: "Telefone", value: "(11) 99999-1234", verified: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2"><item.icon className="h-4 w-4 text-muted-foreground" /></div>
                <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.value}</p></div>
              </div>
              {item.verified && <Shield className="h-4 w-4 text-success" />}
            </div>
          ))}
        </div>

        {/* Vehicle */}
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Veículo</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Modelo", value: "Toyota Corolla 2022" },
              { label: "Cor", value: "Prata" },
              { label: "Placa", value: "ABC-1D23" },
              { label: "Categoria", value: "Carro" },
            ].map((v) => (
              <div key={v.label}><p className="text-xs text-muted-foreground">{v.label}</p><p className="text-sm font-medium">{v.value}</p></div>
            ))}
          </div>
        </div>

        <button onClick={() => navigate("/")} className="mt-6 w-full rounded-xl border border-destructive/30 py-3 text-sm font-semibold text-destructive">
          Sair da conta
        </button>
      </div>

      <BottomNav items={navItems} />
    </div>
  );
};

export default DriverProfile;
