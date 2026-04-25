import { useEffect, useRef, useState } from "react";
import { Loader2, Camera, X, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const EditProfileModal = ({ open, onOpenChange }: Props) => {
  const { user, profile, refreshProfile } = useAuth();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setBirthDate(profile.birth_date || "");
      setSelfiePreview(profile.selfie_url || null);
      setSelfieFile(null);
    }
  }, [open, profile]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem maior que 5MB");
      return;
    }
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    setSaving(true);
    try {
      let selfie_url = profile?.selfie_url || null;
      if (selfieFile) {
        const ext = selfieFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/profile-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("selfies")
          .upload(path, selfieFile, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("selfies").getPublicUrl(path);
        selfie_url = data.publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.replace(/\D/g, "") || null,
          birth_date: birthDate || null,
          selfie_url,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Dados atualizados");
      await refreshProfile();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar meus dados</DialogTitle>
          <DialogDescription>
            Você pode trocar sua <strong>foto de perfil</strong>. A selfie do cadastro fica
            arquivada para auditoria. CPF, e-mail e dados do veículo só pelo suporte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Foto de perfil</p>
            <div className="relative h-24 w-24 rounded-full bg-muted overflow-hidden border">
              {selfiePreview ? (
                <img src={selfiePreview} alt="Selfie" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="grid w-full grid-cols-2 gap-2 px-4">
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                <ImageIcon className="h-3.5 w-3.5 text-primary" /> Galeria
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                <Camera className="h-3.5 w-3.5 text-primary" /> Nova selfie
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="ed-name">Nome completo</Label>
            <Input
              id="ed-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>

          <div>
            <Label htmlFor="ed-phone">Telefone</Label>
            <Input
              id="ed-phone"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
            />
          </div>

          <div>
            <Label htmlFor="ed-birth">Data de nascimento</Label>
            <Input
              id="ed-birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">CPF:</strong> {profile?.cpf || "—"} (somente suporte)</p>
            <p><strong className="text-foreground">E-mail:</strong> {profile?.email || "—"} (somente suporte)</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileModal;
