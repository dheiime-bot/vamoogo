import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, BellRing, Crosshair, MapPin, Smartphone, Volume2, Waves } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppMenu from "@/components/shared/AppMenu";
import HomeFab from "@/components/passenger/HomeFab";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { playOfferAlert, requestNotificationPermission, unlockAudioOnce } from "@/lib/offerSound";
import { cn } from "@/lib/utils";

type SoundTone = "classico" | "suave" | "urgente" | "digital";

interface PassengerAlertSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
  soundTone: SoundTone;
}

const STORAGE_KEY = "vamoogo_passenger_alert_settings";

const defaultSettings: PassengerAlertSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  notificationsEnabled: true,
  soundTone: "classico",
};

const soundOptions: Array<{ value: SoundTone; label: string }> = [
  { value: "classico", label: "Clássico" },
  { value: "suave", label: "Suave" },
  { value: "urgente", label: "Urgente" },
  { value: "digital", label: "Digital" },
];

const PassengerSettings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PassengerAlertSettings>(defaultSettings);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | "unsupported">("unsupported");
  const [locationStatus, setLocationStatus] = useState<PermissionState | "unsupported" | "unknown">("unknown");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch {
      setSettings(defaultSettings);
    }

    if ("Notification" in window) setNotificationStatus(Notification.permission);

    navigator.permissions?.query({ name: "geolocation" as PermissionName })
      .then((status) => {
        setLocationStatus(status.state);
        status.onchange = () => setLocationStatus(status.state);
      })
      .catch(() => setLocationStatus("unsupported"));
  }, []);

  const saveSettings = (next: PassengerAlertSettings) => {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const permissionText = useMemo(() => ({
    granted: "Permitido",
    denied: "Bloqueado",
    prompt: "Pendente",
    unsupported: "Indisponível",
    unknown: "Verificando",
  }), []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("GPS indisponível neste dispositivo");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationStatus("granted");
        toast.success("Localização permitida");
      },
      () => {
        setLocationStatus("denied");
        toast.error("Permissão de localização negada");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const requestNotifications = async () => {
    const allowed = await requestNotificationPermission();
    if ("Notification" in window) setNotificationStatus(Notification.permission);
    toast[allowed ? "success" : "error"](allowed ? "Notificações permitidas" : "Notificações não permitidas");
  };

  const testSound = async () => {
    unlockAudioOnce();
    await playOfferAlert({ title: "Teste Vamoo", body: "Som configurado", tag: "passenger-sound-test" });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-gradient-primary px-6 pb-12 pt-20 text-primary-foreground">
        <button onClick={() => navigate("/passenger")} className="mb-5 text-primary-foreground/80">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-extrabold">Configurações</h1>
        <p className="mt-1 text-sm font-semibold text-primary-foreground/80">Alertas, permissões e preferências do passageiro</p>
      </header>

      <main className="-mt-6 space-y-4 px-4">
        <section className="rounded-2xl border bg-card p-4 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3"><Volume2 className="h-5 w-5 text-primary" /></div>
            <div><h2 className="text-lg font-extrabold">Som dos alertas</h2><p className="text-sm text-muted-foreground">Escolha como o app avisa você</p></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {soundOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => saveSettings({ ...settings, soundTone: option.value, soundEnabled: true })}
                className={cn(
                  "rounded-xl border px-3 py-4 text-sm font-extrabold transition-colors",
                  settings.soundTone === option.value ? "border-primary bg-primary/10 text-primary" : "bg-background text-foreground hover:bg-muted"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 p-4">
            <div className="flex items-center gap-3"><BellRing className="h-5 w-5 text-primary" /><span className="font-bold">Som ligado</span></div>
            <Switch checked={settings.soundEnabled} onCheckedChange={(checked) => saveSettings({ ...settings, soundEnabled: checked })} />
          </div>

          <Button onClick={testSound} className="mt-4 w-full gap-2" size="lg">
            <Volume2 className="h-5 w-5" /> Testar som
          </Button>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3"><Smartphone className="h-5 w-5 text-primary" /></div>
            <div><h2 className="text-lg font-extrabold">Permissões</h2><p className="text-sm text-muted-foreground">Libere recursos para o app funcionar melhor</p></div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-primary" /><div><p className="font-extrabold">Localização</p><p className="text-sm text-muted-foreground">{permissionText[locationStatus]}</p></div></div>
                <Button onClick={requestLocation} variant="secondary">Permitir</Button>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-primary" /><div><p className="font-extrabold">Notificações</p><p className="text-sm text-muted-foreground">{permissionText[notificationStatus]}</p></div></div>
                <Button onClick={requestNotifications} variant="secondary">Permitir</Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
              <div className="flex items-center gap-3"><Waves className="h-5 w-5 text-primary" /><span className="font-bold">Vibração</span></div>
              <Switch checked={settings.vibrationEnabled} onCheckedChange={(checked) => saveSettings({ ...settings, vibrationEnabled: checked })} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
              <div className="flex items-center gap-3"><Crosshair className="h-5 w-5 text-primary" /><span className="font-bold">Notificações ativas</span></div>
              <Switch checked={settings.notificationsEnabled} onCheckedChange={(checked) => saveSettings({ ...settings, notificationsEnabled: checked })} />
            </div>
          </div>
        </section>
      </main>

      <AppMenu role="passenger" />
      <HomeFab />
    </div>
  );
};

export default PassengerSettings;