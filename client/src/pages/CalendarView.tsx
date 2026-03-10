import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCell } from "@/components/CalendarCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, ArrowLeft,
  ImageIcon, Upload, RefreshCw, Check, Pencil, History,
  Type, Eye, Wand2, Send, Loader2, XCircle, Ban,
  FileText, CheckCircle2, AlertTriangle, Link2
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { TipTapEditor } from "@/components/TipTapEditor";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Campaign, CampaignVersion, Template, ContactDatabase } from "@shared/schema";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const STATUS_MAP: Record<string, string> = { draft: "borrador", scheduled: "programado", sent: "enviado", cancelled: "cancelado" };
const STATUS_REVERSE: Record<string, string> = { borrador: "draft", programado: "scheduled", enviado: "sent", cancelado: "cancelled" };

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
  const [showPreview, setShowPreview] = useState(false);
  const [textApproved, setTextApproved] = useState(false);
  const [imageApproved, setImageApproved] = useState(false);
  const [form, setForm] = useState({ idea: "", objective: "", templateId: "", targetDatabase: "", scheduledDate: "", imagePrompt: "" });
  const [imageSourceMode, setImageSourceMode] = useState<"prompt" | "upload" | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [editorLocalImageUrl, setEditorLocalImageUrl] = useState<string | null>(null);
  const [showRegenTextModal, setShowRegenTextModal] = useState(false);
  const [showRegenImageModal, setShowRegenImageModal] = useState(false);
  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [showFinalPreview, setShowFinalPreview] = useState(false);
  const [finalPreviewHtml, setFinalPreviewHtml] = useState("");
  const [finalPreviewMissing, setFinalPreviewMissing] = useState<string[]>([]);
  const [finalPreviewLoading, setFinalPreviewLoading] = useState(false);
  const [showEditorTemplateSelector, setShowEditorTemplateSelector] = useState(false);
  const [regenTextCorrections, setRegenTextCorrections] = useState("");
  const [regenImagePrompt, setRegenImagePrompt] = useState("");
  const [editImagePrompt, setEditImagePrompt] = useState("");
  const [lastTextCorrections, setLastTextCorrections] = useState("");
  const [localAsunto, setLocalAsunto] = useState("");
  const [localPreheader, setLocalPreheader] = useState("");
  const [localCta, setLocalCta] = useState("");
  const [localCtaUrl, setLocalCtaUrl] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
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

  const regenerateTextMutation = useMutation({
    mutationFn: async ({ campaignId, corrections }: { campaignId: number; corrections: string }) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/regenerate-text`, { corrections });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", editingCampaignId, "versions"] });
      setShowRegenTextModal(false);
      setLastTextCorrections(regenTextCorrections);
      setRegenTextCorrections("");
      toast({ title: "Texto regenerado", description: "Nueva versión de texto disponible." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const regenerateImageMutation = useMutation({
    mutationFn: async ({ campaignId, imagePrompt }: { campaignId: number; imagePrompt: string }) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/regenerate-image`, { imagePrompt });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", editingCampaignId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setShowRegenImageModal(false);
      setRegenImagePrompt("");
      setEditorLocalImageUrl(null);
      setImageApproved(false);
      toast({ title: "Imagen regenerada", description: "Nueva versión de imagen disponible." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const editImageMutation = useMutation({
    mutationFn: async ({ campaignId, editPrompt }: { campaignId: number; editPrompt: string }) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/edit-image`, { editPrompt });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", editingCampaignId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setShowEditImageModal(false);
      setEditImagePrompt("");
      setEditorLocalImageUrl(null);
      setImageApproved(false);
      toast({ title: "Imagen editada", description: "Nueva versión con edición disponible." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
    setTextApproved(false);
    setImageApproved(false);
    setHasUnsavedChanges(false);
  }

  function handleBackToCalendar() {
    setEditingCampaignId(null);
    setShowImageHistory(false);
    setShowTextHistory(false);
    setShowPreview(false);
    setShowFinalPreview(false);
    setTextApproved(false);
    setImageApproved(false);
    setEditorLocalImageUrl(null);
    setHasUnsavedChanges(false);
    setShowEditorTemplateSelector(false);
  }

  async function handleFinalPreview() {
    if (!editingCampaignId) return;
    setFinalPreviewLoading(true);
    try {
      const res = await apiRequest("GET", `/api/campaigns/${editingCampaignId}/preview-final`);
      const data = await res.json();
      setFinalPreviewHtml(data.html);
      setFinalPreviewMissing(data.missingFields || []);
      setShowFinalPreview(true);
    } catch (err: any) {
      const msg = err?.message || "No se pudo generar la vista previa final.";
      toast({ title: "Vista previa no disponible", description: msg, variant: "destructive" });
    } finally {
      setFinalPreviewLoading(false);
    }
  }

  function handleAssignTemplate(templateId: string) {
    if (!editingCampaignId) return;
    const tid = templateId ? parseInt(templateId) : null;
    updateCampaignMutation.mutate(
      { id: editingCampaignId, updates: { templateId: tid } },
      {
        onSuccess: () => {
          toast({ title: "Plantilla asignada", description: "La plantilla ha sido vinculada a este correo." });
          setShowEditorTemplateSelector(false);
        },
      }
    );
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

  function handleCancelCampaign() {
    if (!editingCampaignId) return;
    updateCampaignMutation.mutate(
      { id: editingCampaignId, updates: { status: "cancelled" } },
      {
        onSuccess: () => {
          toast({ title: "Correo cancelado", description: "El correo ha sido marcado como cancelado." });
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
      templateId: form.templateId ? parseInt(form.templateId) : null,
      scheduledAt: form.scheduledDate || null,
    });
  }

  function handleRegenerateText() {
    if (!editingCampaignId) return;
    if (versions.length >= 3) {
      toast({ title: "Límite alcanzado", description: "Máximo 3 generaciones.", variant: "destructive" });
      return;
    }
    setRegenTextCorrections("");
    setShowRegenTextModal(true);
  }

  function handleRegenerateImage() {
    if (!editingCampaignId) return;
    if (versions.length >= 3) {
      toast({ title: "Límite alcanzado", description: "Máximo 3 generaciones.", variant: "destructive" });
      return;
    }
    setRegenImagePrompt(editingCampaign?.imagePrompt || "");
    setShowRegenImageModal(true);
  }

  function handleEditWithNanoBanana() {
    if (!editingCampaignId) return;
    if (versions.length >= 3) {
      toast({ title: "Límite alcanzado", description: "Máximo 3 generaciones.", variant: "destructive" });
      return;
    }
    setEditImagePrompt("");
    setShowEditImageModal(true);
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
    const version = versions.find(v => v.id === versionId);
    const existing = (version?.contentJson as any) || {};
    const updatedContent = existing.cuerpo_html !== undefined
      ? { ...existing, cuerpo_html: newHtml }
      : { ...existing, html: newHtml };
    updateVersionMutation.mutate({ id: versionId, updates: { contentJson: updatedContent } });
    setTextApproved(false);
  }

  function handleApproveText() {
    if (hasUnsavedChanges && selectedVersion) {
      const existing = (selectedVersion.contentJson as any) || {};
      const updatedContent = {
        ...existing,
        asunto: localAsunto,
        preheader: localPreheader,
        cta_text: localCta,
        cta_url: localCtaUrl,
      };
      updateVersionMutation.mutate(
        { id: selectedVersion.id, updates: { contentJson: updatedContent } },
        {
          onSuccess: () => {
            setHasUnsavedChanges(false);
            setTextApproved(true);
            toast({ title: "Texto aprobado" });
          },
          onError: () => {
            toast({ title: "Error", description: "No se pudo guardar antes de aprobar.", variant: "destructive" });
          },
        }
      );
    } else {
      setTextApproved(true);
      toast({ title: "Texto aprobado" });
    }
  }

  function handleApproveImage() {
    setImageApproved(true);
    toast({ title: "Imagen aprobada" });
  }

  const editingCampaign = campaigns.find(c => c.id === editingCampaignId);
  const selectedVersion = versions.find(v => v.isSelected) || versions[0];
  const contentData = selectedVersion?.contentJson as any;
  const selectedAsunto = contentData?.asunto || contentData?.title || "";
  const selectedPreheader = contentData?.preheader || "";
  const selectedCtaText = contentData?.cta_text || contentData?.cta || "Ver más";
  const selectedHtml = contentData
    ? contentData.cuerpo_html
      ? contentData.cuerpo_html
      : contentData.html
        ? contentData.html
        : contentData.body
          ? `<p>${contentData.body}</p>`
          : ""
    : "";
  const selectedImageUrl = editorLocalImageUrl || selectedVersion?.imageUrl || "https://placehold.co/600x300/002073/white?text=Sin+Imagen";

  useEffect(() => {
    if (selectedVersion) {
      const cd = selectedVersion.contentJson as any;
      setLocalAsunto(cd?.asunto || cd?.title || "");
      setLocalPreheader(cd?.preheader || "");
      setLocalCta(cd?.cta_text || cd?.cta || "");
      setLocalCtaUrl(cd?.cta_url || "");
      setHasUnsavedChanges(false);
    } else {
      setLocalAsunto("");
      setLocalPreheader("");
      setLocalCta("");
      setLocalCtaUrl("");
      setHasUnsavedChanges(false);
    }
  }, [selectedVersion?.id]);

  function handleSaveTextChanges() {
    if (!selectedVersion) return;
    const existing = (selectedVersion.contentJson as any) || {};
    const updatedContent = {
      ...existing,
      asunto: localAsunto,
      preheader: localPreheader,
      cta_text: localCta,
      cta_url: localCtaUrl,
    };
    updateVersionMutation.mutate(
      { id: selectedVersion.id, updates: { contentJson: updatedContent } },
      {
        onSuccess: () => {
          setHasUnsavedChanges(false);
          setTextApproved(false);
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2000);
          toast({ title: "Cambios guardados" });
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudieron guardar los cambios.", variant: "destructive" });
        },
      }
    );
  }

  const campaignsByDay = useMemo(() => {
    const map: Record<number, Campaign[]> = {};
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      map[day] = campaigns.filter(c => campaignToDateStr(c) === dateStr);
    }
    return map;
  }, [campaigns, year, month, totalDays]);

  const handleDayClick = useCallback((day: number) => {
    openDay(day);
  }, [campaigns, year, month]);

  const todayDay = new Date().getDate();
  const todayMonth = new Date().getMonth();
  const todayYear = new Date().getFullYear();

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="aspect-square" />);
  }
  for (let day = 1; day <= totalDays; day++) {
    const isToday = todayDay === day && todayMonth === month && todayYear === year;
    calendarCells.push(
      <CalendarCell
        key={day}
        day={day}
        isToday={isToday}
        campaigns={campaignsByDay[day] || []}
        onDayClick={handleDayClick}
      />
    );
  }

  if (editingCampaign) {
    const isCancelled = editingCampaign.status === "cancelled";
    const isSent = editingCampaign.status === "sent";
    const isGenerated = versions.length > 0;
    const isReady = imageApproved && textApproved;

    const statusTags: Array<{ label: string; className: string }> = [];
    if (isCancelled) {
      statusTags.push({ label: "Cancelado", className: "bg-red-100 text-red-700" });
    } else {
      if (isSent) statusTags.push({ label: "Enviado", className: "bg-emerald-100 text-emerald-700" });
      if (isReady && !isSent) statusTags.push({ label: "Listo", className: "bg-green-100 text-green-700" });
      if (isGenerated && !isSent) statusTags.push({ label: "Generado", className: "bg-indigo-100 text-indigo-700" });
      if (editingCampaign.status === "scheduled") statusTags.push({ label: "Programado", className: "bg-blue-100 text-blue-700" });
      if (editingCampaign.status === "draft") statusTags.push({ label: "Borrador", className: "bg-gray-100 text-gray-600" });
    }

    const progressPercent = isCancelled || isSent ? -1 : (imageApproved ? 50 : 0) + (textApproved ? 50 : 0);

    return (
      <Layout>
        <div className="space-y-4">
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 data-testid="text-editor-title" className="text-2xl md:text-3xl font-extrabold truncate">{selectedAsunto || editingCampaign.name}</h1>
                {statusTags.map((tag) => (
                  <span key={tag.label} data-testid={`tag-status-${tag.label.toLowerCase()}`} className={`text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${tag.className}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {editingCampaign.scheduledAt ? new Date(editingCampaign.scheduledAt).toLocaleDateString("es") : "Sin fecha"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isCancelled && !isSent && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      data-testid="button-cancel-campaign"
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={updateCampaignMutation.isPending}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancelar Correo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cancelar este correo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        El correo será marcado como cancelado. No se eliminará, pero no podrá ser editado ni enviado. Solo un administrador podrá eliminarlo definitivamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">No, mantener</AlertDialogCancel>
                      <AlertDialogAction
                        data-testid="button-confirm-cancel"
                        onClick={handleCancelCampaign}
                        className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
                      >
                        Sí, cancelar correo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {textApproved && imageApproved && !isCancelled && (
                <Button
                  data-testid="button-publish-now"
                  onClick={handlePublishNow}
                  className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={updateCampaignMutation.isPending}
                >
                  <Send className="w-4 h-4" />
                  Publicar Ahora
                </Button>
              )}
            </div>
          </div>

          {isCancelled && (
            <div data-testid="banner-cancelled" className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-700">Este correo ha sido cancelado. No se puede editar ni enviar.</p>
            </div>
          )}

          {progressPercent >= 0 && (
            <div data-testid="progress-bar-container" className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  data-testid="progress-bar-fill"
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    progressPercent === 100 ? "bg-green-500" : progressPercent > 0 ? "bg-amber-400" : ""
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span data-testid="text-progress-label" className={`text-xs font-semibold min-w-[60px] text-right ${
                progressPercent === 100 ? "text-green-600" : progressPercent > 0 ? "text-amber-600" : "text-gray-400"
              }`}>
                Progreso: {progressPercent}%
              </span>
            </div>
          )}

          {!isCancelled && !isSent && (
            <div data-testid="section-template-link" className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Link2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-semibold">Plantilla</span>
                    {editingCampaign?.templateId ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span data-testid="text-template-name" className="text-xs text-muted-foreground truncate">
                          {userTemplates.find(t => t.id === editingCampaign.templateId)?.name || "Plantilla #" + editingCampaign.templateId}
                        </span>
                        {(() => {
                          const tpl = userTemplates.find(t => t.id === editingCampaign.templateId);
                          if (!tpl) return null;
                          return tpl.hasAllPlaceholders ? (
                            <span data-testid="badge-template-compatible" className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-1.5 py-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Compatible
                            </span>
                          ) : (
                            <span data-testid="badge-template-incomplete" className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Incompleta
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-0.5">Sin plantilla. Seleccione una para generar el correo final.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    data-testid="button-change-template"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5 text-xs"
                    onClick={() => setShowEditorTemplateSelector(true)}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {editingCampaign?.templateId ? "Cambiar" : "Seleccionar"}
                  </Button>
                  {editingCampaign?.templateId && (
                    <Button
                      data-testid="button-final-preview"
                      size="sm"
                      className="rounded-xl gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleFinalPreview}
                      disabled={finalPreviewLoading}
                    >
                      {finalPreviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      Vista Previa Final
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {(generateVersionMutation.isPending || createCampaignMutation.isPending) ? (
            <div data-testid="overlay-generating" className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-foreground">Generando tu correo con IA...</p>
                <p className="text-sm text-muted-foreground">Estamos creando la imagen y el texto. Esto puede tardar unos segundos.</p>
              </div>
            </div>
          ) : versionsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-primary" />
                      Imagen
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
                    {(regenerateImageMutation.isPending || editImageMutation.isPending) && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                        <span className="text-white text-sm font-medium">
                          {editImageMutation.isPending ? "Editando imagen con Nano Banana..." : "Generando imagen con IA..."}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      data-testid="button-regenerate-image"
                      size="sm"
                      className="rounded-xl gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleRegenerateImage}
                      disabled={isCancelled || versions.length >= 3 || regenerateImageMutation.isPending || generateVersionMutation.isPending}
                    >
                      {regenerateImageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Regenerar ({Math.max(0, 3 - versions.length)})
                    </Button>
                    <Button
                      data-testid="button-upload-image"
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1 border-slate-300 hover:bg-slate-50"
                      disabled={isCancelled}
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
                      size="sm"
                      className="rounded-xl gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={handleEditWithNanoBanana}
                      disabled={isCancelled || versions.length >= 3 || editImageMutation.isPending || !selectedVersion?.imageUrl || !!editorLocalImageUrl}
                    >
                      {editImageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      Nano Banana
                    </Button>
                  </div>

                  {versions.length > 1 && (
                    <Button
                      data-testid="button-image-history"
                      variant={showImageHistory ? "default" : "secondary"}
                      size="sm"
                      className="rounded-xl gap-1 w-full"
                      onClick={() => setShowImageHistory(!showImageHistory)}
                    >
                      <History className="w-3.5 h-3.5" />
                      Imágenes ({versions.length})
                    </Button>
                  )}

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
                              onClick={() => !isCancelled && handleSelectVersion(v.id)}
                              disabled={isCancelled}
                              className={`rounded-lg border-2 overflow-hidden transition-all ${v.isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"} ${isCancelled ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <img src={v.imageUrl || "https://placehold.co/600x300/002073/white?text=V" + v.versionNumber} alt={`Versión ${v.versionNumber}`} className="w-full h-16 object-cover" />
                              <span className="text-[10px] font-medium block py-0.5 text-center">V{v.versionNumber}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!imageApproved && !isCancelled && (
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

                <div className="space-y-4 relative">
                  {regenerateTextMutation.isPending && (
                    <div className="absolute inset-0 bg-card/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2 rounded-xl">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-sm font-medium text-primary">Regenerando texto con IA...</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <Type className="w-4 h-4 text-primary" />
                      Texto
                    </h3>
                    {textApproved && (
                      <span data-testid="badge-text-approved" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Aprobado
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Asunto del correo</Label>
                        <span className="text-[10px] text-muted-foreground">{localAsunto.length}/60</span>
                      </div>
                      <Input
                        data-testid="input-edit-asunto"
                        value={localAsunto}
                        onChange={(e) => { setLocalAsunto(e.target.value); setHasUnsavedChanges(true); setTextApproved(false); }}
                        maxLength={60}
                        disabled={isCancelled}
                        placeholder="Asunto del correo"
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vista previa (Preheader)</Label>
                        <span className="text-[10px] text-muted-foreground">{localPreheader.length}/100</span>
                      </div>
                      <Input
                        data-testid="input-edit-preheader"
                        value={localPreheader}
                        onChange={(e) => { setLocalPreheader(e.target.value); setHasUnsavedChanges(true); setTextApproved(false); }}
                        maxLength={100}
                        disabled={isCancelled}
                        placeholder="Texto de vista previa"
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cuerpo del correo</Label>
                      <div data-testid="editor-cuerpo-html" className="border border-border rounded-xl overflow-hidden">
                        {selectedVersion ? (
                          <TipTapEditor
                            key={selectedVersion.id}
                            content={selectedHtml}
                            onChange={(html) => handleTextChange(selectedVersion.id, html)}
                          />
                        ) : (
                          <div className="p-4 text-sm text-muted-foreground">Sin contenido generado aún.</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Botón de acción (CTA)</Label>
                        <span className="text-[10px] text-muted-foreground">{localCta.length}/25</span>
                      </div>
                      <Input
                        data-testid="input-edit-cta"
                        value={localCta}
                        onChange={(e) => { setLocalCta(e.target.value); setHasUnsavedChanges(true); setTextApproved(false); }}
                        maxLength={25}
                        disabled={isCancelled}
                        placeholder="Texto del botón CTA"
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Enlace del botón (URL)</Label>
                      <Input
                        data-testid="input-edit-cta-url"
                        value={localCtaUrl}
                        onChange={(e) => { setLocalCtaUrl(e.target.value); setHasUnsavedChanges(true); setTextApproved(false); }}
                        maxLength={500}
                        disabled={isCancelled}
                        placeholder="https://ejemplo.com/promo"
                        className="rounded-xl"
                        type="url"
                      />
                    </div>
                  </div>

                  {hasUnsavedChanges && (
                    <Button
                      data-testid="button-save-text-changes"
                      onClick={handleSaveTextChanges}
                      disabled={isCancelled || updateVersionMutation.isPending}
                      className="w-full rounded-xl gap-2"
                    >
                      {updateVersionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Guardar Cambios
                    </Button>
                  )}
                  {justSaved && !hasUnsavedChanges && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium justify-center"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Cambios guardados
                    </motion.div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      data-testid="button-regenerate-text"
                      size="sm"
                      className="rounded-xl gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleRegenerateText}
                      disabled={isCancelled || versions.length >= 3 || regenerateTextMutation.isPending || generateVersionMutation.isPending}
                    >
                      {regenerateTextMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Regenerar Texto ({Math.max(0, 3 - versions.length)})
                    </Button>
                    {versions.length > 1 && (
                      <Button
                        data-testid="button-text-history"
                        variant={showTextHistory ? "default" : "secondary"}
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
                            const vContent = v.contentJson as any;
                            const html = vContent?.cuerpo_html
                              || vContent?.html
                              || vContent?.body
                              || "";
                            return (
                              <button
                                key={v.id}
                                data-testid={`button-select-text-${v.versionNumber}`}
                                onClick={() => !isCancelled && handleSelectVersion(v.id)}
                                disabled={isCancelled}
                                className={`w-full p-3 rounded-xl text-left border-2 transition-all text-sm ${v.isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"} ${isCancelled ? "opacity-60 cursor-not-allowed" : ""}`}
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

                  {!textApproved && !isCancelled && (
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
            </div>

            <Button
              data-testid="button-toggle-preview"
              variant="outline"
              onClick={() => setShowPreview(true)}
              className="w-full rounded-xl gap-2"
            >
              <Eye className="w-4 h-4" />
              Vista Previa del Correo
            </Button>
            </>
          )}

          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent data-testid="dialog-preview-email" className="sm:max-w-2xl rounded-2xl p-0 max-h-[90vh] overflow-hidden">
              <div className="p-5 pb-0">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-primary" />
                    Vista Previa del Correo
                  </DialogTitle>
                  <DialogDescription>
                    Así se verá tu correo en la bandeja de entrada.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-100px)] px-5 pb-5">
                <div className="border border-border rounded-xl overflow-hidden bg-white">
                  <iframe
                    data-testid="iframe-email-preview"
                    srcDoc={`<html><body style="margin:0;font-family:Arial,sans-serif">
                      <div style="max-width:600px;margin:0 auto">
                        ${localAsunto || selectedAsunto ? `<div style="padding:16px 24px;background:#002073;color:white"><h2 style="margin:0;font-size:18px">${localAsunto || selectedAsunto}</h2>${(localPreheader || selectedPreheader) ? `<p style="margin:4px 0 0;font-size:12px;opacity:0.8">${localPreheader || selectedPreheader}</p>` : ""}</div>` : ""}
                        <img src="${selectedImageUrl}" style="width:100%;height:200px;object-fit:cover" />
                        <div style="padding:24px">${selectedHtml}</div>
                        ${(localCta || selectedCtaText) ? `<div style="padding:0 24px 24px;text-align:center"><a style="display:inline-block;padding:12px 32px;background:#002073;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px">${localCta || selectedCtaText}</a></div>` : ""}
                        <div style="padding:16px 24px;background:#f9fafb;text-align:center;font-size:12px;color:#9ca3af">&copy; 2026 Mi Empresa. Todos los derechos reservados.</div>
                      </div>
                    </body></html>`}
                    className="w-full h-[500px]"
                    title="Vista previa completa"
                    sandbox=""
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showFinalPreview} onOpenChange={setShowFinalPreview}>
            <DialogContent data-testid="dialog-final-preview" className="sm:max-w-2xl rounded-2xl p-0 max-h-[90vh] overflow-hidden">
              <div className="p-5 pb-0">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    Vista Previa Final
                  </DialogTitle>
                  <DialogDescription>
                    Correo completo con la plantilla y el contenido del editor inyectado.
                  </DialogDescription>
                </DialogHeader>
                {finalPreviewMissing.length > 0 && (
                  <div className="mt-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Campos sin completar:</p>
                      <p className="text-[11px] text-amber-600 mt-0.5">{finalPreviewMissing.join(", ")}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-140px)] px-5 pb-5 pt-3">
                <div className="border border-border rounded-xl overflow-hidden bg-white">
                  <iframe
                    data-testid="iframe-final-preview"
                    srcDoc={finalPreviewHtml}
                    className="w-full h-[500px]"
                    title="Vista previa final"
                    sandbox=""
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showEditorTemplateSelector} onOpenChange={setShowEditorTemplateSelector}>
            <DialogContent data-testid="dialog-select-template" className="sm:max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Seleccionar Plantilla
                </DialogTitle>
                <DialogDescription>
                  Elija la plantilla para este correo. Las plantillas compatibles tienen todos los placeholders necesarios.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-3">
                {[...userTemplates].sort((a, b) => {
                  if (a.hasAllPlaceholders && !b.hasAllPlaceholders) return -1;
                  if (!a.hasAllPlaceholders && b.hasAllPlaceholders) return 1;
                  if (a.favorite && !b.favorite) return -1;
                  if (!a.favorite && b.favorite) return 1;
                  return 0;
                }).map(t => (
                  <button
                    key={t.id}
                    data-testid={`button-assign-template-${t.id}`}
                    onClick={() => handleAssignTemplate(String(t.id))}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left hover:border-primary/40 ${editingCampaign?.templateId === t.id ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <div className="w-24 h-16 rounded-lg overflow-hidden bg-white border border-border flex-shrink-0">
                      <iframe
                        srcDoc={t.html}
                        sandbox=""
                        className="w-full h-full pointer-events-none"
                        style={{ transform: "scale(0.25)", transformOrigin: "top left", width: "400%", height: "400%" }}
                        title={t.name}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{t.name}</span>
                        {editingCampaign?.templateId === t.id && (
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">Actual</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {t.hasAllPlaceholders ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-1.5 py-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Compatible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Incompleta
                          </span>
                        )}
                        {t.isAiGenerated && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-[#002073] text-white rounded-full px-1.5 py-0.5">
                            <span>Post</span><span className="text-[#e3001b]">IA</span><span>lo</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {userTemplates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay plantillas disponibles.</p>
                    <p className="text-xs mt-1">Cree plantillas en la sección Plantillas.</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={showRegenTextModal} onOpenChange={setShowRegenTextModal}>
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                Regenerar Texto
              </DialogTitle>
              <DialogDescription>
                Describa los ajustes que desea aplicar al texto del correo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Idea original</Label>
                <div data-testid="text-regen-original-idea" className="text-sm bg-muted/50 rounded-xl px-3 py-2 text-muted-foreground">
                  {editingCampaign?.idea || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Objetivo</Label>
                <div data-testid="text-regen-original-objective" className="text-sm bg-muted/50 rounded-xl px-3 py-2 text-muted-foreground">
                  {editingCampaign?.objective || "—"}
                </div>
              </div>
              {lastTextCorrections && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Último ajuste enviado</Label>
                  <div data-testid="text-regen-last-corrections" className="text-sm bg-muted/50 rounded-xl px-3 py-2 text-muted-foreground italic">
                    {lastTextCorrections}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">Correcciones</Label>
                <Textarea
                  data-testid="input-regen-text-corrections"
                  placeholder="Ej: Cambia el tono a más informal, hazlo más corto, enfócate en los beneficios..."
                  value={regenTextCorrections}
                  onChange={e => setRegenTextCorrections(e.target.value)}
                  className="rounded-xl min-h-[100px]"
                  maxLength={1000}
                />
              </div>
              <Button
                data-testid="button-confirm-regen-text"
                onClick={() => editingCampaignId && regenerateTextMutation.mutate({ campaignId: editingCampaignId, corrections: regenTextCorrections })}
                disabled={!regenTextCorrections.trim() || regenerateTextMutation.isPending}
                className="w-full rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {regenerateTextMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Regenerar con Ajustes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showRegenImageModal} onOpenChange={setShowRegenImageModal}>
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                Regenerar Imagen
              </DialogTitle>
              <DialogDescription>
                Modifique el prompt para generar una imagen completamente nueva.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prompt original</Label>
                <div data-testid="text-regen-image-original" className="text-sm bg-muted/50 rounded-xl px-3 py-2 text-muted-foreground">
                  {editingCampaign?.imagePrompt || "Sin prompt original"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">Nuevo prompt</Label>
                <Textarea
                  data-testid="input-regen-image-prompt"
                  placeholder="Escriba un nuevo prompt completo para la imagen..."
                  value={regenImagePrompt}
                  onChange={e => setRegenImagePrompt(e.target.value)}
                  className="rounded-xl min-h-[100px]"
                  maxLength={500}
                />
              </div>
              <Button
                data-testid="button-confirm-regen-image"
                onClick={() => editingCampaignId && regenerateImageMutation.mutate({ campaignId: editingCampaignId, imagePrompt: regenImagePrompt })}
                disabled={!regenImagePrompt.trim() || regenerateImageMutation.isPending}
                className="w-full rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {regenerateImageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Regenerar Imagen
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditImageModal} onOpenChange={setShowEditImageModal}>
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-amber-500" />
                Editar con Nano Banana
              </DialogTitle>
              <DialogDescription>
                Describa los cambios que desea aplicar sobre la imagen actual. La imagen original se mantendrá como base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="border border-border rounded-xl overflow-hidden bg-white">
                <img
                  data-testid="img-edit-preview"
                  src={selectedImageUrl}
                  alt="Imagen actual"
                  className="w-full h-40 object-cover"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">Instrucciones de edición</Label>
                <Textarea
                  data-testid="input-edit-image-prompt"
                  placeholder="Ej: Cambia solo el color del fondo a azul oscuro y mantén el resto de la imagen igual..."
                  value={editImagePrompt}
                  onChange={e => setEditImagePrompt(e.target.value)}
                  className="rounded-xl min-h-[100px]"
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tip: Sea específico con lo que desea cambiar e indique que el resto se mantenga igual. Para texto en imagen, limite a 25 caracteres o menos.
                </p>
              </div>
              <Button
                data-testid="button-confirm-edit-image"
                onClick={() => editingCampaignId && editImageMutation.mutate({ campaignId: editingCampaignId, editPrompt: editImagePrompt })}
                disabled={!editImagePrompt.trim() || editImageMutation.isPending}
                className="w-full rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {editImageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Aplicar Edición
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                maxLength={1000}
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
                maxLength={500}
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
                      maxLength={500}
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
                  {[...userTemplates].sort((a, b) => {
                    if (a.hasAllPlaceholders && !b.hasAllPlaceholders) return -1;
                    if (!a.hasAllPlaceholders && b.hasAllPlaceholders) return 1;
                    return 0;
                  }).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{t.name}</span>
                        {t.hasAllPlaceholders ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-1 py-0.5 flex-shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-100 rounded-full px-1 py-0.5 flex-shrink-0">
                            <AlertTriangle className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {userTemplates.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No hay plantillas. Créelas en la sección Plantillas.</div>
                  )}
                </SelectContent>
              </Select>
              {form.templateId && (
                <div className="border border-border rounded-xl overflow-hidden bg-white">
                  <iframe
                    srcDoc={userTemplates.find(t => t.id === parseInt(form.templateId))?.html || ""}
                    sandbox=""
                    className="w-full h-24 pointer-events-none"
                    style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
                    title="template-mini-preview"
                  />
                </div>
              )}
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
                min={new Date().toISOString().slice(0, 16)}
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
