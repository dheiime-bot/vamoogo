/**
 * NotificationBell — sino flutuante no canto superior direito.
 * - Lista as últimas N notificações (dropdown).
 * - Badge com contador de não lidas.
 * - Realtime: novas notificações aparecem ao vivo + toast.
 * - Marca como lida ao abrir, clicar em uma item ou no botão "marcar todas".
 *
 * Funciona para passageiro e motorista — usa apenas auth.uid().
 */
import { useEffect, useMemo, useState } from "react";
import { Bell, Check, MessageCircle, Wallet, Car, Megaphone, X, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { playOfferAlert, stopOfferAlert } from "@/lib/offerSound";

interface NotificationRow {
  id: string;
  type: "chat" | "ride_status" | "low_balance" | "admin" | "system";
  title: string;
  message: string | null;
  link: string | null;
  data: any;
  is_read: boolean;
  created_at: string;
}

const iconFor = (type: NotificationRow["type"]) => {
  switch (type) {
    case "chat":
      return MessageCircle;
    case "low_balance":
      return Wallet;
    case "ride_status":
      return Car;
    case "admin":
    case "system":
    default:
      return Megaphone;
  }
};

const colorFor = (type: NotificationRow["type"]) => {
  switch (type) {
    case "chat":
      return "text-primary bg-primary/10";
    case "low_balance":
      return "text-destructive bg-destructive/10";
    case "ride_status":
      return "text-emerald-600 bg-emerald-500/10";
    case "admin":
    case "system":
    default:
      return "text-amber-600 bg-amber-500/10";
  }
};

const formatTimeAgo = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};

interface Props {
  /** Quando true, posiciona como botão fixo absoluto no topo direito. */
  floating?: boolean;
  /** Status de conexão GPS — colore o sino: verde=conectado, vermelho=desconectado, neutro=idle */
  connectionStatus?: "connected" | "disconnected" | "idle";
  /** Offset vertical extra (px) — usado para empilhar o sino abaixo de outro elemento. */
  topOffsetPx?: number;
}

const NotificationBell = ({ floating = true, connectionStatus = "idle", topOffsetPx = 0 }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = useMemo(() => items.filter((i) => !i.is_read).length, [items]);

  // Carga inicial
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setItems(data as NotificationRow[]);
        setLoading(false);
      });
  }, [user]);

  // Realtime: novas notificações
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as NotificationRow;
          setItems((prev) => [n, ...prev].slice(0, 30));
          // Notificações importantes (corrida/chat) tocam som + toast destacado
          // para garantir que o motorista/passageiro veja o aviso em qualquer tela.
          const isUrgent = n.type === "ride_status" || n.type === "chat";
          if (isUrgent) {
            // Mudança de rota = persistente (loop até o motorista interagir).
            // Outras urgências = um ciclo só.
            const isRouteChange = (n.data && (n.data as any).event === "route_changed");
            try {
              playOfferAlert({
                title: n.title,
                body: n.message || undefined,
                persistent: !!isRouteChange,
                tag: isRouteChange ? "route-changed" : "ride-urgent",
              });
            } catch {}
            toast.warning(n.title, {
              description: n.message || undefined,
              duration: isRouteChange ? 20000 : 10000,
            });
          } else {
            toast(n.title, { description: n.message || undefined });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as NotificationRow;
          setItems((prev) => prev.map((i) => (i.id === n.id ? n : i)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);
  };

  // Não marca automaticamente como lidas ao abrir — usuário pode reabrir
  // e clicar várias vezes. Marcação acontece só ao clicar em uma notificação
  // ou no botão "Marcar todas".

  const clearAll = async () => {
    if (!user || items.length === 0) return;
    setItems([]);
    await supabase.from("notifications").delete().eq("user_id", user.id);
    toast.success("Notificações limpas");
  };

  const handleClick = async (n: NotificationRow) => {
    setOpen(false);
    // Para qualquer alerta persistente (mudança de rota etc.) ao interagir.
    stopOfferAlert();
    if (!n.is_read) await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  if (!user) return null;

  return (
    <div
      className={cn(floating && "fixed right-3 z-50")}
      style={floating ? { top: `calc(env(safe-area-inset-top) + 0.75rem + ${topOffsetPx}px)` } : undefined}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Notificações"
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border transition-transform active:scale-95 hover:bg-muted"
            title={
              connectionStatus === "connected"
                ? "GPS conectado"
                : connectionStatus === "disconnected"
                  ? "GPS desconectado"
                  : "Notificações"
            }
          >
            <span className="relative flex">
              <Bell
                className={cn(
                  "h-7 w-7 transition-colors",
                  connectionStatus === "connected" && "text-success",
                  connectionStatus === "disconnected" && "text-destructive",
                  connectionStatus === "idle" && "text-foreground"
                )}
              />
              {connectionStatus === "connected" && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card animate-pulse" />
              )}
              {connectionStatus === "disconnected" && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
              )}
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-card">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[340px] p-0 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-bold">Notificações</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" /> Marcar todas
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={clearAll}
                  aria-label="Excluir todas as notificações"
                  title="Excluir todas"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">Nenhuma notificação</p>
                <p className="mt-1 text-xs text-muted-foreground">Avisos e mensagens aparecerão aqui.</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = iconFor(n.type);
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick(n);
                      }
                    }}
                    className={cn(
                      "group relative w-full flex gap-3 border-b px-4 py-3 text-left cursor-pointer transition-colors hover:bg-muted/60 last:border-b-0",
                      !n.is_read && "bg-primary/5"
                    )}
                  >
                    <div className={cn("h-9 w-9 shrink-0 rounded-full flex items-center justify-center", colorFor(n.type))}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm leading-tight", !n.is_read ? "font-semibold" : "font-medium")}>
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground mt-0.5">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      )}
                    </div>
                    {!n.is_read ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    ) : (
                      <button
                        type="button"
                        aria-label="Excluir notificação"
                        onClick={(e) => deleteNotification(e, n.id)}
                        className="shrink-0 self-start mt-0.5 rounded-full p-1 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default NotificationBell;
