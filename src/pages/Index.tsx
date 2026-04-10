import RoleSelector from "@/components/landing/RoleSelector";
import { Car } from "lucide-react";

const Index = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
    <div className="mb-12 text-center animate-fade-in">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
        <Car className="h-10 w-10 text-primary-foreground" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        <span className="text-gradient-primary">UrbanGo</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Transporte urbano inteligente</p>
    </div>
    <RoleSelector />
  </div>
);

export default Index;
