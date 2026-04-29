import { useEffect, useState, useRef, useMemo } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, KeyRound, User, AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logSecurityEvent } from "@/lib/securityEvents";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(120, "Nome muito longo (máx. 120)"),
  phone: z
    .string()
    .trim()
    .max(30, "Telefone muito longo")
    .regex(/^[0-9()+\-.\s]*$/, "Use apenas números e símbolos válidos")
    .optional()
    .or(z.literal("")),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z
      .string()
      .min(8, "A nova senha deve ter ao menos 8 caracteres")
      .max(128, "Senha muito longa")
      .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
      .regex(/[0-9]/, "Inclua ao menos um número"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "Escolha uma senha diferente da atual",
    path: ["newPassword"],
  });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte", "Excelente"];
  const colors = ["bg-destructive", "bg-destructive", "bg-warning", "bg-warning", "bg-success", "bg-success"];
  return { score: (s / 5) * 100, label: labels[s], color: colors[s] };
}

export default function Perfil() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Avatar preview state
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setEmail(data.email ?? user.email ?? "");
        setPhone(data.phone ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      } else {
        setEmail(user.email ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);

  const handleSave = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({ fullName, phone });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setProfileErrors(errs);
      toast({ title: "Verifique os dados", description: "Há campos com erros.", variant: "destructive" });
      return;
    }
    setProfileErrors({});
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      email: user.email,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado", description: "Suas informações foram salvas." });
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-select same file
    if (!file) return;
    setPreviewError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPreviewError("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setPreviewError(`Arquivo grande (${formatBytes(file.size)}). Máximo: 2 MB.`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleClearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };

  const handleConfirmAvatar = async () => {
    if (!previewFile || !user) return;
    setUploading(true);
    try {
      const ext = previewFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, previewFile, { upsert: true, contentType: previewFile.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: url, email: user.email });
      if (updErr) throw updErr;

      setAvatarUrl(url);
      handleClearPreview();
      toast({ title: "Foto atualizada", description: "Sua nova foto de perfil foi salva." });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const parsed = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setPwErrors(errs);
      return;
    }
    setPwErrors({});
    setPwLoading(true);

    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthErr) {
      setPwLoading(false);
      logSecurityEvent({
        type: "password_change_reauth_failed",
        userId: user.id,
        email: user.email,
      });
      toast({ title: "Senha atual incorreta", variant: "destructive" });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwLoading(false);
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
      return;
    }

    await logSecurityEvent({
      type: "password_changed",
      userId: user.id,
      email: user.email,
      metadata: { source: "perfil" },
    });

    // Invalidate ALL sessions for safety
    await supabase.auth.signOut({ scope: "global" });
    await logSecurityEvent({
      type: "session_revoked_global",
      userId: user.id,
      email: user.email,
      metadata: { reason: "password_changed" },
    });

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwLoading(false);

    toast({
      title: "Senha alterada com sucesso",
      description: "Por segurança, todas as sessões foram encerradas. Faça login novamente.",
    });

    setTimeout(() => {
      signOut().finally(() => navigate("/auth", { replace: true }));
    }, 1500);
  };

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  const initials = (fullName || email || "?").slice(0, 2).toUpperCase();
  const displayAvatar = previewUrl || avatarUrl;

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" /> Meu Perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Atualize suas informações pessoais e senha de acesso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações pessoais</CardTitle>
          <CardDescription>Foto, nome, e-mail e telefone de contato.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4">
            <Avatar className={cn("h-24 w-24 ring-2 ring-border", previewUrl && "ring-primary")}>
              {displayAvatar && <AvatarImage src={displayAvatar} alt={fullName} />}
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={handleSelectFile}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {previewFile ? "Trocar arquivo" : "Selecionar foto"}
                </Button>
                {previewFile && (
                  <>
                    <Button type="button" size="sm" onClick={handleConfirmAvatar} disabled={uploading}>
                      {uploading ? "Enviando..." : "Confirmar nova foto"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearPreview}
                      disabled={uploading}
                    >
                      <X className="mr-1 h-4 w-4" /> Cancelar
                    </Button>
                  </>
                )}
              </div>

              {previewFile && !previewError && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    <span>{previewFile.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{formatBytes(previewFile.size)} / 2 MB</span>
                    <div className="flex-1 max-w-xs">
                      <Progress value={(previewFile.size / MAX_AVATAR_BYTES) * 100} className="h-1.5" />
                    </div>
                  </div>
                </div>
              )}

              {previewError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{previewError}</span>
                </div>
              )}

              {!previewFile && !previewError && (
                <p className="text-xs text-muted-foreground">JPG, PNG ou WebP. Máximo 2 MB.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
                aria-invalid={!!profileErrors.fullName}
              />
              {profileErrors.fullName && (
                <p className="text-xs text-destructive">{profileErrors.fullName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={email} disabled />
              <p className="text-xs text-muted-foreground">
                O e-mail é gerenciado pelo administrador.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                maxLength={30}
                aria-invalid={!!profileErrors.phone}
              />
              {profileErrors.phone && (
                <p className="text-xs text-destructive">{profileErrors.phone}</p>
              )}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>
            Defina uma nova senha de acesso ao sistema. Por segurança, todas as suas sessões serão encerradas após a troca.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <PasswordInput
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={!!pwErrors.currentPassword}
            />
            {pwErrors.currentPassword && (
              <p className="text-xs text-destructive">{pwErrors.currentPassword}</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={!!pwErrors.newPassword}
              />
              {newPassword && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-secondary rounded overflow-hidden">
                    <div
                      className={cn("h-full transition-all", strength.color)}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Força: {strength.label}</p>
                </div>
              )}
              {pwErrors.newPassword && (
                <p className="text-xs text-destructive">{pwErrors.newPassword}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={!!pwErrors.confirmPassword}
              />
              {pwErrors.confirmPassword && (
                <p className="text-xs text-destructive">{pwErrors.confirmPassword}</p>
              )}
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={pwLoading} variant="secondary">
            <KeyRound className="mr-2 h-4 w-4" />
            {pwLoading ? "Salvando..." : "Alterar senha e encerrar sessões"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
