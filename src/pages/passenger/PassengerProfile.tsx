import { useState } from "react";
import { User, Camera, FileText, Phone, Mail, Shield, ArrowLeft, Car, Pencil } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import NotificationBell from "@/components/shared/NotificationBell";
import StatusBadge from "@/components/shared/StatusBadge";
import EditProfileModal from "@/components/shared/EditProfileModal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const PassengerProfile = () => {
  const navigate = useNavigate();
  const { profile, signOut, roles } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const calcAge = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };
  const age = calcAge(profile?.birth_date);
  const isDriver = roles?.includes("driver");
  const canBecomeDriver = !isDriver && age !== null && age >= 21;

  const displayName = profile?.full_name || "Usuário";
  const cpfMasked = profile?.cpf
    ? `***.***.***-${profile.cpf.slice(-2)}`
    : "***.***.***-**";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-primary p-6 pb-16">
        <button onClick={() => navigate("/passenger")} className="mb-4 text-primary-foreground/80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-primary-foreground">Meu Perfil</h1>
      </div>

      <div className="relative -mt-10 px-4">
        <div className="rounded-2xl border bg-card p-5 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted overflow-hidden">
              {profile?.selfie_url ? (
                <img src={profile.selfie_url} alt="Foto" className="h-full w-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{displayName}</h2>
              <p className="text-sm text-muted-foreground">CPF: {cpfMasked}</p>
              <StatusBadge status="approved" />
            </div>
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted flex items-center gap-1"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {[
            { icon: Phone, label: "Telefone", value: profile?.phone || "Não informado", verified: !!profile?.phone_verified },
            { icon: Mail, label: "Email", value: profile?.email || "Não informado", verified: true },
            { icon: Camera, label: "Selfie", value: profile?.selfie_url ? "Verificada" : "Pendente", verified: !!profile?.selfie_url },
            { icon: FileText, label: "CPF", value: "Validado", verified: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2"><item.icon className="h-4 w-4 text-muted-foreground" /></div>
                <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.value}</p></div>
              </div>
              {item.verified && <Shield className="h-4 w-4 text-success" />}
            </div>
          ))}
        </div>

        {canBecomeDriver && (
          <button
            onClick={() => navigate("/passenger/become-driver")}
            className="mt-6 w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow flex items-center justify-center gap-2"
          >
            <Car className="h-4 w-4" /> Quero ser motorista
          </button>
        )}
        {isDriver && (
          <button
            onClick={() => navigate("/driver/status")}
            className="mt-6 w-full rounded-xl border border-primary/40 bg-primary/5 py-3 text-sm font-semibold text-primary flex items-center justify-center gap-2"
          >
            <Car className="h-4 w-4" /> Ver meu cadastro de motorista
          </button>
        )}
        {!canBecomeDriver && !isDriver && age !== null && age < 21 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Para se tornar motorista é necessário ter 21 anos ou mais.
          </p>
        )}

        <button onClick={handleLogout} className="mt-4 w-full rounded-xl border border-destructive/30 py-3 text-sm font-semibold text-destructive">
          Sair da conta
        </button>
      </div>

      <AppMenu role="passenger" />
      <NotificationBell />
      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
};

export default PassengerProfile;
