import { useEffect, useState } from "react";
import { ArrowLeft, TicketPercent, Copy, Loader2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import HomeFab from "@/components/passenger/HomeFab";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_fare: number | null;
  expires_at: string | null;
  used_at: string | null;
  message: string | null;
  created_at: string;
  active: boolean;
}

const formatDiscount = (c: Coupon) =>
  c.discount_type === "percentage"
    ? `${Number(c.discount_value).toFixed(0)}% OFF`
    : `R$ ${Number(c.discount_value).toFixed(2)} OFF`;

const isExpired = (c: Coupon) =>
  !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();

const PassengerCoupons = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const load = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("passenger_coupons")
      .select("*")
      .eq("passenger_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar cupons");
    setCoupons((data as Coupon[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useRealtimeRefresh("passenger_coupons", load, "passenger-coupons");

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Código ${code} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const available = coupons.filter((c) => !c.used_at && !isExpired(c));
  const history = coupons.filter((c) => c.used_at || isExpired(c));

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate("/passenger")}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-display font-bold">Meus cupons</h1>
      </header>

      <div className="px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Disponíveis
              </h2>
              {available.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <TicketPercent className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Você ainda não tem cupons. Quando o time enviar um, ele aparece aqui.
                  </p>
                </div>
              ) : (
                available.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                          {formatDiscount(c)}
                        </p>
                        <p className="mt-1 font-mono text-lg font-bold tracking-wide">
                          {c.code}
                        </p>
                        {c.message && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {c.message}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {c.min_fare && Number(c.min_fare) > 0 ? (
                            <span>Mín. R$ {Number(c.min_fare).toFixed(2)}</span>
                          ) : null}
                          {c.expires_at && (
                            <span>
                              Expira em{" "}
                              {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => copyCode(c.code)}
                        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm flex items-center gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>

            {history.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Histórico
                </h2>
                {history.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-2xl border border-border bg-muted/40 p-4 opacity-75"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {formatDiscount(c)}
                        </p>
                        <p className="mt-1 font-mono text-base font-bold line-through">
                          {c.code}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                        {c.used_at ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Usado
                          </>
                        ) : (
                          "Expirado"
                        )}
                      </span>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
      <HomeFab />
    </div>
  );
};

export default PassengerCoupons;