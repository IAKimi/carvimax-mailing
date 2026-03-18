import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Mail, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "El enlace de verificación es inválido o ya fue utilizado.",
  expired: "El enlace de verificación ha expirado. Solicita uno nuevo desde la pantalla de inicio de sesión.",
  server: "Ocurrió un error al verificar tu cuenta. Intenta de nuevo más tarde.",
};

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason") || "invalid";
    setMessage(ERROR_MESSAGES[reason] || ERROR_MESSAGES.invalid);
  }, []);

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
        </div>
      </motion.div>
    </div>
  );
}
