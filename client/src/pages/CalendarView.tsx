import { useState, useRef } from "react";
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
  Type, Eye, ExternalLink, Send, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TipTapEditor } from "@/components/TipTapEditor";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Campaign, CampaignVersion, Template, ContactDatabase } from "@shared/schema";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const STATUS_MAP: Record<string, string> = { draft: "borrador", scheduled: "programado", sent: "enviado" };
const STATUS_REVERSE: Record<string, string> = { borrador: "draft", programado: "scheduled", enviado: "sent" };

function campaignToDateStr(c: Campaign): string {
  if (!c.scheduledAt) return "";
  const d = new Date(c.scheduledAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarView() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [showImageHistory, setShowImageHistory] = useState(false);
  const [showTextHistory, setShowTextHistory] = useState(false);
  const [textEditMode, setTextEditMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [textApproved, setTextApproved] = useState(false);
  const [imageApproved, setImageApproved] = useState(false);
  const [form, setForm] = useState({ idea: "", objective: "", templateId: "", targetDatabase: "", scheduledDate: "", imagePrompt: "" });
  const [imageSourceMode, setImageSourceMode] = useState<"prompt" | "upload" | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [editorLocalImageUrl, setEditorLocalImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: userTemplates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: userDatabases = [] } = useQuery<ContactDatabase[]>({
    queryKey: ["/api/contact-databases"],
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery<CampaignVersion[]>({
    queryKey: ["/api/campaigns", editingCampaignId, "versions"],
    enabled: !!editingCampaignId,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/campaigns", data);
      return res.json();
    },
    onSuccess: (campaign: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setShowNewDialog(false);
      setEditingCampaignId(campaign.id);
      setTextApproved(false);
      setImageApproved(false);
      toast({ title: "Correo creado", description: "Generando contenido..." });
      generateVersionMutation.mutate(campaign.id);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el correo.", variant: "destructive" });
    },
  });

  const generateVersionMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/generate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", editingCampaignId, "versions"] });
      toast({ title: "Versión generada", description: "Nueva versión disponible." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateVersionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/versions/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", editingCampaignId, "versions"] });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/campaigns/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }

  function getCampaignsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return campaigns.filter(c => campaignToDateStr(c) === dateStr);
  }

  function openDay(day: number) {
    setSelectedDay(day);
    const dayCampaigns = getCampaignsForDay(day);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setForm({ idea: "", objective: "", templateId: "", targetDatabase: "", scheduledDate: `${dateStr}T09:00`, imagePrompt: "" });
    setImageSourceMode(null);
    setUploadedImageFile(null);

    if (dayCampaigns.length === 0) {
      setShowNewDialog(true);
    } else {
      setShowChoiceDialog(true);
    }
  }

  function handleCreateNew() {
    setShowChoiceDialog(false);
    setShowNewDialog(true);
  }

  function handleEditCampaign(campaignId: number) {
    setShowChoiceDialog(false);
    setEditingCampaignId(campaignId);
    setShowImageHistory(false);
    setShowTextHistory(false);
    setTextEditMode(false);
    setTextApproved(false);
    setImageApproved(false);
  }

  function handleBackToCalendar() {
    setEditingCampaignId(null);
    setShowImageHistory(false);
    setShowTextHistory(false);
    setTextEditMode(false);
    setShowPreview(false);
    setTextApproved(false);
    setImageApproved(false);
    setEditorLocalImageUrl(null);
  }

  function handlePublishNow() {
    if (!editingCampaignId) return;
    updateCampaignMutation.mutate(
      { id: editingCampaignId, updates: { status: "sent" } },
      {
        onSuccess: () => {
          toast({ title: "Publicación en proceso", description: "Su correo está siendo enviado ahora mismo." });
          handleBackToCalendar();
        },
      }
    );
  }

  function handleGenerate() {
    if (!form.idea.trim()) return;
    createCampaignMutation.mutate({
      name: form.idea,
      idea: form.idea,
      objective: form.objective || "General",
      tone: "profesional",
      imagePrompt: form.imagePrompt || null,
      targetDatabase: form.targetDatabase || null,
      scheduledAt: form.scheduledDate || null,
    });
  }

  function handleRegenerateText() {
    if (!editingCampaignId) return;
    const textVersions = versions.filter(v => v.contentJson && !(v as any).isImageOnly);
    if (textVersions.length >= 3) {
      toast({ title: "Límite alcanzado", description: "Máximo 3 generaciones.", variant: "destructive" });
      return;
    }
    generateVersionMutation.mutate(editingCampaignId);
  }

  function handleSelectVersion(versionId: number) {
    versions.forEach(v => {
      if (v.isSelected && v.id !== versionId) {
        updateVersionMutation.mutate({ id: v.id, updates: { isSelected: false } });
      }
    });
    updateVersionMutation.mutate({ id: versionId, updates: { isSelected: true } });
    setTextApproved(false);
    setImageApproved(false);
  }

  function handleTextChange(versionId: number, newHtml: string) {
    updateVersionMutation.mutate({ id: versionId, updates: { contentJson: { html: newHtml } } });
    setTextApproved(false);
  }

  function handleApproveText() {
    setTextApproved(true);
    setTextEditMode(false);
    toast({ title: "Texto aprobado" });
  }

  function handleApproveImage() {
    setImageApproved(true);
    toast({ title: "Imagen aprobada" });
  }

  const editingCampaign = campaigns.find(c => c.id === editingCampaignId);
  const selectedVersion = versions.find(v => v.isSelected) || versions[0];
  const selectedHtml = selectedVersion?.contentJson
    ? typeof selectedVersion.contentJson === "object" && (selectedVersion.contentJson as any).html
      ? (selectedVersion.contentJson as any).html
      : typeof selectedVersion.contentJson === "object" && (selectedVersion.contentJson as any).body
        ? `<h2>${(selectedVersion.contentJson as any).title || ""}</h2><p>${(selectedVersion.contentJson as any).body}</p>`
        : ""
    : "";
  const selectedImageUrl = editorLocalImageUrl || selectedVersion?.imageUrl || "https://placehold.co/600x300/002073/white?text=Sin+Imagen";

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="aspect-square" />);
  }
  for (let day = 1; day <= totalDays; day++) {
    const dayCampaigns = getCampaignsForDay(day);
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
        {dayCampaigns.length > 0 && (
          <div className="mt-auto w-full">
            {dayCampaigns.slice(0, 2).map((c) => (
              <div key={c.id} className="w-full bg-primary/15 text-primary text-[10px] font-medium rounded px-1 py-0.5 truncate mt-0.5">
                {c.idea}
              </div>
            ))}
            {dayCampaigns.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{dayCampaigns.length - 2} más</span>
            )}
          </div>
        )}
      </motion.button>
    );
  }

  if (editingCampaign) {
    const statusLabel = STATUS_MAP[editingCampaign.status] || editingCampaign.status;

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
              <h1 className="text-2xl md:text-3xl font-extrabold truncate">{editingCampaign.name}</h1>
              <p className="text-sm text-muted-foreground">
                {editingCampaign.scheduledAt ? new Date(editingCampaign.scheduledAt).toLocaleDateString("es") : "Sin fecha"} · {statusLabel}
              </p>
            </div>
            {textApproved && imageApproved && (
              <Button
                data-testid="button-publish-now"
                onClick={handlePublishNow}
                className="rounded-xl gap-2 bg-destructive text-destructive-foreground"
                disabled={updateCampaignMutation.isPending}
              >
                <Send className="w-4 h-4" />
                Publicar Ahora
              </Button>
            )}
          </div>

          {versionsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    Editor de Imagen
                  </h3>
                  {imageApproved && (
                    <span data-testid="badge-image-approved" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Aprobada
                    </span>
                  )}
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-white relative">
                  <img
                    data-testid="img-email-preview"
                    src={selectedImageUrl}
                    alt="Vista previa de imagen"
                    className="w-full h-48 object-cover"
                  />
                  {generateVersionMutation.isPending && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                      <span className="text-white text-sm font-medium">Generando imagen con IA...</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    data-testid="button-regenerate-image"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1"
                    onClick={() => editingCampaignId && generateVersionMutation.mutate(editingCampaignId)}
                    disabled={versions.length >= 3 || generateVersionMutation.isPending}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerar ({Math.max(0, 3 - versions.length)})
                  </Button>
                  <Button
                    data-testid="button-upload-image"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1"
                    onClick={() => editorFileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Cargar Imagen
                  </Button>
                  <input
                    ref={editorFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setEditorLocalImageUrl(url);
                        setImageApproved(false);
                        toast({ title: "Imagen cargada", description: "Vista previa actualizada." });
                      }
                      e.target.value = "";
                    }}
                  />
                  <Button
                    data-testid="button-nano-banana"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Editar con Nano Banana
                  </Button>
                  {versions.length > 1 && (
                    <Button
                      data-testid="button-image-history"
                      variant={showImageHistory ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl gap-1"
                      onClick={() => setShowImageHistory(!showImageHistory)}
                    >
                      <History className="w-3.5 h-3.5" />
                      Imágenes ({versions.length})
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
                        {versions.map(v => (
                          <button
                            key={v.id}
                            data-testid={`button-select-image-${v.versionNumber}`}
                            onClick={() => handleSelectVersion(v.id)}
                            className={`rounded-lg border-2 overflow-hidden transition-all ${v.isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}
                          >
                            <img src={v.imageUrl || "https://placehold.co/600x300/002073/white?text=V" + v.versionNumber} alt={`Versión ${v.versionNumber}`} className="w-full h-16 object-cover" />
                            <span className="text-[10px] font-medium block py-0.5 text-center">V{v.versionNumber}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!imageApproved && (
                  <Button
                    data-testid="button-approve-image"
                    onClick={handleApproveImage}
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
                  {textApproved && (
                    <span data-testid="badge-text-approved" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Aprobado
                    </span>
                  )}
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  {textEditMode && selectedVersion ? (
                    <TipTapEditor
                      content={selectedHtml}
                      onChange={(html) => handleTextChange(selectedVersion.id, html)}
                    />
                  ) : (
                    <div
                      className="p-4 prose prose-sm max-w-none min-h-[200px]"
                      dangerouslySetInnerHTML={{ __html: selectedHtml || "<p class='text-muted-foreground'>Sin contenido generado aún.</p>" }}
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    data-testid="button-regenerate-text"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1"
                    onClick={handleRegenerateText}
                    disabled={versions.length >= 3 || generateVersionMutation.isPending}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerar Texto ({Math.max(0, 3 - versions.length)})
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
                  {versions.length > 1 && (
                    <Button
                      data-testid="button-text-history"
                      variant={showTextHistory ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl gap-1"
                      onClick={() => setShowTextHistory(!showTextHistory)}
                    >
                      <History className="w-3.5 h-3.5" />
                      Seleccionar Textos ({versions.length})
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
                        {versions.map(v => {
                          const html = typeof v.contentJson === "object" && (v.contentJson as any).html
                            ? (v.contentJson as any).html
                            : typeof v.contentJson === "object" && (v.contentJson as any).body
                              ? (v.contentJson as any).body
                              : "";
                          return (
                            <button
                              key={v.id}
                              data-testid={`button-select-text-${v.versionNumber}`}
                              onClick={() => handleSelectVersion(v.id)}
                              className={`w-full p-3 rounded-xl text-left border-2 transition-all text-sm ${v.isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-xs">Versión {v.versionNumber}</span>
                                {v.isSelected && <span className="text-[10px] font-semibold text-primary">Seleccionada</span>}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: html.replace(/<[^>]*>/g, " ").substring(0, 120) }} />
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!textApproved && (
                  <Button
                    data-testid="button-approve-text"
                    onClick={handleApproveText}
                    className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="w-4 h-4" />
                    Aprobar Texto
                  </Button>
                )}
              </div>
            </div>
          )}

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
                          <img src="${selectedImageUrl}" style="width:100%;height:200px;object-fit:cover" />
                          <div style="padding:24px">${selectedHtml}</div>
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

        {campaignsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
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
        )}
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

            {selectedDay && getCampaignsForDay(selectedDay).map(campaign => (
              <Button
                key={campaign.id}
                data-testid={`button-choice-edit-${campaign.id}`}
                variant="outline"
                onClick={() => handleEditCampaign(campaign.id)}
                className="w-full rounded-xl gap-2 justify-start h-auto py-3"
              >
                <Pencil className="w-5 h-5 text-accent" />
                <div className="text-left min-w-0 flex-1">
                  <div className="font-semibold truncate">{campaign.idea}</div>
                  <div className="text-xs text-muted-foreground capitalize">{STATUS_MAP[campaign.status] || campaign.status}</div>
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
              <Label>Imagen del Correo</Label>
              <div className="flex gap-2">
                <Button
                  data-testid="button-image-prompt-toggle"
                  type="button"
                  variant={imageSourceMode === "prompt" ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl gap-1.5 toggle-elevate"
                  onClick={() => {
                    setImageSourceMode(imageSourceMode === "prompt" ? null : "prompt");
                    setUploadedImageFile(null);
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Prompt de Imagen
                </Button>
                <Button
                  data-testid="button-upload-image-toggle"
                  type="button"
                  variant={imageSourceMode === "upload" ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl gap-1.5 toggle-elevate"
                  onClick={() => {
                    setImageSourceMode(imageSourceMode === "upload" ? null : "upload");
                    setForm(f => ({ ...f, imagePrompt: "" }));
                    if (imageSourceMode !== "upload") {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Subir Imagen
                </Button>
                <input
                  ref={fileInputRef}
                  data-testid="input-calendar-upload-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadedImageFile(file);
                    if (file) {
                      setImageSourceMode("upload");
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              <AnimatePresence>
                {imageSourceMode === "prompt" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <Textarea
                      data-testid="input-calendar-image-prompt"
                      placeholder="Ej: Una imagen profesional con colores corporativos mostrando un equipo de trabajo colaborando"
                      value={form.imagePrompt}
                      onChange={e => setForm(f => ({ ...f, imagePrompt: e.target.value }))}
                      className="rounded-xl min-h-[70px] mt-2"
                    />
                  </motion.div>
                )}
                {imageSourceMode === "upload" && uploadedImageFile && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                      <ImageIcon className="w-4 h-4 flex-shrink-0" />
                      <span data-testid="text-uploaded-filename" className="truncate">{uploadedImageFile.name}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="space-y-2">
              <Label>Plantilla</Label>
              <Select value={form.templateId} onValueChange={(v) => setForm(f => ({ ...f, templateId: v }))}>
                <SelectTrigger data-testid="select-calendar-template" className="rounded-xl">
                  <SelectValue placeholder="Seleccione una plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {userTemplates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                  {userTemplates.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No hay plantillas. Créelas en la sección Plantillas.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base de Datos de Destino</Label>
              <Select value={form.targetDatabase} onValueChange={(v) => setForm(f => ({ ...f, targetDatabase: v }))}>
                <SelectTrigger data-testid="select-calendar-database" className="rounded-xl">
                  <SelectValue placeholder="Seleccione una base de datos..." />
                </SelectTrigger>
                <SelectContent>
                  {userDatabases.map(db => (
                    <SelectItem key={db.id} value={String(db.id)}>{db.name}</SelectItem>
                  ))}
                  {userDatabases.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No hay bases de datos. Créelas en Contactos.</div>
                  )}
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
              disabled={!form.idea.trim() || createCampaignMutation.isPending}
            >
              {createCampaignMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generar Correo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
