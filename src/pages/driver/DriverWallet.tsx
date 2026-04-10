import { Wallet, CreditCard, QrCode, Plus, ArrowDownLeft, ArrowUpRight, Gift, History, Home, User } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import StatCard from "@/components/shared/StatCard";

const navItems = [
  { icon: Home, label: "Início", path: "/driver" },
  { icon: Wallet, label: "Carteira", path: "/driver/wallet" },
  { icon: History, label: "Corridas", path: "/driver/rides" },
  { icon: User, label: "Perfil", path: "/driver/profile" },
];

const transactions = [
  { id: 1, type: "credit", label: "Recarga PIX", amount: "+R$ 50,00", date: "10/04, 09:00", icon: ArrowDownLeft },
  { id: 2, type: "debit", label: "Taxa corrida #1042", amount: "-R$ 2,78", date: "10/04, 14:35", icon: ArrowUpRight },
  { id: 3, type: "debit", label: "Taxa corrida #1041", amount: "-R$ 1,85", date: "10/04, 13:20", icon: ArrowUpRight },
  { id: 4, type: "credit", label: "Bônus recarga", amount: "+R$ 5,00", date: "09/04, 10:00", icon: Gift },
  { id: 5, type: "credit", label: "Recarga Cartão", amount: "+R$ 100,00", date: "09/04, 10:00", icon: ArrowDownLeft },
];

const DriverWallet = () => (
  <div className="min-h-screen bg-background pb-20">
    <div className="bg-gradient-primary p-6 pb-10">
      <h1 className="text-lg font-bold text-primary-foreground mb-1">Carteira</h1>
      <p className="text-3xl font-extrabold text-primary-foreground">R$ 45,50</p>
      <p className="text-sm text-primary-foreground/70">Saldo disponível</p>
    </div>

    <div className="relative -mt-4 px-4">
      {/* Recharge buttons */}
      <div className="flex gap-3 mb-5">
        <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card border py-3 shadow-sm text-sm font-semibold">
          <QrCode className="h-4 w-4 text-primary" /> PIX
        </button>
        <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card border py-3 shadow-sm text-sm font-semibold">
          <CreditCard className="h-4 w-4 text-primary" /> Cartão
        </button>
      </div>

      {/* Quick recharge */}
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recarga rápida</h3>
        <div className="grid grid-cols-4 gap-2">
          {["R$ 20", "R$ 50", "R$ 100", "R$ 200"].map((val) => (
            <button key={val} className="rounded-xl border bg-card py-2.5 text-sm font-bold hover:border-primary hover:bg-primary/5 transition-colors">
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard title="Taxa atual" value="15%" icon={Wallet} variant="primary" subtitle="Categoria: Carro" />
        <StatCard title="Gasto em taxas" value="R$ 42,30" icon={ArrowUpRight} subtitle="Este mês" />
      </div>

      {/* Transactions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Histórico</h3>
        <div className="space-y-2">
          {transactions.map((tx, i) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 animate-slide-up"
              style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
            >
              <div className={`rounded-lg p-2 ${tx.type === "credit" ? "bg-success/10" : "bg-destructive/10"}`}>
                <tx.icon className={`h-4 w-4 ${tx.type === "credit" ? "text-success" : "text-destructive"}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{tx.label}</p>
                <p className="text-xs text-muted-foreground">{tx.date}</p>
              </div>
              <p className={`text-sm font-bold ${tx.type === "credit" ? "text-success" : "text-destructive"}`}>
                {tx.amount}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>

    <BottomNav items={navItems} />
  </div>
);

export default DriverWallet;
