import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { logSecurityEvent } from "@/lib/securityEvents";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoverySession, setRecoverySession] = useState(false);
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoverySession(true);
      } else if (session) {
        setRecoverySession(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoverySession(true);
      setChecked(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Once we've confirmed there's no recovery session, log invalid link event
  useEffect(() => {
    if (checked && !recoverySession) {
      logSecurityEvent({ type: "password_reset_link_invalid" });
    }
  }, [checked, recoverySession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Senha curta", description: "Use ao menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "Confirme a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await logSecurityEvent({
        type: "password_changed",
        userId: userData.user?.id,
        email: userData.user?.email,
        metadata: { source: "reset_password" },
      });

      // Encerrar TODAS as sessões para máxima segurança
      await supabase.auth.signOut({ scope: "global" });
      await logSecurityEvent({
        type: "session_revoked_global",
        userId: userData.user?.id,
        email: userData.user?.email,
        metadata: { reason: "password_reset" },
      });

      setDone(true);
      toast({ title: "Senha redefinida!", description: "Faça login com a nova senha." });
      setTimeout(() => navigate("/auth", { replace: true }), 1800);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">Redefinir Senha</h1>
          <p className="text-sm text-muted-foreground">
            Defina sua nova senha de acesso
          </p>
        </div>

        {done ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <p className="text-sm">Senha redefinida com sucesso.</p>
            <p className="text-xs text-muted-foreground">
              Por segurança, todas as sessões foram encerradas. Redirecionando para o login...
            </p>
          </div>
        ) : !checked ? (
          <div className="text-center text-sm text-muted-foreground py-4">Validando link...</div>
        ) : !recoverySession ? (
          <div className="text-center text-sm text-muted-foreground space-y-3">
            <p>Link inválido ou expirado.</p>
            <p className="text-xs">
              Solicite um novo link de redefinição na tela de login.
            </p>
            <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
              Voltar ao login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <PasswordInput
                id="confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <KeyRound className="mr-2 h-4 w-4" />
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Após salvar, todas as suas sessões serão encerradas e você precisará fazer login novamente.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
