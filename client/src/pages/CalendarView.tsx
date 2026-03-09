import { useState } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, ArrowLeft,
  ImageIcon, Upload, RefreshCw, Check, Pencil, History,
  Type, Eye, ExternalLink, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TipTapEditor } from "@/components/TipTapEditor";

interface TextVersion {
  id: number;
  versionNumber: number;
  html: string;
  isSelected: boolean;
}

interface ImageVersion {
  id: number;
  versionNumber: number;
  url: string;
  isSelected: boolean;
}

interface ScheduledEmail {
  id: number;
  date: string;
  idea: string;
  subject: string;
  objective: string;
  templateId: string;
  scheduledDate: string;
  status: "borrador" | "programado" | "enviado";
  textVersions: TextVersion[];
  imageVersions: ImageVersion[];
  textApproved: boolean;
  imageApproved: boolean;
  textGenerationsUsed: number;
  imageGenerationsUsed: number;
}

const AVAILABLE_TEMPLATES = [
  { id: "1", name: "Promoción Simple" },
  { id: "2", name: "Newsletter Corporativo" },
  { id: "3", name: "Bienvenida al Cliente" },
];

const MOCK_IMAGE_URLS = [
  "https://placehold.co/600x300/002073/white?text=Imagen+v1",
  "https://placehold.co/600x300/003099/white?text=Imagen+v2",
  "https://placehold.co/600x300/e3001b/white?text=Imagen+v3",
];

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const INITIAL_EMAILS: ScheduledEmail[] = [
  {
    id: 1, date: "2026-03-15", idea: "Promoción de primavera", subject: "Promoción de primavera - 30% descuento",
    objective: "Aumentar ventas", templateId: "1", scheduledDate: "2026-03-15", status: "borrador",
    textVersions: [
      { id: 1, versionNumber: 1, isSelected: true, html: "<h2>Promoción de Primavera</h2><p>Estimado cliente, le invitamos a disfrutar de un <strong>30% de descuento</strong> en toda nuestra tienda. Esta oferta es por tiempo limitado.</p><p>No deje pasar esta oportunidad.</p><p><strong>¡Le esperamos!</strong></p>" }
    ],
    imageVersions: [
      { id: 1, versionNumber: 1, url: MOCK_IMAGE_URLS[0], isSelected: true }
    ],
    textApproved: false, imageApproved: false, textGenerationsUsed: 1, imageGenerationsUsed: 1
  },
  {
    id: 2, date: "2026-03-22", idea: "Newsletter semanal", subject: "Newsletter - Tendencias de Marzo",
    objective: "Informar clientes", templateId: "2", scheduledDate: "2026-03-22", status: "programado",
    textVersions: [
      { id: 2, versionNumber: 1, isSelected: false, html: "<h2>Tendencias de Marzo</h2><p>Primera versión del newsletter.</p>" },
      { id: 3, versionNumber: 2, isSelected: true, html: "<h2>Newsletter - Tendencias de Marzo 2026</h2><p>Le compartimos las principales tendencias que están transformando su industria.</p><ul><li><strong>IA Generativa</strong>: Nuevas aplicaciones</li><li><strong>Sostenibilidad</strong>: Prácticas verdes</li></ul>" }
    ],
    imageVersions: [
      { id: 2, versionNumber: 1, url: MOCK_IMAGE_URLS[0], isSelected: false },
      { id: 3, versionNumber: 2, url: MOCK_IMAGE_URLS[1], isSelected: true }
    ],
    textApproved: true, imageApproved: false, textGenerationsUsed: 2, imageGenerationsUsed: 2
  },
];

