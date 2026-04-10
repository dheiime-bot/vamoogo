import { useState } from "react";
import { Power, Wallet, Navigation, AlertTriangle, Clock, ChevronRight, TrendingUp, Car, MapPin, DollarSign } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import MapPlaceholder from "@/components/shared/MapPlaceholder";
import StatCard from "@/components/shared/StatCard";
import { Home, User, History } from "lucide-react";

const navItems = [
  { icon: Home, label: "Início", path: "/driver" },
  { icon: Wallet, label: "Carteira", path: "/driver/wallet" },
  { icon: History, label: "Corridas", path: "/driver/rides" },
  { icon: User, label: "Perfil", path: "/driver/profile" },
];

const DriverHome = () => {
  const [isOnline, setIsOnline] = useState(false);
  const balance = 45.5;
  const lowBalance = balance < 20;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-center justify-between bg-card border-b p-4">
        <div>
          <h1 className="text-lg font-bold">Olá, Carlos</h1>
          <p className="text-xs text-muted-foreground">Categoria: Carro</p>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${
            isOnline
              ? "bg-success text-success-foreground shadow-glow"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Power className="h-4 w-4" />
          {isOnline ? "Online" : "Offline"}
        </button>
      </div>

      {/* Balance Warning */}
      {lowBalance && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/30 p-3 animate-fade-in">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Saldo baixo!</p>
            <p className="text-xs text-muted-foreground">Recarregue para continuar aceitando corridas.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <StatCard title="Saldo" value={`R$ ${balance.toFixed(2)}`} icon={Wallet} variant={lowBalance ? "warning" : "success"} />
        <StatCard title="Ganhos hoje" value="R$ 128,50" icon={TrendingUp} trend={{ value: "+15%", positive: true }} variant="primary" />
        <StatCard title="Corridas hoje" value="8" icon={Car} />
        <StatCard title="Avaliação" value="4.92" icon={MapPin} subtitle="⭐⭐⭐⭐⭐" />
      </div>

      {/* Map */}
      <div className="px-4">
        <MapPlaceholder className="h-[200px]" />
      </div>

      {/* Incoming ride simulation */}
      {isOnline && (
        <div className="mx-4 mt-4 rounded-2xl border-2 border-primary bg-card p-4 shadow-glow animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-primary">NOVA CORRIDA</span>
            <span className="text-lg font-extrabold text-primary">R$ 18,50</span>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <p className="text-sm">Av. Paulista, 1000</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              <p className="text-sm">Rua Augusta, 500</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Navigation className="h-3.5 w-3.5" /> 3.2 km • <Clock className="h-3.5 w-3.5" /> ~12 min • 1 passageiro
          </div>
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl border border-destructive/30 py-3 text-sm font-bold text-destructive">
              Recusar
            </button>
            <button className="flex-1 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow">
              Aceitar
            </button>
          </div>
        </div>
      )}

      <BottomNav items={navItems} />
    </div>
  );
};

export default DriverHome;
