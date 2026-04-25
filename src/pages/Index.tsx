import { FormEvent, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Car,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Globe2,
  Headphones,
  LineChart,
  Lock,
  Map,
  MapPin,
  MessageCircle,
  Phone,
  Radio,
  Rocket,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import vamooLogo from "@/assets/vamoo-logo.png";
import productPassenger from "@/assets/vamoo-product-passenger.png";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_NUMBER = "5593991622328";
const CONTACT_EMAIL = "contato@vamoo.app";
const whatsappMessage = "Quero levar o Vamoo para minha cidade";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100, "Nome muito longo"),
  whatsapp: z.string().trim().transform((value) => value.replace(/[^0-9+]/g, "")).pipe(
    z.string().regex(/^\+?[0-9]{10,15}$/, "Informe um WhatsApp válido com DDD")
  ),
  city: z.string().trim().min(2, "Informe a cidade").max(100, "Cidade muito longa"),
  state: z.string().trim().min(2, "Informe o estado").max(50, "Estado muito longo"),
  has_drivers: z.enum(["sim", "nao"]),
  driver_count: z.coerce.number().int().min(0).max(100000).optional().or(z.literal("")),
  message: z.string().trim().max(1000, "Mensagem muito longa").optional(),
});

type LeadForm = Omit<z.input<typeof leadSchema>, "driver_count"> & { driver_count: string };

