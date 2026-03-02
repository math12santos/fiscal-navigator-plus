import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2 } from "lucide-react";

interface Props {
  onComplete: () => void;
}

export default function OnboardingPassword({ onComplete }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const canSubmit = password.length >= 6 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Mark password as changed
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false } as any)
          .eq("id", user.id);
      }

      toast({ title: "Senha redefinida com sucesso!" });
      onComplete();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Redefina sua Senha</h1>
          <p className="text-sm text-muted-foreground">
            Para sua segurança, defina uma nova senha antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <PasswordInput
              id="confirm-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              required
            />
            {confirm && password !== confirm && (
              <p className="text-xs text-destructive">As senhas não coincidem</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar Nova Senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
