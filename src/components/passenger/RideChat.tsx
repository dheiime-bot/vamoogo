import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/shared/UserAvatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { resolveStorageUrl } from "@/lib/resolveStorageUrl";

interface RideChatProps {
  rideId: string;
  driverName?: string;
  participantPhoto?: string | null;
  participantRole?: "driver" | "passenger";
  onBack: () => void;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface ChatParticipant {
  id: string;
  name: string;
  photo: string | null;
  role: "driver" | "passenger";
}

const RideChat = ({ rideId, driverName, participantPhoto, participantRole = "driver", onBack }: RideChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [participants, setParticipants] = useState<Record<string, ChatParticipant>>({});
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rideId || !user?.id) return;

    const loadParticipants = async () => {
      const { data: profiles } = await supabase.rpc("get_ride_chat_participants" as any, { _ride_id: rideId });
      const participantRows = (profiles || []) as any[];
      if (!participantRows.length) return;

      const driverRow = participantRows.find((profile) => profile.user_type === "driver");
      const next: Record<string, ChatParticipant> = {};

      await Promise.all(participantRows.map(async (profile) => {
        const role: "driver" | "passenger" = profile.user_id === driverRow?.user_id ? "driver" : "passenger";
        const photo = await resolveStorageUrl("selfies", profile.selfie_url || profile.selfie_signup_url);
        next[profile.user_id] = {
          id: profile.user_id,
          name: profile?.full_name || (role === "driver" ? driverName || "Motorista" : "Passageiro"),
          photo: photo || null,
          role,
        };
      }));

      setParticipants(next);
    };

    loadParticipants();
  }, [rideId, user?.id, driverName]);

  useEffect(() => {
    // Load existing messages
    supabase
      .from("chat_messages")
      .select("*")
      .eq("ride_id", rideId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as ChatMessage[]); });

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${rideId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `ride_id=eq.${rideId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;
    setSending(true);
    const msg = newMessage.trim();
    setNewMessage("");
    await supabase.from("chat_messages").insert({
      ride_id: rideId,
      sender_id: user.id,
      message: msg,
    });
    setSending(false);
  };

  const currentParticipant = user?.id ? participants[user.id] : undefined;
  const otherParticipant = Object.values(participants).find((participant) => participant.id !== user?.id);
  const headerName = otherParticipant?.name || driverName || (participantRole === "driver" ? "Motorista" : "Passageiro");
  const headerPhoto = otherParticipant?.photo || participantPhoto || null;
  const headerRole = otherParticipant?.role || participantRole;

  const getParticipantForMessage = (senderId: string, isMe: boolean): ChatParticipant => {
    const participant = participants[senderId];
    if (participant) return participant;
    if (isMe) {
      return {
        id: senderId,
        name: currentParticipant?.name || "Você",
        photo: currentParticipant?.photo || null,
        role: participantRole === "driver" ? "passenger" : "driver",
      };
    }
    return {
      id: senderId,
      name: headerName,
      photo: headerPhoto,
      role: headerRole,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <button onClick={onBack} className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button onClick={() => headerPhoto && setPreviewPhoto({ src: headerPhoto, name: headerName })} disabled={!headerPhoto} className="rounded-full disabled:cursor-default">
          <UserAvatar src={headerPhoto} name={headerName} role={headerRole} size="sm" />
        </button>
        <div>
          <p className="text-sm font-semibold">{headerName}</p>
          <p className="text-xs text-success">Online</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Envie uma mensagem ao motorista</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          const sender = getParticipantForMessage(msg.sender_id, isMe);
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe && (
                <button onClick={() => sender.photo && setPreviewPhoto({ src: sender.photo, name: sender.name })} disabled={!sender.photo} className="rounded-full disabled:cursor-default">
                  <UserAvatar src={sender.photo} name={sender.name} role={sender.role} size="xs" />
                </button>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isMe
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
              }`}>
                <p className="text-sm">{msg.message}</p>
                <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {isMe && (
                <button onClick={() => sender.photo && setPreviewPhoto({ src: sender.photo, name: sender.name })} disabled={!sender.photo} className="rounded-full disabled:cursor-default">
                  <UserAvatar src={sender.photo} name={sender.name} role={sender.role} size="xs" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-t bg-card p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Digite sua mensagem..."
            className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 transition-transform active:scale-90"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-sm p-3">
          <DialogTitle className="sr-only">Foto do contato</DialogTitle>
          {previewPhoto && <img src={previewPhoto.src} alt={previewPhoto.name} className="max-h-[75vh] w-full rounded-xl object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RideChat;