const openWhatsApp = (message = whatsappMessage) => {
  const encoded = encodeURIComponent(message.slice(0, 500));
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`, "_blank", "noopener,noreferrer");
};

const navItems = ["Produto", "Operação", "Como funciona", "FAQ"];

const productProof = [
  { title: "Passageiro", desc: "Solicitação de corrida com mapa, rota e pagamento", icon: Smartphone },
  { title: "Motorista", desc: "Oferta em tempo real, aceite e fases da corrida", icon: Car },
  { title: "Mapa ao vivo", desc: "Posição e deslocamento atualizados em tempo real", icon: Map },
  { title: "Financeiro", desc: "Saldo, repasses, taxas e bloqueio operacional", icon: WalletCards },
  { title: "Admin", desc: "Gestão completa de motoristas, passageiros e cidades", icon: Gauge },
];

const audiences = [
  { title: "Empreendedores locais", icon: Rocket },
  { title: "Cooperativas de motoristas", icon: Users },
  { title: "Rádio táxi", icon: Radio },
  { title: "Empresas de transporte", icon: Building2 },
  { title: "Investidores regionais", icon: LineChart },
];

const features = [
  ["App do passageiro", Smartphone],
  ["App do motorista", Car],
  ["Painel administrativo completo", ClipboardList],
  ["Sistema financeiro integrado", CircleDollarSign],
  ["Controle de tarifas", Settings2],
  ["Corridas em tempo real", Zap],
  ["Chat motorista/passageiro", MessageCircle],
  ["Avaliações", Sparkles],
  ["Multi-cidade", Globe2],
  ["Relatórios", BarChart3],
] as const;

const controlItems = [
  "define preço por km",
  "define taxa da plataforma",
  "controla saldo dos motoristas",
  "bloqueia por saldo negativo",
  "gerencia sua cidade",
];

const steps = [
  "Você solicita implantação",
  "Configuramos sua cidade",
  "Você cadastra motoristas",
  "Passageiros começam a usar",
  "Você acompanha tudo no painel",
];

const trust = [
  { title: "Segurança", desc: "Controles de acesso, perfis verificados e operação protegida.", icon: ShieldCheck },
  { title: "Estabilidade", desc: "Arquitetura preparada para uso contínuo da operação.", icon: Gauge },
  { title: "Tempo real", desc: "Corridas, chats, status e painel sempre sincronizados.", icon: Zap },
  { title: "Controle total", desc: "Tarifas, financeiro, bloqueios e regras sob sua gestão.", icon: Lock },
  { title: "Suporte", desc: "Implantação assistida e evolução contínua da plataforma.", icon: Headphones },
];

const faqs = [
  ["Posso usar minha marca?", "Sim. O Vamoo é white-label e pode operar com identidade local conforme o projeto."],
  ["Funciona em qualquer cidade?", "Sim. A plataforma é pensada para cidades pequenas, médias e operações regionais."],
  ["Tem painel administrativo?", "Sim. Você gerencia corridas, motoristas, passageiros, tarifas, financeiro e relatórios."],
  ["Posso configurar tarifas?", "Sim. É possível configurar preço por km, taxas, categorias e regras por cidade."],
  ["Como funciona o financeiro?", "A plataforma possui saldo do motorista, taxas, repasses, bloqueios e acompanhamento administrativo."],
  ["Preciso ter motoristas antes?", "Não obrigatoriamente, mas ter uma base inicial acelera o lançamento da operação."],
  ["Como é o suporte?", "A implantação é assistida, com acompanhamento para configurar cidade, operação e primeiros usuários."],
];

const HeroMockups = () => (
  <div className="relative mx-auto h-[560px] max-w-[620px] animate-fade-in lg:h-[640px]" aria-label="Mockups do produto Vamoo">
    <div className="absolute left-4 top-10 w-[250px] overflow-hidden rounded-[2rem] border border-border bg-card p-2 shadow-lg sm:left-16 sm:w-[285px]">
      <div className="overflow-hidden rounded-[1.55rem] bg-muted">
        <img src={productPassenger} alt="App do passageiro Vamoo com mapa em tempo real" className="h-[430px] w-full object-cover object-top sm:h-[500px]" loading="eager" />
      </div>
    </div>

    <div className="absolute right-1 top-0 w-[238px] rounded-[1.65rem] border border-border bg-card p-4 shadow-lg sm:right-10 sm:w-[275px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-muted-foreground">MOTORISTA</p>
          <p className="font-display text-lg font-black">Nova corrida</p>
        </div>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-black text-accent">15s</span>
      </div>
      <div className="space-y-3 rounded-2xl bg-muted/60 p-4">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-accent" />
          <div>
            <p className="text-[11px] text-muted-foreground">Origem</p>
            <p className="text-sm font-bold">Centro • 1,8 km</p>
          </div>
        </div>
        <div className="h-8 border-l border-dashed border-border ml-2" />
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-[11px] text-muted-foreground">Destino</p>
            <p className="text-sm font-bold">Bairro Industrial</p>
          </div>
        </div>
      </div>
      <button className="mt-4 w-full rounded-2xl bg-gradient-primary py-3 text-sm font-black text-primary-foreground shadow-glow">Aceitar corrida</button>
    </div>

    <div className="absolute bottom-8 right-0 w-[315px] rounded-[1.7rem] border border-border bg-card p-5 shadow-lg sm:right-5 sm:w-[390px]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-muted-foreground">DASHBOARD FINANCEIRO</p>
          <p className="font-display text-2xl font-black">R$ 48.720</p>
        </div>
        <BarChart3 className="h-8 w-8 text-primary" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[68, 42, 86, 55, 92, 74].map((height, index) => (
          <div key={index} className="flex h-24 items-end rounded-xl bg-muted/50 p-2">
            <div className="w-full rounded-lg bg-gradient-primary" style={{ height: `${height}%` }} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SectionTitle = ({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) => (
  <div className="mx-auto mb-10 max-w-3xl text-center">
    <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
    <h2 className="font-display text-3xl font-black leading-tight text-foreground sm:text-5xl">{title}</h2>
    {desc && <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{desc}</p>}
  </div>
);

const Index = () => {
  const [form, setForm] = useState<LeadForm>({ name: "", whatsapp: "", city: "", state: "", has_drivers: "sim", driver_count: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const whatsappHref = useMemo(() => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`, []);

  const scrollToLead = () => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = leadSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Revise os dados do formulário");
      return;
    }

    setSubmitting(true);
    const payload = {
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      city: parsed.data.city,
      state: parsed.data.state,
      has_drivers: parsed.data.has_drivers === "sim",
      driver_count: parsed.data.driver_count === "" ? null : Number(parsed.data.driver_count ?? 0),
      message: parsed.data.message || null,
      source: "site",
      status: "new",
    };

    const { error } = await supabase.from("site_leads" as any).insert(payload as any);
    setSubmitting(false);

    if (error) {
      toast.error("Não foi possível enviar. Tente pelo WhatsApp.");
      return;
    }

    toast.success("Recebemos seu interesse. Vamos falar com você em breve.");
    setForm({ name: "", whatsapp: "", city: "", state: "", has_drivers: "sim", driver_count: "", message: "" });
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Vamoo SaaS">
            <img src={vamooLogo} alt="Vamoo" className="h-9 w-auto" />
            <span className="hidden rounded-full border border-border px-3 py-1 text-xs font-black text-muted-foreground sm:inline-flex">SaaS de mobilidade</span>
          </a>
          <div className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`} className="text-sm font-bold text-muted-foreground transition-colors hover:text-primary">{item}</a>)}
          </div>
          <button onClick={scrollToLead} className="rounded-full bg-gradient-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-glow transition-transform hover:scale-105 sm:px-5">
            Solicitar proposta
          </button>
        </nav>
      </header>

      <section id="top" className="relative pt-24 sm:pt-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.14),transparent_30%),radial-gradient(circle_at_80%_15%,hsl(var(--accent)/0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.45))]" />
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-4 pb-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="animate-slide-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-primary shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Plataforma white-label para operar mobilidade
            </div>
            <h1 className="font-display text-4xl font-black leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Tenha seu próprio app de transporte na sua cidade
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Plataforma completa com app de passageiro, app de motorista, painel administrativo e financeiro pronto para operar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={scrollToLead} className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-6 py-4 text-base font-black text-primary-foreground shadow-glow transition-all hover:-translate-y-0.5 hover:shadow-lg">
                Quero levar para minha cidade <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={() => openWhatsApp()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-4 text-base font-black text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40">
                <MessageCircle className="h-5 w-5 text-accent" /> Falar no WhatsApp
              </button>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 text-center sm:max-w-xl">
              {["Passageiro", "Motorista", "Admin"].map((item) => <div key={item} className="rounded-2xl border border-border bg-card/80 p-3 shadow-sm"><p className="text-sm font-black">{item}</p><p className="text-[11px] text-muted-foreground">pronto</p></div>)}
            </div>
          </div>
          <HeroMockups />
        </div>
      </section>

      <section id="produto" className="px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Prova de produto" title="Produto real, funcionando e pronto para sua cidade" desc="A operação já nasce com app do passageiro, app do motorista, mapa em tempo real, financeiro e painel administrativo integrados." />
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-5">
          {productProof.map((item, index) => (
            <article key={item.title} className="group rounded-3xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"><item.icon className="h-6 w-6" /></div>
              <p className="font-display text-lg font-black">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
              <div className="mt-5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-primary" style={{ width: `${50 + index * 10}%` }} /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-muted/45 px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Para quem é" title="Feito para quem quer liderar mobilidade local" />
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map((item) => <div key={item.title} className="rounded-3xl border border-border bg-card p-5 shadow-sm"><item.icon className="mb-5 h-8 w-8 text-primary" /><p className="font-display text-lg font-black leading-tight">{item.title}</p></div>)}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="O que você recebe" title="Uma operação completa em uma única plataforma" />
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {features.map(([label, Icon]) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><Icon className="h-5 w-5 shrink-0 text-primary" /><span className="text-sm font-black">{label}</span></div>)}
        </div>
      </section>

      <section id="operação" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-border bg-gradient-dark shadow-lg lg:grid-cols-[0.9fr_1.1fr]">
          <div className="p-8 text-primary-foreground sm:p-12">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-accent">Diferencial forte</p>
            <h2 className="font-display text-4xl font-black leading-tight sm:text-6xl">Você controla tudo</h2>
            <p className="mt-5 text-lg leading-8 text-primary-foreground/75">O Vamoo entrega o produto; você define a regra de negócio da sua operação local.</p>
          </div>
          <div className="grid gap-3 bg-card/5 p-6 sm:grid-cols-2 sm:p-8">
            {controlItems.map((item) => <div key={item} className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/10 p-5 text-primary-foreground backdrop-blur"><CheckCircle2 className="mb-4 h-6 w-6 text-accent" /><p className="font-black">{item}</p></div>)}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-muted/45 px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Como funciona" title="Da implantação ao painel em cinco etapas" />
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-5">
          {steps.map((step, index) => <div key={step} className="rounded-3xl border border-border bg-card p-5 shadow-sm"><span className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary font-black text-primary-foreground">{index + 1}</span><p className="font-display text-lg font-black leading-tight">{step}</p></div>)}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-primary">Multi-cidade</p>
            <h2 className="font-display text-4xl font-black leading-tight sm:text-6xl">Escale para várias cidades</h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">Cada cidade pode ter suas próprias regras, admin regional, tarifas independentes e operação separada sem perder visão de gestão.</p>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-lg">
            {['Cidade A • tarifa própria', 'Cidade B • admin regional', 'Cidade C • operação separada'].map((item) => <div key={item} className="mb-3 flex items-center justify-between rounded-2xl bg-muted/60 p-4 last:mb-0"><span className="font-black">{item}</span><Globe2 className="h-5 w-5 text-accent" /></div>)}
          </div>
        </div>
      </section>

      <section id="lead-form" className="bg-gradient-dark px-4 py-20 text-primary-foreground sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-accent">Conversão</p>
            <h2 className="font-display text-4xl font-black leading-tight sm:text-6xl">Quer o Vamoo na sua cidade?</h2>
            <p className="mt-5 text-lg leading-8 text-primary-foreground/75">Preencha os dados e receba uma conversa direcionada para implantação, operação e modelo comercial.</p>
            <div className="mt-8 rounded-3xl border border-primary-foreground/10 bg-primary-foreground/10 p-5"><p className="font-display text-2xl font-black">Você não está comprando um app.</p><p className="mt-2 text-primary-foreground/75">Está adquirindo uma plataforma completa para operar mobilidade na sua cidade.</p></div>
          </div>
          <form onSubmit={submitLead} className="rounded-[2rem] border border-primary-foreground/10 bg-card p-5 text-foreground shadow-lg sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" maxLength={100} className="rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
              <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="WhatsApp com DDD" maxLength={20} className="rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Cidade" maxLength={100} className="rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Estado" maxLength={50} className="rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
              <select value={form.has_drivers} onChange={(e) => setForm({ ...form, has_drivers: e.target.value as "sim" | "nao" })} className="rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary">
                <option value="sim">Já possui motoristas? Sim</option>
                <option value="nao">Já possui motoristas? Não</option>
              </select>
              <input value={form.driver_count} onChange={(e) => setForm({ ...form, driver_count: e.target.value })} placeholder="Qtd. aproximada de motoristas" inputMode="numeric" maxLength={6} className="rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Mensagem" maxLength={1000} rows={4} className="mt-4 w-full rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
            <button disabled={submitting} className="mt-5 w-full rounded-2xl bg-gradient-primary px-6 py-4 text-base font-black text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60">
              {submitting ? "Enviando..." : "Quero lançar na minha cidade"}
            </button>
          </form>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Modelo de negócio" title="Plataforma pronta para operação" desc="Implantação assistida, suporte e evolução contínua para transformar demanda local em operação profissional." />
        <div className="text-center"><button onClick={scrollToLead} className="rounded-2xl bg-gradient-primary px-7 py-4 font-black text-primary-foreground shadow-glow">Solicitar proposta</button></div>
      </section>

      <section className="bg-muted/45 px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Confiança" title="Tecnologia, controle e suporte para operar com segurança" />
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {trust.map((item) => <div key={item.title} className="rounded-3xl border border-border bg-card p-5 shadow-sm"><item.icon className="mb-5 h-8 w-8 text-primary" /><p className="font-display text-lg font-black">{item.title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p></div>)}
        </div>
      </section>

      <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="FAQ" title="Perguntas frequentes" />
        <div className="mx-auto max-w-4xl space-y-3">
          {faqs.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-border bg-card p-5 shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-black">{question}<ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" /></summary><p className="mt-3 leading-7 text-muted-foreground">{answer}</p></details>)}
        </div>
      </section>

      <footer className="border-t border-border px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div><img src={vamooLogo} alt="Vamoo" className="h-10 w-auto" /><p className="mt-3 max-w-lg text-sm text-muted-foreground">SaaS white-label para empreendedores operarem mobilidade urbana em suas cidades.</p></div>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-muted-foreground">
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="hover:text-primary">WhatsApp</a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-primary">E-mail</a>
            <a href="#" className="hover:text-primary">Política de privacidade</a>
            <a href="#" className="hover:text-primary">Termos de uso</a>
          </div>
        </div>
      </footer>

      <button onClick={() => openWhatsApp()} className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-black text-accent-foreground shadow-lg transition-transform hover:scale-105">
        <Phone className="h-4 w-4" /> Falar agora no WhatsApp
      </button>
    </main>
  );
};

export default Index;
