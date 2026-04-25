import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppMenu from "@/components/shared/AppMenu";
import HomeFab from "@/components/passageiro/HomeFab";
import UserAvatar from "@/components/shared/UserAvatar";

import RideChat from "@/components/passageiro/RideChat";
import CentralChat from "@/components/shared/CentralChat";
import { Headset } from "lucide-react";

interface ChatRow {
  ride_id: string;
  driver_id: string | null;
  driver_name: string;
  origin: string;
  destination: string;
  status: string;
  last_message: string | null;
  last_at: string | null;
  unread: number;
  photo: string | null;
}

const PassengerChats = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRide, setOpenRide] = useState<{ id: string; name: string; photo: string | null } | null>(null);
  const [openCentral, setOpenCentral] = useState(false);
  const [centralUnread, setCentralUnread] = useState(0);

  // Auto-abrir Chat com a Central quando vier de /passenger/chats?central=1
  useEffect(() => {
    if (searchParams.get("central") === "1") {
      setOpenCentral(true);
      const next = new URLSearchParams(searchParams);
      next.delete("central");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadCentralUnread = async () => {
    if (!user) return;
    const { data: tickets } = await supabase.from("support_tickets").select("id").eq("user_id", user.id);
    const ids = (tickets || []).map((t: any) => t.id);
    if (!ids.length) { setCentralUnread(0); return; }
    const { count } = await supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .in("ticket_id", ids)
      .eq("sender_role", "admin")
      .eq("is_read_by_user", false);
    setCentralUnread(count || 0);
  };

  useEffect(() => {
    loadCentralUnread();
    if (!user) return;
    const ch = supabase
      .channel(`pchat-central-unread-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, loadCentralUnread)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: rides } = await supabase
        .from("rides")
        .select("id, driver_id, origin_address, destination_address, status, created_at")
        .eq("passenger_id", user.id)
        .not("driver_id", "is", null)
        .in("status", ["accepted", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(40);

      if (!rides?.length) { setRows([]); setLoading(false); return; }

      const driverIds = [...new Set(rides.map((r) => r.driver_id).filter(Boolean) as string[])];
      const rideIds = rides.map((r) => r.id);

      const [{ data: profiles }, { data: messages }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, selfie_url, selfie_signup_url").in("user_id", driverIds),
        supabase.from("chat_messages").select("ride_id, message, created_at, sender_id, is_read")
          .in("ride_id", rideIds).order("created_at", { ascending: false }),
      ]);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      const msgMap = new Map<string, { msg: string; at: string; unread: number }>();
      messages?.forEach((m) => {
        const cur = msgMap.get(m.ride_id);
        const isUnread = !m.is_read && m.sender_id !== user.id;
        if (!cur) {
          msgMap.set(m.ride_id, { msg: m.message, at: m.created_at, unread: isUnread ? 1 : 0 });
        } else if (isUnread) {
          cur.unread += 1;
        }
      });

      const result: ChatRow[] = rides
        .map((r) => ({
          ride_id: r.id,
          driver_id: r.driver_id,
          driver_name: profileMap.get(r.driver_id!)?.full_name ?? "Motorista",
          origin: r.origin_address,
          destination: r.destination_address,
          status: r.status,
          last_message: msgMap.get(r.id)?.msg ?? null,
          last_at: msgMap.get(r.id)?.at ?? null,
          unread: msgMap.get(r.id)?.unread ?? 0,
          photo: profileMap.get(r.driver_id!)?.selfie_url || profileMap.get(r.driver_id!)?.selfie_signup_url || null,
        }))
        .filter((r) => r.last_message || r.status === "accepted" || r.status === "in_progress");

      setRows(result);
      setLoading(false);
    };
    load();
  }, [user]);

  if (openRide) {
    return <RideChat rideId={openRide.id} driverName={openRide.name} participantPhoto={openRide.photo} participantRole="driver" onBack={() => setOpenRide(null)} />;
  }
  if (openCentral) {
    return <CentralChat onBack={() => { setOpenCentral(false); loadCentralUnread(); }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppMenu role="passenger" />
      
      <header className="border-b bg-card px-4 pt-20 pb-4">
        <h1 className="text-lg font-bold">Chats</h1>
        <p className="text-xs text-muted-foreground">Suas conversas com motoristas</p>
      </header>

      <div className="p-4 space-y-2">
        {/* Chat com a Central — sempre no topo */}
        <button
          onClick={() => setOpenCentral(true)}
          className="w-full flex items-center gap-3 rounded-2xl bg-card border-2 border-primary/30 p-3 hover:bg-primary/5 transition-colors text-left"
        >
          <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Headset className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Chat com a Central</p>
            <p className="text-xs text-muted-foreground truncate">Suporte e atendimento Vamoo</p>
          </div>
          {centralUnread > 0 && (
            <span className="h-6 min-w-6 px-2 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center shrink-0">
              {centralUnread}
            </span>
          )}
        </button>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa de corrida ativa</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={r.ride_id}
                onClick={() => setOpenRide({ id: r.ride_id, name: r.driver_name, photo: r.photo })}
                className="w-full flex items-center gap-3 rounded-2xl bg-card border p-3 hover:bg-muted transition-colors text-left"
              >
                <UserAvatar src={r.photo} name={r.driver_name} role="driver" size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{r.driver_name}</p>
                    {r.last_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(r.last_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.last_message || `Corrida para ${r.destination}`}
                  </p>
                </div>
                {r.unread > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {r.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <HomeFab />
    </div>
  );
};

export default PassengerChats;
