import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, BellRing, Camera, Crosshair, MapPin, Smartphone, Volume2, Waves } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppMenu from "@/components/shared/AppMenu";
import DriverHomeFab from "@/components/driver/DriverHomeFab";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { playOfferAlert, requestNotificationPermission, unlockAudioOnce } from "@/lib/offerSound";
import { cn } from "@/lib/utils";
import { BeforeInstallPromptEvent, clearStoredInstallPrompt, getStoredInstallPrompt, VAMOO_INSTALL_PROMPT_READY } from "@/lib/pwaInstall";

type SoundTone = "classico" | "suave" | "urgente" | "digital";

interface DriverAlertSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
  soundTone: SoundTone;
}

const STORAGE_KEY = "vamoogo_driver_alert_settings";

const defaultSettings: DriverAlertSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  notificationsEnabled: true,
  soundTone: "urgente",
};

const soundOptions: Array<{ value: SoundTone; label: string }> = [
  { value: "classico", label: "Clássico" },
  { value: "suave", label: "Suave" },
  { value: "urgente", label: "Urgente" },
  { value: "digital", label: "Digital" },
];

const DriverSettings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<DriverAlertSettings>(defaultSettings);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | "unsupported">("unsupported");
  const [locationStatus, setLocationStatus] = useState<PermissionState | "unsupported" | "unknown">("unknown");
  const [cameraStatus, setCameraStatus] = useState<PermissionState | "unsupported" | "unknown">("unknown");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

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

    navigator.permissions?.query({ name: "camera" as PermissionName })
      .then((status) => {
        setCameraStatus(status.state);
        status.onchange = () => setCameraStatus(status.state);
      })
      .catch(() => setCameraStatus("unsupported"));

    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
    setInstallPrompt(getStoredInstallPrompt());
    const onPromptReady = () => setInstallPrompt(getStoredInstallPrompt());
    window.addEventListener(VAMOO_INSTALL_PROMPT_READY, onPromptReady);
    return () => window.removeEventListener(VAMOO_INSTALL_PROMPT_READY, onPromptReady);
  }, []);

  const saveSettings = (next: DriverAlertSettings) => {
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

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraStatus("granted");
      toast.success("Câmera permitida");
    } catch {
      setCameraStatus("denied");
      toast.error("Permissão de câmera negada");
    }
  };

  const requestNotifications = async () => {
    const allowed = await requestNotificationPermission();
    if ("Notification" in window) setNotificationStatus(Notification.permission);
    toast[allowed ? "success" : "error"](allowed ? "Notificações permitidas" : "Notificações não permitidas");
  };

  const testSound = async () => {
    unlockAudioOnce();
    await playOfferAlert({ title: "Teste Vamoo", body: "Som de chamada configurado", tag: "driver-sound-test" });
  };

  const installApp = async () => {
    if (!installPrompt) {
      toast.info("No Android, abra o menu do Chrome e toque em Instalar app");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setStandalone(true);
      setInstallPrompt(null);
      clearStoredInstallPrompt();
      toast.success("Instalação iniciada");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-gradient-primary px-6 pb-12 pt-20 text-primary-foreground">
        <button onClick={() => navigate("/driver")} className="mb-5 text-primary-foreground/80">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-extrabold">Configurações</h1>
        <p className="mt-1 text-sm font-semibold text-primary-foreground/80">Chamadas, permissões e preferências do motorista</p>
      </header>

      <main className="-mt-6 space-y-4 px-4">
        <section className="rounded-2xl border bg-card p-4 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">App Android</h2>
              <p className="text-sm text-muted-foreground">{standalone ? "Instalado na tela inicial" : "Instale para usar como aplicativo"}</p>
            </div>
            <Button onClick={installApp} disabled={standalone} variant={standalone ? "secondary" : "default"}>
              {standalone ? "Instalado" : "Instalar"}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3"><Volume2 className="h-5 w-5 text-primary" /></div>
            <div><h2 className="text-lg font-extrabold">Som das chamadas</h2><p className="text-sm text-muted-foreground">Escolha o alerta de nova corrida</p></div>
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
            <div><h2 className="text-lg font-extrabold">Permissões</h2><p className="text-sm text-muted-foreground">Recursos necessários para aceitar corridas</p></div>
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
                <div className="flex items-center gap-3"><Camera className="h-5 w-5 text-primary" /><div><p className="font-extrabold">Câmera</p><p className="text-sm text-muted-foreground">{permissionText[cameraStatus]}</p></div></div>
                <Button onClick={requestCamera} variant="secondary">Permitir</Button>
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

      <AppMenu role="driver" />
      <DriverHomeFab />
    </div>
  );
};

export default DriverSettings;