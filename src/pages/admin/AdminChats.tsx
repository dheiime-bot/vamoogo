import { useEffect, useState, useRef } from "react";
import { MessageCircle, Send, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";

interface ChatRow {
  ride_id: string;
  passenger_name: string;
  driver_name: string;
  origin: string;
  destination: string;
  status: string;
  last_message: string | null;
  last_at: string | null;
  message_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
}

const AdminChats = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRide, setOpenRide] = useState<ChatRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: rides } = await supabase
        .from("rides")
        .select("id, passenger_id, driver_id, origin_address, destination_address, status, created_at")
        .not("driver_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(80);

      if (!rides?.length) { setRows([]); setLoading(false); return; }

      const userIds = [...new Set([
        ...rides.map((r) => r.passenger_id),
        ...rides.map((r) => r.driver_id).filter(Boolean) as string[],
      ])];
      const rideIds = rides.map((r) => r.id);

      const [{ data: profiles }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase.from("chat_messages").select("ride_id, message, created_at")
          .in("ride_id", rideIds).order("created_at", { ascending: false }),
      ]);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) ?? []);
      const msgMap = new Map<string, { msg: string; at: string; count: number }>();
      msgs?.forEach((m) => {
        const cur = msgMap.get(m.ride_id);
        if (!cur) {
          msgMap.set(m.ride_id, { msg: m.message, at: m.created_at, count: 1 });
        } else {
          cur.count += 1;
        }
      });

      const result: ChatRow[] = rides
        .map((r) => ({
          ride_id: r.id,
          passenger_name: nameMap.get(r.passenger_id) ?? "Passageiro",
          driver_name: nameMap.get(r.driver_id!) ?? "Motorista",
          origin: r.origin_address,
          destination: r.destination_address,
          status: r.status,
          last_message: msgMap.get(r.id)?.msg ?? null,
          last_at: msgMap.get(r.id)?.at ?? null,
          message_count: msgMap.get(r.id)?.count ?? 0,
        }))
        .filter((r) => r.message_count > 0);

      setRows(result);
      setLoading(false);
    };
    load();
  }, []);

  // Load + subscribe messages when chat opened
  useEffect(() => {
    if (!openRide) return;
    const loadMsgs = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("ride_id", openRide.ride_id)
        .order("created_at", { ascending: true });
      if (data) {
        const ids = [...new Set(data.map((m) => m.sender_id))];
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
        const nm = new Map(profs?.map((p) => [p.user_id, p.full_name]) ?? []);
        setMessages(data.map((m) => ({ ...m, sender_name: nm.get(m.sender_id) ?? "Usuário" })));
      }
    };
    loadMsgs();

    const channel = supabase
      .channel(`admin-chat-${openRide.ride_id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `ride_id=eq.${openRide.ride_id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [openRide]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim() || !user || !openRide) return;
    const msg = newMsg.trim();
    setNewMsg("");
    await supabase.from("chat_messages").insert({
      ride_id: openRide.ride_id,
      sender_id: user.id,
      message: `[ADMIN] ${msg}`,
    });
  };

  return (
    <AdminLayout title="Chats">
      {!openRide ? (
        <div className="p-4">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <button
                  key={r.ride_id}
                  onClick={() => setOpenRide(r)}
                  className="w-full flex items-center gap-3 rounded-xl bg-card border p-3 hover:bg-muted transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">
                        {r.passenger_name} ↔ {r.driver_name}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {r.last_at && new Date(r.last_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{r.last_message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {r.message_count} mensagens · {r.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
          <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
            <button onClick={() => setOpenRide(null)} className="rounded-full p-1 hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{openRide.passenger_name} ↔ {openRide.driver_name}</p>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-warning/15 text-warning">Evidência</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate max-w-md">
                {openRide.origin} → {openRide.destination} · Status: {openRide.status}
              </p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            <p className="text-center text-[11px] text-muted-foreground py-2">
              📋 Conversa registrada como evidência. Todas as mensagens estão arquivadas.
            </p>
            {messages.map((m) => (
              <div key={m.id} className="max-w-[70%] rounded-2xl px-4 py-2.5 bg-card border">
                <p className="text-[11px] font-semibold text-primary mb-1">{m.sender_name}</p>
                <p className="text-sm">{m.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t bg-card p-3 flex items-center gap-2">
            <Input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Mensagem como administrador..."
              className="flex-1"
            />
            <button
              onClick={handleSend}
              disabled={!newMsg.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminChats;
