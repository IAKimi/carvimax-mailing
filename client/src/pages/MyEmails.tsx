import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Mail, Clock, Check, CalendarDays, Send, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface SentEmail {
  id: number;
  subject: string;
  idea: string;
  status: "programado" | "enviado";
  sentDate: string;
}

const MOCK_HISTORY: SentEmail[] = [
  { id: 1, subject: "Promoción Black Friday - 50% dto", idea: "Black Friday", status: "enviado", sentDate: "2026-02-28" },
  { id: 2, subject: "Newsletter Febrero 2026", idea: "Newsletter mensual", status: "enviado", sentDate: "2026-02-15" },
  { id: 3, subject: "Bienvenida nuevos suscriptores", idea: "Onboarding", status: "enviado", sentDate: "2026-02-01" },
  { id: 4, subject: "Newsletter - Tendencias de Marzo", idea: "Newsletter semanal", status: "programado", sentDate: "2026-03-22" },
];

const statusConfig = {
  programado: { label: "Programado", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300", icon: CalendarDays },
  enviado: { label: "Enviado", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300", icon: Check },
};

export default function MyEmails() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Historial de Correos</h1>
            <p className="text-muted-foreground mt-1">Registro de correos enviados y programados.</p>
          </div>
          <Link href="/calendar">
            <Button data-testid="button-go-calendar" className="rounded-xl gap-2">
              <CalendarDays className="w-4 h-4" />
              Ir al Calendario
            </Button>
          </Link>
        </div>

        {MOCK_HISTORY.length > 0 ? (
          <div className="space-y-3">
            {MOCK_HISTORY.map((email, i) => {
              const config = statusConfig[email.status];
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  data-testid={`email-history-item-${email.id}`}
                  className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {email.status === "enviado" ? (
                      <Send className="w-5 h-5 text-primary" />
                    ) : (
                      <Clock className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{email.subject}</h3>
                    <p className="text-sm text-muted-foreground">
                      {email.status === "enviado" ? "Enviado" : "Programado para"} el {new Date(email.sentDate).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${config.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {config.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">No hay correos en el historial</h3>
            <p className="text-muted-foreground mb-4">Los correos que envíe o programe aparecerán aquí.</p>
            <Link href="/calendar">
              <Button className="rounded-xl gap-2">
                <CalendarDays className="w-4 h-4" />
                Ir al Calendario
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
