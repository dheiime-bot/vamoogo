import { useEffect, useMemo, useState, useRef } from "react";
import { MessageCircle, Send, ArrowLeft, Search, Hash, MapPin, Calendar, User, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";

interface ChatRow {
  ride_id: string;
  ride_code: string;
  passenger_name: string;
  passenger_phone: string | null;
  driver_name: string;
  driver_phone: string | null;
  origin: string;
  destination: string;
  status: string;
  created_at: string;
  price: number | null;
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

const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    requested: "Solicitada", accepted: "Aceita", in_progress: "Em andamento",
    completed: "Concluída", cancelled: "Cancelada",
  };
  return map[s] ?? s;
};

const statusColor = (s: string) => {
  if (s === "completed") return "bg-success/15 text-success";
  if (s === "cancelled") return "bg-destructive/15 text-destructive";
  if (s === "in_progress" || s === "accepted") return "bg-primary/15 text-primary";
  return "bg-muted text-muted-foreground";
};

const AdminChats = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRide, setOpenRide] = useState<ChatRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      const { data: rides } = await supabase
        .from("rides")
        .select("id, ride_code, passenger_id, driver_id, origin_address, destination_address, status, created_at, price")
        .not("driver_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(120);

      if (!rides?.length) { setRows([]); setLoading(false); return; }

      const userIds = [...new Set([
        ...rides.map((r) => r.passenger_id),
        ...rides.map((r) => r.driver_id).filter(Boolean) as string[],
      ])];
      const rideIds = rides.map((r) => r.id);

      const [{ data: profiles }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone").in("user_id", userIds),
        supabase.from("chat_messages").select("ride_id, message, created_at")
          .in("ride_id", rideIds).order("created_at", { ascending: false }),
      ]);

      const profMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
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
        .map((r) => {
          const p = profMap.get(r.passenger_id);
          const d = profMap.get(r.driver_id!);
          return {
            ride_id: r.id,
            ride_code: r.ride_code,
            passenger_name: p?.full_name ?? "Passageiro",
            passenger_phone: p?.phone ?? null,
            driver_name: d?.full_name ?? "Motorista",
            driver_phone: d?.phone ?? null,
            origin: r.origin_address,
            destination: r.destination_address,
            status: r.status,
            created_at: r.created_at,
            price: r.price,
            last_message: msgMap.get(r.id)?.msg ?? null,
            last_at: msgMap.get(r.id)?.at ?? null,
            message_count: msgMap.get(r.id)?.count ?? 0,
          };
        })
        .filter((r) => r.message_count > 0);

      setRows(result);
      if (showSpinner) setLoading(false);
    };

  useEffect(() => {
    load();
    // 🔄 Realtime: lista atualiza quando chegam novas mensagens ou corridas mudam
    const channel = supabase
      .channel("admin-chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => load(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => load(false))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.ride_code?.toLowerCase().includes(q) ||
      r.passenger_name.toLowerCase().includes(q) ||
      r.driver_name.toLowerCase().includes(q) ||
      r.origin.toLowerCase().includes(q) ||
      r.destination.toLowerCase().includes(q) ||
      (r.last_message ?? "").toLowerCase().includes(q) ||
      (r.passenger_phone ?? "").toLowerCase().includes(q) ||
      (r.driver_phone ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

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
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código VAMOO, nome, telefone, endereço ou mensagem..."
              className="pl-9"
            />
          </div>
          {!loading && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "conversa" : "conversas"}
              {search && ` (filtradas de ${rows.length})`}
            </p>
          )}

          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa registrada"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <button
                  key={r.ride_id}
                  onClick={() => setOpenRide(r)}
                  className="w-full rounded-xl bg-card border p-3 hover:bg-muted transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                        <Hash className="h-3 w-3" />{r.ride_code}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${statusColor(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {r.last_at && new Date(r.last_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate"><span className="text-muted-foreground">Pass.: </span>{r.passenger_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Car className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate"><span className="text-muted-foreground">Mot.: </span>{r.driver_name}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground mb-1.5">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="truncate">{r.origin} → {r.destination}</span>
                  </div>

                  <div className="rounded-lg bg-muted/50 px-2.5 py-1.5 mb-1.5">
                    <p className="text-xs truncate"><MessageCircle className="h-3 w-3 inline mr-1 text-primary" />{r.last_message}</p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>{r.message_count} msgs{r.price != null && ` · R$ ${r.price.toFixed(2).replace(".", ",")}`}</span>
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                  <Hash className="h-3 w-3" />{openRide.ride_code}
                </span>
                <p className="text-sm font-semibold truncate">{openRide.passenger_name} ↔ {openRide.driver_name}</p>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${statusColor(openRide.status)}`}>
                  {statusLabel(openRide.status)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate max-w-md">
                {openRide.origin} → {openRide.destination}
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