export default function CalendarView() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [showImageHistory, setShowImageHistory] = useState(false);
  const [showTextHistory, setShowTextHistory] = useState(false);
  const [textEditMode, setTextEditMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [emails, setEmails] = useState<ScheduledEmail[]>(INITIAL_EMAILS);
  const [form, setForm] = useState({ idea: "", objective: "", templateId: "", scheduledDate: "" });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }

  function getEmailsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return emails.filter(e => e.date === dateStr);
  }

  function openDay(day: number) {
    setSelectedDay(day);
    const dayEmails = getEmailsForDay(day);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setForm({ idea: "", objective: "", templateId: "", scheduledDate: `${dateStr}T09:00` });

    if (dayEmails.length === 0) {
      setShowNewDialog(true);
    } else {
      setShowChoiceDialog(true);
    }
  }

  function handleCreateNew() {
    setShowChoiceDialog(false);
    setShowNewDialog(true);
  }

  function handleEditEmail(emailId: number) {
    setShowChoiceDialog(false);
    setEditingEmailId(emailId);
    setShowImageHistory(false);
    setShowTextHistory(false);
    setTextEditMode(false);
  }

  function handleBackToCalendar() {
    setEditingEmailId(null);
    setShowImageHistory(false);
    setShowTextHistory(false);
    setTextEditMode(false);
    setShowPreview(false);
  }

  function handlePublishNow() {
    toast({ title: "Publicación en proceso", description: "Su correo está siendo enviado ahora mismo." });
  }

  function handleGenerate() {
    if (!form.idea.trim()) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay!).padStart(2, "0")}`;
    const newEmail: ScheduledEmail = {
      id: Date.now(),
      date: dateStr,
      idea: form.idea,
      subject: form.idea,
      objective: form.objective,
      templateId: form.templateId,
      scheduledDate: form.scheduledDate || dateStr,
      status: "borrador",
      textVersions: [
        { id: Date.now(), versionNumber: 1, isSelected: true, html: `<h2>${form.idea}</h2><p>Contenido generado por IA basado en su idea: <strong>${form.idea}</strong>.</p><p>Objetivo: ${form.objective || "No especificado"}.</p><p>Puede editar este texto libremente.</p>` }
      ],
      imageVersions: [
        { id: Date.now() + 1, versionNumber: 1, url: MOCK_IMAGE_URLS[0], isSelected: true }
      ],
      textApproved: false,
      imageApproved: false,
      textGenerationsUsed: 1,
      imageGenerationsUsed: 1,
    };
    setEmails(prev => [...prev, newEmail]);
    setShowNewDialog(false);
    setEditingEmailId(newEmail.id);
    toast({ title: "Correo creado", description: "Ahora puede editar el contenido de su correo." });
  }

  function handleRegenerateImage(emailId: number) {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId && e.imageGenerationsUsed < 3) {
        const newVer: ImageVersion = {
          id: Date.now(),
          versionNumber: e.imageGenerationsUsed + 1,
          url: MOCK_IMAGE_URLS[e.imageGenerationsUsed % MOCK_IMAGE_URLS.length],
          isSelected: false,
        };
        return { ...e, imageGenerationsUsed: e.imageGenerationsUsed + 1, imageVersions: [...e.imageVersions, newVer], imageApproved: false };
      }
      return e;
    }));
    toast({ title: "Imagen regenerada", description: "Nueva versión de imagen disponible." });
  }

  function handleSelectImage(emailId: number, imageId: number) {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId) {
        return { ...e, imageVersions: e.imageVersions.map(v => ({ ...v, isSelected: v.id === imageId })), imageApproved: false };
      }
      return e;
    }));
  }

  function handleApproveImage(emailId: number) {
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, imageApproved: true } : e));
    toast({ title: "Imagen aprobada" });
  }

  function handleRegenerateText(emailId: number) {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId && e.textGenerationsUsed < 3) {
        const newVer: TextVersion = {
          id: Date.now(),
          versionNumber: e.textGenerationsUsed + 1,
          html: `<h2>Versión ${e.textGenerationsUsed + 1} - ${e.idea}</h2><p>Contenido regenerado por IA. Esta es la versión número ${e.textGenerationsUsed + 1} del texto para su correo.</p><p>Puede seguir editando o aprobar esta versión.</p>`,
          isSelected: false,
        };
        return { ...e, textGenerationsUsed: e.textGenerationsUsed + 1, textVersions: [...e.textVersions, newVer], textApproved: false };
      }
      return e;
    }));
    toast({ title: "Texto regenerado", description: "Nueva versión de texto disponible." });
  }

  function handleSelectText(emailId: number, textId: number) {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId) {
        return { ...e, textVersions: e.textVersions.map(v => ({ ...v, isSelected: v.id === textId })), textApproved: false };
      }
      return e;
    }));
  }

  function handleApproveText(emailId: number) {
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, textApproved: true } : e));
    setTextEditMode(false);
    toast({ title: "Texto aprobado" });
  }

  function handleTextChange(emailId: number, versionId: number, newHtml: string) {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId) {
        return { ...e, textVersions: e.textVersions.map(v => v.id === versionId ? { ...v, html: newHtml } : v), textApproved: false };
      }
      return e;
    }));
  }

  const editingEmail = emails.find(e => e.id === editingEmailId);

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="aspect-square" />);
  }
  for (let day = 1; day <= totalDays; day++) {
    const dayEmails = getEmailsForDay(day);
    const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
    calendarCells.push(
      <motion.button
        key={day}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => openDay(day)}
        data-testid={`calendar-day-${day}`}
        className={`
          aspect-square rounded-xl border border-border p-1.5 flex flex-col items-start justify-start
          text-sm transition-all duration-200 relative
          ${isToday ? "bg-primary/10 border-primary/30 font-bold" : "bg-card hover:border-primary/30 hover:shadow-sm"}
        `}
      >
        <span className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>{day}</span>
        {dayEmails.length > 0 && (
          <div className="mt-auto w-full">
            {dayEmails.slice(0, 2).map((e) => (
              <div key={e.id} className="w-full bg-primary/15 text-primary text-[10px] font-medium rounded px-1 py-0.5 truncate mt-0.5">
                {e.idea}
              </div>
            ))}
            {dayEmails.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{dayEmails.length - 2} más</span>
            )}
          </div>
        )}
      </motion.button>
    );
  }

  if (editingEmail) {
    const selectedText = editingEmail.textVersions.find(v => v.isSelected) || editingEmail.textVersions[0];
    const selectedImage = editingEmail.imageVersions.find(v => v.isSelected) || editingEmail.imageVersions[0];

    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Button
              data-testid="button-back-to-calendar"
              variant="ghost"
              onClick={handleBackToCalendar}
              className="rounded-xl gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al Calendario
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-extrabold truncate">{editingEmail.subject}</h1>
              <p className="text-sm text-muted-foreground">{editingEmail.date} · {editingEmail.status}</p>
            </div>
            {editingEmail.textApproved && editingEmail.imageApproved && (
              <Button
                data-testid="button-publish-now"
                onClick={handlePublishNow}
                className="rounded-xl gap-2 bg-destructive text-destructive-foreground"
              >
                <Send className="w-4 h-4" />
                Publicar Ahora
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Editor de Imagen
                </h3>
                {editingEmail.imageApproved && (
                  <span data-testid="badge-image-approved" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Aprobada
                  </span>
                )}
              </div>

              <div className="border border-border rounded-xl overflow-hidden bg-white dark:bg-black/20">
                <img
                  data-testid="img-email-preview"
                  src={selectedImage.url}
                  alt="Vista previa de imagen"
                  className="w-full h-48 object-cover"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  data-testid="button-regenerate-image"
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1"
                  onClick={() => handleRegenerateImage(editingEmail.id)}
                  disabled={editingEmail.imageGenerationsUsed >= 3}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerar ({3 - editingEmail.imageGenerationsUsed})
                </Button>
                <Button
                  data-testid="button-upload-image"
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Cargar Imagen
                </Button>
                <Button
                  data-testid="button-nano-banana"
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Editar con Nano Banana
                </Button>
                {editingEmail.imageVersions.length > 1 && (
                  <Button
                    data-testid="button-image-history"
                    variant={showImageHistory ? "default" : "outline"}
                    size="sm"
                    className="rounded-xl gap-1"
                    onClick={() => setShowImageHistory(!showImageHistory)}
                  >
                    <History className="w-3.5 h-3.5" />
                    Imágenes ({editingEmail.imageVersions.length})
                  </Button>
                )}
              </div>

              <AnimatePresence>
                {showImageHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                      {editingEmail.imageVersions.map(v => (
                        <button
                          key={v.id}
                          data-testid={`button-select-image-${v.versionNumber}`}
                          onClick={() => handleSelectImage(editingEmail.id, v.id)}
                          className={`rounded-lg border-2 overflow-hidden transition-all ${v.isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}
                        >
                          <img src={v.url} alt={`Versión ${v.versionNumber}`} className="w-full h-16 object-cover" />
                          <span className="text-[10px] font-medium block py-0.5 text-center">V{v.versionNumber}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!editingEmail.imageApproved && (
                <Button
                  data-testid="button-approve-image"
                  onClick={() => handleApproveImage(editingEmail.id)}
                  className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="w-4 h-4" />
                  Aprobar Imagen
                </Button>
              )}
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary" />
                  Editor de Texto
                </h3>
                {editingEmail.textApproved && (
                  <span data-testid="badge-text-approved" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Aprobado
                  </span>
                )}
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                {textEditMode ? (
                  <TipTapEditor
                    content={selectedText.html}
                    onChange={(html) => handleTextChange(editingEmail.id, selectedText.id, html)}
                  />
                ) : (
                  <div
                    className="p-4 prose prose-sm max-w-none dark:prose-invert min-h-[200px]"
                    dangerouslySetInnerHTML={{ __html: selectedText.html }}
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  data-testid="button-regenerate-text"
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1"
                  onClick={() => handleRegenerateText(editingEmail.id)}
                  disabled={editingEmail.textGenerationsUsed >= 3}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerar Texto ({3 - editingEmail.textGenerationsUsed})
                </Button>
                <Button
                  data-testid="button-edit-text-toggle"
                  variant={textEditMode ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl gap-1"
                  onClick={() => setTextEditMode(!textEditMode)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {textEditMode ? "Ver Resultado" : "Editar Texto"}
                </Button>
                {editingEmail.textVersions.length > 1 && (
                  <Button
                    data-testid="button-text-history"
                    variant={showTextHistory ? "default" : "outline"}
                    size="sm"
                    className="rounded-xl gap-1"
                    onClick={() => setShowTextHistory(!showTextHistory)}
                  >
                    <History className="w-3.5 h-3.5" />
                    Seleccionar Textos ({editingEmail.textVersions.length})
                  </Button>
                )}
              </div>

              <AnimatePresence>
                {showTextHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-2 border-t border-border">
                      {editingEmail.textVersions.map(v => (
                        <button
                          key={v.id}
                          data-testid={`button-select-text-${v.versionNumber}`}
                          onClick={() => handleSelectText(editingEmail.id, v.id)}
                          className={`w-full p-3 rounded-xl text-left border-2 transition-all text-sm ${v.isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs">Versión {v.versionNumber}</span>
                            {v.isSelected && <span className="text-[10px] font-semibold text-primary">Seleccionada</span>}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: v.html.replace(/<[^>]*>/g, " ").substring(0, 120) }} />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!editingEmail.textApproved && (
                <Button
                  data-testid="button-approve-text"
                  onClick={() => handleApproveText(editingEmail.id)}
                  className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="w-4 h-4" />
                  Aprobar Texto
                </Button>
              )}
            </div>
          </div>

          <Button
            data-testid="button-toggle-preview"
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full rounded-xl gap-2"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Ocultar Vista Previa" : "Vista Previa"}
          </Button>

          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <h3 className="font-bold flex items-center gap-2 mb-4">
                    <Eye className="w-4 h-4 text-primary" />
                    Vista Previa del Correo
                  </h3>
                  <div className="border border-border rounded-xl overflow-hidden bg-white">
                    <iframe
                      data-testid="iframe-email-preview"
                      srcDoc={`<html><body style="margin:0;font-family:Arial,sans-serif">
                        <div style="max-width:600px;margin:0 auto">
                          <img src="${selectedImage.url}" style="width:100%;height:200px;object-fit:cover" />
                          <div style="padding:24px">${selectedText.html}</div>
                          <div style="padding:16px 24px;background:#f9fafb;text-align:center;font-size:12px;color:#9ca3af">© 2026 Mi Empresa. Todos los derechos reservados.</div>
                        </div>
                      </body></html>`}
                      className="w-full h-[400px]"
                      title="Vista previa completa"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold">Calendario</h1>
          <p className="text-muted-foreground mt-1">Haga clic en un día para programar un nuevo correo o editar uno existente.</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <Button data-testid="button-prev-month" variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold">{MONTHS[month]} {year}</h2>
            <Button data-testid="button-next-month" variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells}
          </div>
        </div>
      </div>

      <Dialog open={showChoiceDialog} onOpenChange={setShowChoiceDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedDay} de {MONTHS[month]} {year}
            </DialogTitle>
            <DialogDescription>
              Elija qué desea hacer con esta fecha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Button
              data-testid="button-choice-new"
              variant="outline"
              onClick={handleCreateNew}
              className="w-full rounded-xl gap-2 justify-start h-auto py-3"
            >
              <Plus className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="font-semibold">Nuevo Correo</div>
                <div className="text-xs text-muted-foreground">Crear un correo nuevo para esta fecha</div>
              </div>
            </Button>

            {selectedDay && getEmailsForDay(selectedDay).map(email => (
              <Button
                key={email.id}
                data-testid={`button-choice-edit-${email.id}`}
                variant="outline"
                onClick={() => handleEditEmail(email.id)}
                className="w-full rounded-xl gap-2 justify-start h-auto py-3"
              >
                <Pencil className="w-5 h-5 text-accent" />
                <div className="text-left min-w-0 flex-1">
                  <div className="font-semibold truncate">{email.idea}</div>
                  <div className="text-xs text-muted-foreground capitalize">{email.status}</div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="w-5 h-5 text-primary" />
              Nuevo Correo — {selectedDay} de {MONTHS[month]} {year}
            </DialogTitle>
            <DialogDescription>
              Complete los datos para generar su correo con IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 mt-3">
            <div className="space-y-2">
              <Label>Idea / Tema</Label>
              <Textarea
                data-testid="input-calendar-idea"
                placeholder="Ej: Promoción de verano con 30% de descuento en todo el catálogo"
                value={form.idea}
                onChange={e => setForm(f => ({ ...f, idea: e.target.value }))}
                className="rounded-xl min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Textarea
                data-testid="input-calendar-objective"
                placeholder="Ej: Aumentar ventas del catálogo nuevo, generar tráfico al sitio web"
                value={form.objective}
                onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                className="rounded-xl min-h-[70px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Plantilla</Label>
              <Select value={form.templateId} onValueChange={(v) => setForm(f => ({ ...f, templateId: v }))}>
                <SelectTrigger data-testid="select-calendar-template" className="rounded-xl">
                  <SelectValue placeholder="Seleccione una plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha y Hora de Programación</Label>
              <Input
                data-testid="input-calendar-date"
                type="datetime-local"
                value={form.scheduledDate}
                onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <Button
              data-testid="button-generate-email"
              onClick={handleGenerate}
              className="w-full rounded-xl gap-2"
              size="lg"
              disabled={!form.idea.trim()}
            >
              <Sparkles className="w-4 h-4" />
              Generar Correo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
