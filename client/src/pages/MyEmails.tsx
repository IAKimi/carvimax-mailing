import { useState } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Clock, Check, CalendarDays, Send, ArrowRight, Loader2, ChevronDown, Lightbulb, Target, MessageSquare, Database, LayoutTemplate, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Campaign } from "@shared/schema";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: "Programado", color: "bg-blue-100 text-blue-700", icon: CalendarDays },
  sent: { label: "Enviado", color: "bg-emerald-100 text-emerald-700", icon: Check },
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-700", icon: Clock },
};

export default function MyEmails() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const history = campaigns
    .filter(c => c.status === "sent" || c.status === "scheduled")
    .sort((a, b) => {
      const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return dateB - dateA;
    });

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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-3">
            {history.map((campaign, i) => {
              const config = statusConfig[campaign.status] || statusConfig.draft;
              const StatusIcon = config.icon;
              const isExpanded = expandedId === campaign.id;
              const displayDate = campaign.scheduledAt
                ? new Date(campaign.scheduledAt).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
                : "Sin fecha";
              const title = campaign.status === "sent"
                ? `Correo enviado el ${displayDate}`
                : `Correo programado para el ${displayDate}`;

              return (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  data-testid={`email-history-item-${campaign.id}`}
                  className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
                >
                  <button
                    data-testid={`button-expand-${campaign.id}`}
                    onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {campaign.status === "sent" ? (
                        <Send className="w-5 h-5 text-primary" />
                      ) : (
                        <Clock className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{title}</h3>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-0 border-t border-border">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <DetailField icon={Lightbulb} label="Idea" value={campaign.idea} />
                            <DetailField icon={Target} label="Objetivo" value={campaign.objective} />
                            <DetailField icon={MessageSquare} label="Tono" value={campaign.tone} />
                            <DetailField icon={LayoutTemplate} label="Layout" value={campaign.layoutPreference || "Sin especificar"} />
                            {campaign.imagePrompt && (
                              <DetailField icon={Image} label="Prompt de imagen" value={campaign.imagePrompt} />
                            )}
                            {campaign.targetDatabase && (
                              <DetailField icon={Database} label="Base de datos destino" value={campaign.targetDatabase} />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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

function DetailField({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  );
}
