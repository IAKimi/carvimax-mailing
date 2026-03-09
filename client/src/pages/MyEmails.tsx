import { useState } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TipTapEditor } from "@/components/TipTapEditor";
import { Mail, Clock, Send, RefreshCw, Check, ChevronDown, ChevronUp, Eye, Sparkles, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailVersion {
  id: number;
  versionNumber: number;
  html: string;
  isSelected: boolean;
}

interface EmailItem {
  id: number;
  subject: string;
  idea: string;
  status: "borrador" | "programado" | "enviado";
  scheduledDate: string | null;
  versions: EmailVersion[];
  generationsUsed: number;
  createdAt: Date;
}

const MOCK_EMAILS: EmailItem[] = [
  {
    id: 1,
    subject: "Promoción de primavera - 30% descuento",
    idea: "Promoción de primavera con descuentos en toda la tienda",
    status: "borrador",
    scheduledDate: null,
    generationsUsed: 1,
    createdAt: new Date(Date.now() - 86400000),
    versions: [
      {
        id: 1, versionNumber: 1, isSelected: true,
        html: "<h2>Promoción de Primavera</h2><p>Estimado cliente, le invitamos a disfrutar de un <strong>30% de descuento</strong> en toda nuestra tienda. Esta oferta es por tiempo limitado.</p><p>No deje pasar esta oportunidad. Visite nuestra tienda online o presencial.</p><p><strong>¡Le esperamos!</strong></p>"
      }
    ]
  },
  {
    id: 2,
    subject: "Newsletter semanal - Tendencias de marzo",
    idea: "Newsletter con las tendencias del mercado en marzo 2026",
    status: "programado",
    scheduledDate: "2026-03-22",
    generationsUsed: 2,
    createdAt: new Date(Date.now() - 86400000 * 2),
    versions: [
      {
        id: 2, versionNumber: 1, isSelected: false,
        html: "<h2>Tendencias de Marzo</h2><p>Primera versión del newsletter con análisis del mercado.</p>"
      },
      {
        id: 3, versionNumber: 2, isSelected: true,
        html: "<h2>Newsletter - Tendencias de Marzo 2026</h2><p>Le compartimos las principales tendencias que están transformando su industria este mes.</p><ul><li><strong>IA Generativa</strong>: Nuevas aplicaciones en marketing digital</li><li><strong>Sostenibilidad</strong>: Prácticas verdes que impulsan ventas</li><li><strong>Personalización</strong>: El futuro del email marketing</li></ul><p>Lea el artículo completo en nuestro blog.</p>"
      }
    ]
  },
  {
    id: 3,
    subject: "Gracias por su compra",
    idea: "Correo de agradecimiento post-compra",
    status: "enviado",
    scheduledDate: null,
    generationsUsed: 1,
    createdAt: new Date(Date.now() - 86400000 * 5),
    versions: [
      {
        id: 4, versionNumber: 1, isSelected: true,
        html: "<h2>¡Gracias por su compra!</h2><p>Estimado cliente, queremos agradecerle por confiar en nosotros. Su pedido está siendo procesado y le notificaremos cuando esté en camino.</p><p>Si tiene alguna consulta, no dude en contactarnos.</p>"
      }
    ]
  }
];

const statusConfig = {
  borrador: { label: "Borrador", color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300", icon: Clock },
  programado: { label: "Programado", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300", icon: CalendarDays },
  enviado: { label: "Enviado", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300", icon: Check },
};

export default function MyEmails() {
  const { toast } = useToast();
  const [emails, setEmails] = useState<EmailItem[]>(MOCK_EMAILS);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingVersion, setEditingVersion] = useState<{ emailId: number; versionId: number } | null>(null);

  function toggleExpand(id: number) {
    setExpandedId(prev => prev === id ? null : id);
  }

  function selectVersion(emailId: number, versionId: number) {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId) {
        return { ...e, versions: e.versions.map(v => ({ ...v, isSelected: v.id === versionId })) };
      }
      return e;
    }));
  }

  function handleRegenerate(emailId: number) {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId && e.generationsUsed < 3) {
        const newVersion: EmailVersion = {
          id: Date.now(),
          versionNumber: e.generationsUsed + 1,
          html: `<h2>Versión regenerada #${e.generationsUsed + 1}</h2><p>Este es el contenido regenerado por la IA para su correo: <strong>${e.idea}</strong>.</p><p>Puede editar este contenido libremente o regenerar una nueva versión.</p>`,
          isSelected: false
        };
        return {
          ...e,
          generationsUsed: e.generationsUsed + 1,
          versions: [...e.versions, newVersion]
        };
      }
      return e;
    }));
    toast({ title: "Nueva versión generada", description: "Puede ver y editar la nueva versión en el historial." });
  }

  function handleEditorChange(emailId: number, versionId: number, newHtml: string) {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId) {
        return { ...e, versions: e.versions.map(v => v.id === versionId ? { ...v, html: newHtml } : v) };
      }
      return e;
    }));
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold">Mis Correos</h1>
          <p className="text-muted-foreground mt-1">Revise, edite y gestione todos sus correos generados.</p>
        </div>

        <div className="space-y-4">
          {emails.map((email, i) => {
            const isExpanded = expandedId === email.id;
            const selectedVersion = email.versions.find(v => v.isSelected) || email.versions[0];
            const config = statusConfig[email.status];
            const StatusIcon = config.icon;

            return (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                <button
                  data-testid={`button-expand-email-${email.id}`}
                  onClick={() => toggleExpand(email.id)}
                  className="w-full p-5 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="w-20 h-14 rounded-lg border border-border bg-white overflow-hidden flex-shrink-0">
                    <iframe
                      srcDoc={selectedVersion.html}
                      className="w-full h-full pointer-events-none"
                      style={{ transform: "scale(0.25)", transformOrigin: "top left", width: "400%", height: "400%" }}
                      title={email.subject}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{email.subject}</h3>
                    <p className="text-sm text-muted-foreground truncate">{email.idea}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {email.generationsUsed}/3
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-muted-foreground">Versiones:</span>
                          {email.versions.map(v => (
                            <Button
                              key={v.id}
                              data-testid={`button-version-${email.id}-${v.versionNumber}`}
                              variant={v.isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => selectVersion(email.id, v.id)}
                              className="rounded-lg text-xs"
                            >
                              V{v.versionNumber} {v.isSelected && "(Seleccionada)"}
                            </Button>
                          ))}
                          {email.generationsUsed < 3 && (
                            <Button
                              data-testid={`button-regenerate-${email.id}`}
                              variant="outline"
                              size="sm"
                              onClick={() => handleRegenerate(email.id)}
                              className="rounded-lg text-xs gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Regenerar ({3 - email.generationsUsed} restantes)
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                              <Eye className="w-4 h-4" /> Vista Previa
                            </div>
                            <div className="border border-border rounded-xl overflow-hidden bg-white">
                              <iframe
                                srcDoc={`<html><body style="margin:0;padding:16px;font-family:Arial,sans-serif">${selectedVersion.html}</body></html>`}
                                className="w-full h-64"
                                title="preview"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                              <Sparkles className="w-4 h-4" /> Editor
                            </div>
                            <TipTapEditor
                              content={selectedVersion.html}
                              onChange={(html) => handleEditorChange(email.id, selectedVersion.id, html)}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {email.status !== "enviado" && (
                            <>
                              <Button data-testid={`button-schedule-${email.id}`} variant="outline" className="rounded-xl gap-2">
                                <CalendarDays className="w-4 h-4" />
                                Programar
                              </Button>
                              <Button data-testid={`button-send-${email.id}`} className="rounded-xl gap-2">
                                <Send className="w-4 h-4" />
                                Enviar Ahora
                              </Button>
                            </>
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

        {emails.length === 0 && (
          <div className="text-center py-16">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">No hay correos aún</h3>
            <p className="text-muted-foreground">Vaya al Calendario para crear su primer correo.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
