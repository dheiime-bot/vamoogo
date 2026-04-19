import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { unlockAudioOnce, playPhaseSound, requestNotificationPermission } from "@/lib/offerSound";

/**
 * Conta tickets de suporte abertos (status=open) e dispara alerta sonoro + toast
 * sempre que um novo ticket urgente (priority=urgent) é inserido.
 *
 * Uso: chamar uma vez no AdminLayout (componente sempre montado em /admin/*).
 */
export const useUrgentTicketsAlert = () => {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const [openCount, setOpenCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);

  const isAdmin = roles.includes("admin") || roles.includes("master");

  // Conta inicial e refresh em qualquer mudança
  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;

    const refresh = async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, priority")
        .eq("status", "open");
      if (cancelled) return;
      const all = data || [];
      setOpenCount(all.length);
      setUrgentCount(all.filter((t: any) => t.priority === "urgent").length);
    };

    refresh();
    unlockAudioOnce();
    requestNotificationPermission();

    const channel = supabase
      .channel("urgent-tickets-alert")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "support_tickets" },
        (payload: any) => {
          refresh();
          if (payload?.new?.priority === "urgent") {
            playPhaseSound("arrived");
            toast.error("🚨 Novo ticket urgente!", {
              description: payload.new.subject || "Verifique o suporte agora",
              duration: 10000,
              action: { label: "Abrir", onClick: () => navigate("/admin/support") },
            });
          }
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "support_tickets" },
        () => refresh()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, navigate]);

  return { openCount, urgentCount };
};
