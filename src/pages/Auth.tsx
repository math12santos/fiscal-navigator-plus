import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/securityEvents";

const RESET_COOLDOWN_SEC = 60;
const RESET_TS_KEY = "pwd_reset_last_ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const { toast } = useToast();

  // Recover cooldown across page reloads (uses sessionStorage)
  useEffect(() => {
    const ts = Number(sessionStorage.getItem(RESET_TS_KEY) || 0);
    if (!ts) return;
    const elapsed = Math.floor((Date.now() - ts) / 1000);
    const remaining = RESET_COOLDOWN_SEC - elapsed;
    if (remaining > 0) setCooldownSec(remaining);
  }, []);

  // Tick down the cooldown
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  const handleForgotPassword = async () => {
    if (cooldownSec > 0) {
      logSecurityEvent({ type: "rate_limit_blocked", email, metadata: { action: "password_reset_request" } });
      return;
    }
    if (!email) {
      toast({
        title: "Informe seu e-mail",
        description: "Digite seu e-mail no campo acima para redefinir a senha.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      logSecurityEvent({ type: "password_reset_requested", email });
      sessionStorage.setItem(RESET_TS_KEY, String(Date.now()));
      setCooldownSec(RESET_COOLDOWN_SEC);
      toast({
        title: "Solicitação registrada",
        description:
          "Se este e-mail estiver cadastrado, você receberá em instantes um link para redefinir a senha.",
      });
    } catch (error: any) {
      toast({
        title: "Solicitação registrada",
        description:
          "Se este e-mail estiver cadastrado, você receberá em instantes um link para redefinir a senha.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          logSecurityEvent({ type: "login_failed", email, metadata: { reason: error.message } });
          throw error;
        }
        logSecurityEvent({ type: "login_success", userId: data.user?.id, email });
        if (!rememberMe) {
          sessionStorage.setItem("session_only", "true");
        } else {
          sessionStorage.removeItem("session_only");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu e-mail para confirmar a conta.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">FinCore</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Acesse sua conta" : "Crie sua conta"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                required={!isLogin}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          {isLogin && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember-me" className="text-sm font-normal text-muted-foreground cursor-pointer">
                Manter conectado
              </Label>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {isLogin ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Cadastrar"}
          </Button>
          {isLogin && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-muted-foreground hover:text-primary hover:underline w-full text-right disabled:opacity-50 disabled:hover:no-underline"
              disabled={loading || cooldownSec > 0}
            >
              {cooldownSec > 0
                ? `Aguarde ${cooldownSec}s para reenviar`
                : "Esqueci minha senha"}
            </button>
          )}
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-primary hover:underline"
          >
            {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
          </button>
        </div>
      </div>
    </main>
  );
}
