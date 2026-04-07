import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, User, Building2, CheckCircle2, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiGoogle } from "react-icons/si";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register" | "pending-verification">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resending, setResending] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (mode === "pending-verification" && pendingEmail) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/auth/verification-status/${encodeURIComponent(pendingEmail)}`, { credentials: "include" });
          const data = await res.json();
          if (data.verified) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            window.location.href = "/";
          }
        } catch {}
      }, 3000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [mode, pendingEmail]);

  async function handleResendVerification() {
    setResending(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification", { email: pendingEmail });
      toast({ title: "Correo enviado", description: "Se ha reenviado el enlace de verificación." });
    } catch {
      toast({ title: "Error", description: "No se pudo reenviar el correo.", variant: "destructive" });
    } finally {
      setResending(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsVerification) {
          setPendingEmail(data.email || email);
          setMode("pending-verification");
          return;
        }
        throw new Error(data.message || "Error al iniciar sesión.");
      }
      localStorage.setItem("postIAlo_auth", "true");
      setLocation("/");
    } catch (err: any) {
      const msg = err.message?.includes("incorrectos")
        ? "Correo o contraseña incorrectos."
        : err.message || "Error al iniciar sesión. Intente de nuevo.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          company: company || undefined,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al registrarse.");
      }
      if (data.needsVerification) {
        setPendingEmail(data.email || email);
        setMode("pending-verification");
      } else {
        localStorage.setItem("postIAlo_auth", "true");
        setLocation("/");
      }
    } catch (err: any) {
      const msg = err.message?.includes("409") || err.message?.includes("Ya existe")
        ? "Ya existe una cuenta con este correo."
        : err.message || "Error al registrarse. Intente de nuevo.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#002073]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#001550] via-[#002073] to-[#003099]" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#e3001b]/8 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="bg-white rounded-2xl border border-white/20 p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#002073] flex items-center justify-center shadow-lg">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#002073]">
              Post<span className="text-[#e3001b]">IA</span>lo <span className="text-[#002073]">Mailing</span>
            </h1>
          </div>

          {mode !== "pending-verification" && (
            <p className="text-center text-gray-500 mb-8">
              {mode === "login"
                ? "Tu plataforma inteligente de email marketing"
                : "Crea tu cuenta para comenzar"}
            </p>
          )}

          {mode === "pending-verification" ? (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8 text-[#002073]" />
              </div>
              <h2 className="text-xl font-bold text-gray-800" data-testid="text-pending-verification">
                Verifica tu correo electrónico
              </h2>
              <p className="text-sm text-gray-500">
                Hemos enviado un enlace de verificación a{" "}
                <span className="font-semibold text-gray-700">{pendingEmail}</span>.
                Haz clic en el enlace para activar tu cuenta.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Verificando automáticamente...
              </div>
              <div className="pt-2 space-y-3">
                <Button
                  data-testid="button-resend-verification"
                  variant="outline"
                  className="w-full rounded-xl gap-2"
                  onClick={handleResendVerification}
                  disabled={resending}
                >
                  <Mail className="w-4 h-4" />
                  {resending ? "Reenviando..." : "Reenviar correo de verificación"}
                </Button>
                <button
                  data-testid="button-back-to-login"
                  type="button"
                  onClick={() => { setMode("login"); if (pollingRef.current) clearInterval(pollingRef.current); }}
                  className="text-sm text-[#002073] font-semibold hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </div>
          ) : mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="input-email"
                    id="email"
                    type="email"
                    placeholder="tu@empresa.com"
                    className="pl-10 rounded-xl border-gray-300"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="input-password"
                    id="password"
                    type="password"
                    placeholder="Tu contraseña"
                    className="pl-10 rounded-xl border-gray-300"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                data-testid="button-login"
                type="submit"
                className="w-full rounded-xl gap-2 bg-[#002073] hover:bg-[#001a5e] text-white"
                size="lg"
                disabled={loading}
              >
                {loading ? "Iniciando..." : "Iniciar Sesión"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reg-name" className="text-gray-700">Nombre</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="input-register-name"
                    id="reg-name"
                    type="text"
                    placeholder="Tu nombre completo"
                    className="pl-10 rounded-xl border-gray-300"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email" className="text-gray-700">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="input-register-email"
                    id="reg-email"
                    type="email"
                    placeholder="tu@empresa.com"
                    className="pl-10 rounded-xl border-gray-300"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password" className="text-gray-700">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="input-register-password"
                    id="reg-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    className="pl-10 rounded-xl border-gray-300"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Mínimo 6 caracteres, una mayúscula y un número</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-company" className="text-gray-700">Empresa <span className="text-gray-400">(opcional)</span></Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    data-testid="input-register-company"
                    id="reg-company"
                    type="text"
                    placeholder="Nombre de tu empresa"
                    className="pl-10 rounded-xl border-gray-300"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
              </div>

              <Button
                data-testid="button-register"
                type="submit"
                className="w-full rounded-xl gap-2 bg-[#002073] hover:bg-[#001a5e] text-white"
                size="lg"
                disabled={loading}
              >
                {loading ? "Registrando..." : "Crear Cuenta"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>
          )}

          {mode !== "pending-verification" && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400">o continúa con</span>
                </div>
              </div>

              <Button
                data-testid="button-google-login"
                variant="outline"
                className="w-full rounded-xl gap-2 border-gray-300 text-gray-400 cursor-not-allowed"
                size="lg"
                disabled
                title="Próximamente"
              >
                <SiGoogle className="w-4 h-4" />
                Google (Próximamente)
              </Button>

              <div className="mt-6 text-center">
                {mode === "login" ? (
                  <p className="text-sm text-gray-500">
                    ¿No tienes cuenta?{" "}
                    <button
                      data-testid="button-switch-to-register"
                      type="button"
                      onClick={() => setMode("register")}
                      className="text-[#002073] font-semibold hover:underline"
                    >
                      Regístrate ✅
                    </button>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    ¿Ya tienes cuenta?{" "}
                    <button
                      data-testid="button-switch-to-login"
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-[#002073] font-semibold hover:underline"
                    >
                      Inicia sesión
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
