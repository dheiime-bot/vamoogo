import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppMenu from "@/components/shared/AppMenu";
import NotificationBell from "@/components/shared/NotificationBell";
import RideChat from "@/components/passenger/RideChat";

interface ChatRow {
  ride_id: string;
  passenger_id: string;
  passenger_name: string;
  origin: string;
  destination: string;
  status: string;
  last_message: string | null;
  last_at: string | null;
  unread: number;
}

const DriverChats = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRide, setOpenRide] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: rides } = await supabase
        .from("rides")
        .select("id, passenger_id, origin_address, destination_address, status, created_at")
        .eq("driver_id", user.id)
        .in("status", ["accepted", "in_progress", "completed"])
        .order("created_at", { ascending: false })
        .limit(40);

      if (!rides?.length) { setRows([]); setLoading(false); return; }

      const passengerIds = [...new Set(rides.map((r) => r.passenger_id))];
      const rideIds = rides.map((r) => r.id);

      const [{ data: profiles }, { data: messages }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", passengerIds),
        supabase.from("chat_messages").select("ride_id, message, created_at, sender_id, is_read")
          .in("ride_id", rideIds).order("created_at", { ascending: false }),
      ]);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) ?? []);
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
          passenger_id: r.passenger_id,
          passenger_name: nameMap.get(r.passenger_id) ?? "Passageiro",
          origin: r.origin_address,
          destination: r.destination_address,
          status: r.status,
          last_message: msgMap.get(r.id)?.msg ?? null,
          last_at: msgMap.get(r.id)?.at ?? null,
          unread: msgMap.get(r.id)?.unread ?? 0,
        }))
        .filter((r) => r.last_message || r.status === "accepted" || r.status === "in_progress");

      setRows(result);
      setLoading(false);
    };
    load();
  }, [user]);

  if (openRide) {
    return <RideChat rideId={openRide.id} driverName={openRide.name} onBack={() => setOpenRide(null)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppMenu role="driver" />
      <NotificationBell />
      <header className="border-b bg-card px-4 py-4 pl-16">
        <h1 className="text-lg font-bold">Chats</h1>
        <p className="text-xs text-muted-foreground">Suas conversas com passageiros</p>
      </header>

      <div className="p-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={r.ride_id}
                onClick={() => setOpenRide({ id: r.ride_id, name: r.passenger_name })}
                className="w-full flex items-center gap-3 rounded-2xl bg-card border p-3 hover:bg-muted transition-colors text-left"
              >
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {r.passenger_name[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{r.passenger_name}</p>
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
    </div>
  );
};

export default DriverChats;
