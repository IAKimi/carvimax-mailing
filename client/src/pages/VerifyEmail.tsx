import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/verify/:token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!params?.token) {
      setStatus("error");
      setMessage("Token de verificación no proporcionado.");
      return;
    }

    fetch(`/api/auth/verify/${params.token}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Cuenta verificada exitosamente.");
          localStorage.setItem("postIAlo_auth", "true");
          setTimeout(() => {
            setLocation("/");
          }, 2000);
        } else {
          setStatus("error");
          setMessage(data.message || "Error al verificar la cuenta.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Error de conexión. Intenta de nuevo.");
      });
  }, [params?.token]);

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
        <div className="bg-white rounded-2xl border border-white/20 p-8 shadow-2xl text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#002073] flex items-center justify-center shadow-lg">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#002073]">
              Post<span className="text-[#e3001b]">IA</span>lo <span className="text-[#002073]">Mailing</span>
            </h1>
          </div>

          {status === "loading" && (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-[#002073] animate-spin mx-auto" />
              <p className="text-gray-600 font-medium">Verificando tu cuenta...</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800" data-testid="text-verify-success">
                {message}
              </h2>
              <p className="text-sm text-gray-500">Redirigiendo al dashboard...</p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800" data-testid="text-verify-error">
                Verificación fallida
              </h2>
              <p className="text-sm text-gray-500">{message}</p>
              <Button
                data-testid="button-go-to-login"
                onClick={() => setLocation("/login")}
                className="mt-4 rounded-xl bg-[#002073] hover:bg-[#001a5e] text-white"
              >
                Ir al inicio de sesión
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
