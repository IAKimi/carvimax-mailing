import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Mail, Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiGoogle } from "react-icons/si";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("postIAlo_auth", "true");
    localStorage.setItem("postIAlo_user", email || "Usuario");
    setLocation("/");
  }

  function handleGoogleLogin() {
    localStorage.setItem("postIAlo_auth", "true");
    localStorage.setItem("postIAlo_user", "Usuario Google");
    setLocation("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-background to-blue-600/10" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="bg-card rounded-2xl border border-border p-8 shadow-xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              PostIAlo<span className="text-primary">.mail</span>
            </h1>
          </div>

          <p className="text-center text-muted-foreground mb-8">
            Tu plataforma inteligente de email marketing
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-email"
                  id="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  className="pl-10 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-password"
                  id="password"
                  type="password"
                  placeholder="Tu contraseña"
                  className="pl-10 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              data-testid="button-login"
              type="submit"
              className="w-full rounded-xl gap-2"
              size="lg"
            >
              Iniciar Sesión
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">o continúa con</span>
            </div>
          </div>

          <Button
            data-testid="button-google-login"
            variant="outline"
            className="w-full rounded-xl gap-2"
            size="lg"
            onClick={handleGoogleLogin}
          >
            <SiGoogle className="w-4 h-4" />
            Google
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
