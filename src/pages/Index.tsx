import { useNavigate } from "react-router-dom";
import { MapPin, Shield, Zap, Users, Car, Bike, Crown, ArrowRight, CheckCircle2 } from "lucide-react";
import vamooLogo from "@/assets/vamoo-logo.png";
import vamooIcon from "@/assets/vamoo-icon.png";

const features = [
  { icon: Shield, title: "Segurança Total", desc: "Verificação de identidade, selfie facial e validação de documentos para todos os usuários." },
  { icon: Zap, title: "Rapidez", desc: "Algoritmo inteligente conecta você ao motorista mais próximo em segundos." },
  { icon: MapPin, title: "Cidades Brasileiras", desc: "Feito para cidades pequenas e médias, com tarifas justas e regionais." },
  { icon: Users, title: "Comunidade", desc: "Modelo pré-pago que garante transparência para motoristas e passageiros." },
];

const categories = [
  { icon: Bike, label: "Moto", desc: "Rápido e econômico", color: "from-primary to-accent" },
  { icon: Car, label: "Carro", desc: "Conforto e praticidade", color: "from-primary to-info" },
  { icon: Crown, label: "Premium", desc: "Experiência exclusiva", color: "from-accent to-warning" },
];

const steps = [
  { n: "1", title: "Cadastre-se", desc: "Crie sua conta com CPF e selfie em menos de 2 minutos." },
  { n: "2", title: "Solicite", desc: "Escolha origem, destino e categoria do veículo." },
  { n: "3", title: "Viaje", desc: "Acompanhe em tempo real e avalie ao final." },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-[90vh] px-4 text-center">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-2xl mx-auto">
          <div className="animate-float">
            <img src={vamooLogo} alt="Vamoo" width={280} height={280} className="w-56 sm:w-72 h-auto drop-shadow-lg" />
          </div>

          <p className="text-lg sm:text-xl font-display font-bold text-gradient-primary animate-fade-in">
            Chamou, Vamoo!
          </p>

          <p className="text-muted-foreground text-sm sm:text-base max-w-md animate-slide-up">
            Seja dono do app de mobilidade urbana na sua cidade!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-transform flex items-center gap-2"
            >
              Quero viajar <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-3 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted transition-colors flex items-center gap-2"
            >
              Sou motorista <Car className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-2.5 rounded-full bg-muted-foreground/40" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-center mb-10">
            Escolha seu <span className="text-gradient-primary">estilo</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {categories.map((cat, i) => (
              <div
                key={cat.label}
                className="group relative overflow-hidden rounded-2xl p-6 bg-card border border-border hover:shadow-lg hover:scale-105 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${cat.color} mb-4`}>
                  <cat.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold font-display">{cat.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-center mb-10">
            Por que o <span className="text-gradient-primary">Vamoo</span>?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="flex gap-4 p-5 rounded-2xl bg-card border border-border animate-slide-up"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold font-display">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-center mb-10">
            Como <span className="text-gradient-primary">funciona</span>
          </h2>
          <div className="flex flex-col gap-6">
            {steps.map((step, i) => (
              <div
                key={step.n}
                className="flex items-start gap-4 animate-slide-up"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold font-display">
                  {step.n}
                </div>
                <div>
                  <h3 className="font-bold font-display text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-lg mx-auto text-center bg-gradient-primary rounded-3xl p-10 shadow-glow">
          <img src={vamooIcon} alt="Vamoo" width={64} height={64} className="w-16 h-16 mx-auto mb-4" loading="lazy" />
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-primary-foreground mb-2">
            Chamou, Vamoo!
          </h2>
          <p className="text-primary-foreground/80 text-sm mb-6">
            Comece a viajar com segurança e praticidade agora mesmo.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="px-8 py-3 rounded-xl bg-card text-foreground font-semibold hover:scale-105 transition-transform"
          >
            Criar minha conta
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src={vamooIcon} alt="Vamoo" width={24} height={24} className="w-6 h-6" loading="lazy" />
          <span className="font-display font-bold text-gradient-primary">Vamoo</span>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Vamoo. Transporte urbano inteligente para o Brasil.</p>
      </footer>
    </div>
  );
};

export default Index;
