import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCell } from "@/components/CalendarCell";
import { useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, ArrowLeft,
  ImageIcon, Upload, RefreshCw, Check, Pencil, History,
  Type, Eye, Wand2, Send, Loader2, XCircle, Ban, Trash2,
  FileText, CheckCircle2, AlertTriangle, Link2, Database,
  Layers, Palette, Eraser, PlusCircle, X, Image as ImageLucide
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { TipTapEditor } from "@/components/TipTapEditor";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Campaign, CampaignVersion, Template, ContactDatabase, BrandIdentity } from "@shared/schema";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialHighlight } from "@/components/TutorialHighlight";
import { TutorialTip } from "@/components/TutorialTip";
import { useCampaignProgress, type CampaignProgress } from "@/hooks/use-campaign-progress";
import { Progress } from "@/components/ui/progress";

function SendProgressBar({ campaignId, campaign }: { campaignId: number; campaign: Campaign }) {
  const { getProgress } = useCampaignProgress();
  const wsProgress = getProgress(campaignId);

  const { data: sendStats } = useQuery<{
    total: number; sent: number; failed: number; pending: number;
    totalExpectedSends: number; sentCount: number; failedCount: number; status: string;
  }>({
    queryKey: ['/api/campaigns', campaignId, 'send-stats'],
    refetchInterval: campaign.status === "sending" ? 5000 : false,
  });

  const total = wsProgress?.totalExpectedSends || sendStats?.totalExpectedSends || campaign.totalExpectedSends || 0;
  const sent = wsProgress?.sentCount ?? sendStats?.sentCount ?? campaign.sentCount ?? 0;
  const failed = wsProgress?.failedCount ?? sendStats?.failedCount ?? campaign.failedCount ?? 0;
  const completed = sent + failed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = total > 0 && completed >= total;

  const { data: sends } = useQuery<Array<{
    id: number; campaignId: number; contactEmail: string; contactName: string | null;
    status: string; messageId: string | null; errorMessage: string | null;
  }>>({
    queryKey: ['/api/campaigns', campaignId, 'sends'],
    refetchInterval: campaign.status === "sending" ? 5000 : false,
  });

  const [showLog, setShowLog] = useState(false);

  return (
    <div data-testid="send-progress-container" className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Send className="w-4 h-4" />
          Progreso de Envío
        </h3>
        <span className="text-xs text-muted-foreground">
          {completed} / {total} contactos
        </span>
      </div>

      <Progress value={percent} className="h-2" />

      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" /> {sent} enviados
        </span>
        {failed > 0 && (
          <span className="flex items-center gap-1.5 text-red-600">
            <XCircle className="w-3.5 h-3.5" /> {failed} fallidos
          </span>
        )}
        {total - completed > 0 && !isComplete && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {total - completed} pendientes
          </span>
        )}
        {isComplete && (
          <span className="font-semibold text-emerald-600">
            {failed === 0 ? "¡Envío completado!" : "Envío finalizado con errores"}
          </span>
        )}
      </div>

      {sends && sends.length > 0 && (
        <>
          <Button
            data-testid="button-toggle-send-log"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowLog(!showLog)}
          >
            {showLog ? "Ocultar detalle" : "Ver detalle por contacto"}
          </Button>
          {showLog && (
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y text-xs">
              {sends.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      s.status === "sent" ? "bg-emerald-500" : s.status === "failed" ? "bg-red-500" : "bg-gray-300"
                    }`} />
                    <span className="truncate">{s.contactName || s.contactEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.messageId && (
                      <span className="text-muted-foreground truncate max-w-[120px]" title={s.messageId}>
                        ID: {s.messageId}
                      </span>
                    )}
                    {s.errorMessage && (
                      <span className="text-red-500 truncate max-w-[150px]" title={s.errorMessage}>
                        {s.errorMessage}
                      </span>
                    )}
                    <span className={`font-medium ${
                      s.status === "sent" ? "text-emerald-600" : s.status === "failed" ? "text-red-600" : "text-gray-400"
                    }`}>
                      {s.status === "sent" ? "Enviado" : s.status === "failed" ? "Fallido" : "Pendiente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const STATUS_MAP: Record<string, string> = { draft: "borrador", scheduled: "programado", sending: "enviando", sent: "enviado", partial: "parcial", failed: "fallido", cancelled: "cancelado" };
const STATUS_REVERSE: Record<string, string> = { borrador: "draft", programado: "scheduled", enviando: "sending", enviado: "sent", parcial: "partial", fallido: "failed", cancelado: "cancelled" };

function campaignToDateStr(c: Campaign): string {
  if (!c.scheduledAt) return "";
  const d = new Date(c.scheduledAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarView() {
  const { toast } = useToast();
  const tutorial = useTutorial();
  const searchString = useSearch();
  const [, setLoc] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [isResend, setIsResend] = useState(false);
  const [showImageHistory, setShowImageHistory] = useState(false);
  const [showTextHistory, setShowTextHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sentPreviewHeight, setSentPreviewHeight] = useState(0);
  const [previewHeight, setPreviewHeight] = useState(0);
  const [textApproved, setTextApprovedLocal] = useState(false);
  const [imageApproved, setImageApprovedLocal] = useState(false);
  const [form, setForm] = useState({ idea: "", objective: "", templateId: "", targetDatabase: "", scheduledDate: "", imagePrompt: "", targetAudience: "" });
  const [showTargetAudience, setShowTargetAudience] = useState(false);
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
  const [advancedAction, setAdvancedAction] = useState<string>("agregar");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [lastTextCorrections, setLastTextCorrections] = useState("");
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const [localAsunto, setLocalAsunto] = useState("");
  const [localPreheader, setLocalPreheader] = useState("");
  const [localCta, setLocalCta] = useState("");
  const [localCtaUrl, setLocalCtaUrl] = useState("");
  const [ctaEnabled, setCtaEnabled] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pendingVersionSwitch, setPendingVersionSwitch] = useState<{ fn: () => void } | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tutorial.setCurrentSection("calendar");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const editId = params.get("edit");
    if (editId) {
      const id = parseInt(editId, 10);
      if (!isNaN(id) && id !== editingCampaignId) {
        setEditingCampaignId(id);
        setTextApprovedLocal(true);
        setImageApprovedLocal(true);
        setIsResend(true);
        setLoc("/calendar", { replace: true });
      }
    }
  }, [searchString]);

  useEffect(() => {
    function handlePreviewMessage(e: MessageEvent) {
      if (e.data?.type === "sent-preview-height" && typeof e.data.height === "number") {
        setSentPreviewHeight(e.data.height);
      }
      if (e.data?.type === "preview-height" && typeof e.data.height === "number") {
        setPreviewHeight(e.data.height);
      }
    }
    window.addEventListener("message", handlePreviewMessage);
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, []);

  useEffect(() => {
    if (tutorial.tutorialActive && showNewDialog && tutorial.currentStepIndex === 0) {
      tutorial.setCurrentStepIndex(1);
    }
  }, [showNewDialog, tutorial.tutorialActive]);

  useEffect(() => {
    if (tutorial.tutorialActive && !showNewDialog && !editingCampaignId) {
      tutorial.setCurrentStepIndex(0);
    }
  }, [showNewDialog, editingCampaignId, tutorial.tutorialActive]);

  const advanceTutorialOnBlur = useCallback((currentFieldId: string, currentValue: string) => {
    if (!tutorial.tutorialActive) return;
    const step = tutorial.getCurrentStep();
    if (!step || step.fieldId !== currentFieldId) return;
    if (currentValue && currentValue.trim()) {
      tutorial.nextStep();
    }
  }, [tutorial]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const { data: monthCampaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns", { year, month }],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?year=${year}&month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando campañas");
      return res.json();
    },
  });

  const { data: editCampaignData } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", editingCampaignId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${editingCampaignId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando campaña");
      return res.json();
    },
    enabled: !!editingCampaignId && !monthCampaigns.some(c => c.id === editingCampaignId),
  });

  const campaigns = useMemo(() => {
    if (editCampaignData && !monthCampaigns.some(c => c.id === editCampaignData.id)) {
      return [...monthCampaigns, editCampaignData];
    }
    return monthCampaigns;
  }, [monthCampaigns, editCampaignData]);

  const campaignIds = useMemo(() => campaigns.map(c => c.id), [campaigns]);
  const { data: thumbnails = {} } = useQuery<Record<number, string | null>>({
    queryKey: ["/api/campaigns/thumbnails", campaignIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return {};
      const res = await apiRequest("POST", "/api/campaigns/thumbnails", { campaignIds });
      return res.json();
    },
    enabled: campaignIds.length > 0,
  });

  const { data: userTemplates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: brandIdentity } = useQuery<BrandIdentity>({
    queryKey: ["/api/brand-identity"],
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
      setTextApprovedLocal(false);
      setImageApprovedLocal(false);
      toast({ title: "Correo creado", description: "Generando contenido..." });
      generateVersionMutation.mutate(campaign.id);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "No se pudo crear el correo.", variant: "destructive" });
    },
  });

  const generateVersionMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/generate`);
      return res.json();
    },
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Versión generada", description: "Nueva versión disponible." });
    },
    onError: (err: Error) => {
      toast({ title: "Error generando contenido", description: err.message || "Error de generación. Intente de nuevo.", variant: "destructive" });
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

  const setTextApproved = useCallback((value: boolean) => {
    setTextApprovedLocal(value);
    if (editingCampaignId) {
      updateCampaignMutation.mutate({ id: editingCampaignId, updates: { textApproved: value } });
    }
  }, [editingCampaignId]);

  const setImageApproved = useCallback((value: boolean) => {
    setImageApprovedLocal(value);
    if (editingCampaignId) {
      updateCampaignMutation.mutate({ id: editingCampaignId, updates: { imageApproved: value } });
    }
  }, [editingCampaignId]);

  const deleteAllCampaignsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/campaigns");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setEditingCampaignId(null);
      setSelectedDay(null);
      toast({ title: "Historial vaciado", description: "Todos los correos han sido eliminados." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo vaciar el historial.", variant: "destructive" });
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
    mutationFn: async ({ campaignId, editPrompt, selectedAction, refImages }: { campaignId: number; editPrompt: string; selectedAction: string; refImages: string[] }) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/edit-image-advanced`, {
        editPrompt,
        selectedAction,
        referenceImages: refImages,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", editingCampaignId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setShowEditImageModal(false);
      setEditImagePrompt("");
      setAdvancedAction("agregar");
      setReferenceImages([]);
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
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    let defaultTime = "09:00";
    if (dateStr === todayStr) {
      const nextHour = now.getHours() + 1;
      if (nextHour < 24) {
        defaultTime = `${String(nextHour).padStart(2, "0")}:00`;
      } else {
        defaultTime = "23:59";
      }
    }
    setForm({ idea: "", objective: "", templateId: "", targetDatabase: "", scheduledDate: `${dateStr}T${defaultTime}`, imagePrompt: "", targetAudience: "" });
    setShowTargetAudience(false);
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
    const camp = campaigns.find(c => c.id === campaignId);
    setTextApprovedLocal(camp?.textApproved ?? false);
    setImageApprovedLocal(camp?.imageApproved ?? false);
    setHasUnsavedChanges(false);
  }

  function handleBackToCalendar() {
    setEditingCampaignId(null);
    setIsResend(false);
    setShowImageHistory(false);
    setShowTextHistory(false);
    setShowPreview(false);
    setShowFinalPreview(false);
    setTextApprovedLocal(false);
    setImageApprovedLocal(false);
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

  const sendCampaignMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/campaigns/${id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaña enviada", description: "Su correo ha sido enviado al sistema de distribución." });
      handleBackToCalendar();
    },
    onError: (err: Error) => {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    },
  });

  function handlePublishNow() {
    if (!editingCampaignId) return;
    if (!editingCampaign?.templateId) {
      toast({ title: "Plantilla requerida", description: "Debe seleccionar una plantilla antes de enviar el correo.", variant: "destructive" });
      return;
    }
    if (!editingCampaign?.targetDatabase) {
      toast({ title: "Base de datos requerida", description: "Debe seleccionar una base de datos de contactos antes de enviar.", variant: "destructive" });
      return;
    }
    if (!textApproved) {
      toast({ title: "Texto no aprobado", description: "Debe aprobar el texto del correo antes de enviar.", variant: "destructive" });
      return;
    }
    if (!imageApproved) {
      toast({ title: "Imagen no aprobada", description: "Debe aprobar la imagen del correo antes de enviar.", variant: "destructive" });
      return;
    }
    const strippedBody = (selectedHtml || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!strippedBody) {
      toast({ title: "Contenido vacío", description: "El cuerpo del correo está vacío. Genere o escriba contenido antes de enviar.", variant: "destructive" });
      return;
    }
    if (!(localAsunto || selectedAsunto)?.trim()) {
      toast({ title: "Asunto vacío", description: "El correo debe tener un asunto antes de enviarse.", variant: "destructive" });
      return;
    }
    sendCampaignMutation.mutate(editingCampaignId);
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
    let scheduledAt: string | null = null;
    if (form.scheduledDate) {
      const localDate = new Date(form.scheduledDate);
      scheduledAt = localDate.toISOString();
    }
    createCampaignMutation.mutate({
      name: form.idea.substring(0, 200),
      idea: form.idea,
      objective: form.objective || "General",
      tone: "profesional",
      imagePrompt: form.imagePrompt || null,
      targetDatabase: form.targetDatabase || null,
      targetAudience: showTargetAudience && form.targetAudience.trim() ? form.targetAudience.trim() : null,
      templateId: form.templateId ? parseInt(form.templateId) : null,
      scheduledAt,
    });
  }

  function handleRegenerateText() {
    if (!editingCampaignId || !editingCampaign) return;
    const textRegenCount = (editingCampaign as any).textRegenCount || 0;
    if (textRegenCount >= 2) {
      toast({ title: "Límite alcanzado", description: "Máximo 2 regeneraciones de texto.", variant: "destructive" });
      return;
    }
    setRegenTextCorrections("");
    setShowRegenTextModal(true);
  }

  function handleRegenerateImage() {
    if (!editingCampaignId || !editingCampaign) return;
    const imageRegenCount = (editingCampaign as any).imageRegenCount || 0;
    if (imageRegenCount >= 2) {
      toast({ title: "Límite alcanzado", description: "Máximo 2 regeneraciones de imagen.", variant: "destructive" });
      return;
    }
    setRegenImagePrompt(editingCampaign?.imagePrompt || "");
    setShowRegenImageModal(true);
  }

  function handleEditWithNanoBanana() {
    if (!editingCampaignId || !editingCampaign) return;
    const imageRegenCount = (editingCampaign as any).imageRegenCount || 0;
    if (imageRegenCount >= 2) {
      toast({ title: "Límite alcanzado", description: "Máximo 2 regeneraciones de imagen.", variant: "destructive" });
      return;
    }
    setEditImagePrompt("");
    setAdvancedAction("agregar");
    setReferenceImages([]);
    setShowEditImageModal(true);
  }

  function handleRefImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const remaining = 3 - referenceImages.length;
    const toProcess = Array.from(files).slice(0, remaining);
    toProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setReferenceImages(prev => {
          if (prev.length >= 3) return prev;
          return [...prev, result];
        });
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = "";
  }

  function handleSelectHistoryImage(imageUrl: string) {
    if (referenceImages.length >= 3) {
      toast({ title: "Límite", description: "Máximo 3 imágenes de referencia.", variant: "destructive" });
      return;
    }
    if (referenceImages.includes(imageUrl)) return;
    setReferenceImages(prev => [...prev, imageUrl]);
  }

  function removeReferenceImage(index: number) {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  }

  const ACTION_PLACEHOLDERS: Record<string, string> = {
    agregar: "Ej: Coloca el logo en la esquina superior derecha",
    reemplazar: "Ej: Reemplaza el fondo por un atardecer en la playa",
    fusionar: "Ej: Combina ambas imágenes en una escena natural",
    estilo: "Ej: Aplica un estilo de acuarela a toda la imagen",
    borrar_elemento: "Ej: Borra a las personas caminando en el parque",
  };

  const [localSelectedVersionId, setLocalSelectedVersionId] = useState<number | null>(null);

  useEffect(() => {
    setLocalSelectedVersionId(null);
  }, [editingCampaignId]);

  useEffect(() => {
    if (localSelectedVersionId && !versions.find(v => v.id === localSelectedVersionId)) {
      setLocalSelectedVersionId(null);
    }
    versions.forEach(v => {
      if (v.imageUrl) {
        const img = new Image();
        img.src = v.imageUrl;
      }
    });
  }, [versions]);

  const textVersions = versions.filter(v => (v as any).type === "initial" || (v as any).type === "text").sort((a, b) => a.versionNumber - b.versionNumber);
  const imageVersions = versions.filter(v => (v as any).type === "initial" || (v as any).type === "image").sort((a, b) => a.versionNumber - b.versionNumber);

  function doSelectTextVersion(versionId: number) {
    setLocalSelectedVersionId(versionId);
    setTextApproved(false);
    setHasUnsavedChanges(false);
    textVersions.forEach(v => {
      if (v.isSelected && v.id !== versionId) {
        updateVersionMutation.mutate({ id: v.id, updates: { isSelected: false } });
      }
    });
    updateVersionMutation.mutate({ id: versionId, updates: { isSelected: true } });
  }

  function handleSelectTextVersion(versionId: number) {
    if (hasUnsavedChanges) {
      setPendingVersionSwitch({ fn: () => doSelectTextVersion(versionId) });
      return;
    }
    doSelectTextVersion(versionId);
  }

  function handleSelectImageVersion(versionId: number) {
    setImageApproved(false);
    imageVersions.forEach(v => {
      if (v.isSelected && v.id !== versionId) {
        updateVersionMutation.mutate({ id: v.id, updates: { isSelected: false } });
      }
    });
    updateVersionMutation.mutate({ id: versionId, updates: { isSelected: true } });
  }

  function doSelectVersion(versionId: number) {
    setLocalSelectedVersionId(versionId);
    setTextApproved(false);
    setImageApproved(false);
    setHasUnsavedChanges(false);
    versions.forEach(v => {
      if (v.isSelected && v.id !== versionId) {
        updateVersionMutation.mutate({ id: v.id, updates: { isSelected: false } });
      }
    });
    updateVersionMutation.mutate({ id: versionId, updates: { isSelected: true } });
  }

  function handleSelectVersion(versionId: number) {
    if (hasUnsavedChanges) {
      setPendingVersionSwitch({ fn: () => doSelectVersion(versionId) });
      return;
    }
    doSelectVersion(versionId);
  }

  function handleTextChange(versionId: number, newHtml: string) {
    if (textApproved) return;
    const version = versions.find(v => v.id === versionId);
    const existing = (version?.contentJson as any) || {};
    const currentHtml = existing.cuerpo_html ?? existing.html ?? "";
    if (newHtml === currentHtml) return;
    const updatedContent = existing.cuerpo_html !== undefined
      ? { ...existing, cuerpo_html: newHtml }
      : { ...existing, html: newHtml };
    setHasUnsavedChanges(true);
    updateVersionMutation.mutate(
      { id: versionId, updates: { contentJson: updatedContent } },
      { onSuccess: () => setHasUnsavedChanges(false) }
    );
    setTextApprovedLocal(false);
  }

  function handleApproveText() {
    if (!localAsunto || !localAsunto.trim() || localAsunto.trim() === "Borrador - Pendiente de generación IA") {
      toast({ title: "Asunto vacío", description: "Debe tener un asunto válido antes de aprobar el texto.", variant: "destructive" });
      return;
    }
    const strippedText = (selectedHtml || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!selectedHtml || !selectedHtml.trim() || !strippedText) {
      toast({ title: "Contenido vacío", description: "Debe tener contenido en el cuerpo del correo antes de aprobar.", variant: "destructive" });
      return;
    }
    if (ctaEnabled) {
      if (!localCtaUrl || !localCtaUrl.trim()) {
        toast({ title: "URL del botón vacía", description: "Debe ingresar la URL del botón CTA o desactivar el botón antes de aprobar.", variant: "destructive" });
        return;
      }
      try {
        const parsed = new URL(localCtaUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        toast({ title: "URL inválida", description: "La URL del botón CTA no es válida. Debe comenzar con https:// o http://", variant: "destructive" });
        return;
      }
    }
    if (hasUnsavedChanges && selectedVersion) {
      const existing = (selectedVersion.contentJson as any) || {};
      const updatedContent = {
        ...existing,
        asunto: localAsunto,
        preheader: localPreheader,
        cta_text: localCta,
        cta_url: localCtaUrl,
        cta_enabled: ctaEnabled,
      };
      updateVersionMutation.mutate(
        { id: selectedVersion.id, updates: { contentJson: updatedContent } },
        {
          onSuccess: () => {
            setHasUnsavedChanges(false);
            setTextApproved(true);
            toast({ title: "Texto aprobado" });
            checkBothApprovalsAndSchedule(imageApproved, true);
          },
          onError: () => {
            toast({ title: "Error", description: "No se pudo guardar antes de aprobar.", variant: "destructive" });
          },
        }
      );
    } else {
      setTextApproved(true);
      toast({ title: "Texto aprobado" });
      checkBothApprovalsAndSchedule(imageApproved, true);
    }
  }

  function handleApproveImage() {
    if (selectedImageUrl.includes("placehold.co")) {
      toast({ title: "Imagen no válida", description: "Debe cargar o generar una imagen real antes de aprobar.", variant: "destructive" });
      return;
    }
    setImageApproved(true);
    toast({ title: "Imagen aprobada" });
    checkBothApprovalsAndSchedule(true, textApproved);
  }

  function checkBothApprovalsAndSchedule(newImageApproved: boolean, newTextApproved: boolean) {
    if (!newImageApproved || !newTextApproved) return;
    if (!editingCampaignId || !editingCampaign) return;
    if (editingCampaign.status !== "draft") return;
    if (!editingCampaign.scheduledAt) return;

    const scheduledTime = new Date(editingCampaign.scheduledAt).getTime();
    const now = Date.now();

    if (scheduledTime > now) {
      updateCampaignMutation.mutate(
        { id: editingCampaignId, updates: { textApproved: newTextApproved, imageApproved: newImageApproved, status: "scheduled" } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
            toast({ title: "Correo programado", description: "Ambas aprobaciones confirmadas. Tu correo está programado para envío automático." });
          },
        }
      );
    } else {
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const localDateStr = `${nextHour.getFullYear()}-${String(nextHour.getMonth() + 1).padStart(2, "0")}-${String(nextHour.getDate()).padStart(2, "0")}T${String(nextHour.getHours()).padStart(2, "0")}:${String(nextHour.getMinutes()).padStart(2, "0")}`;
      setRescheduleDate(localDateStr);
      setShowRescheduleDialog(true);
    }
  }

  function handleReschedule() {
    if (!editingCampaignId || !rescheduleDate) return;
    const newDate = new Date(rescheduleDate);
    const fifteenMinFromNow = Date.now() + 15 * 60 * 1000;
    if (newDate.getTime() < fifteenMinFromNow) {
      toast({ title: "Fecha inválida", description: "La nueva fecha debe ser al menos 15 minutos en el futuro.", variant: "destructive" });
      return;
    }
    updateCampaignMutation.mutate(
      { id: editingCampaignId, updates: { scheduledAt: newDate.toISOString(), status: "scheduled", textApproved: true, imageApproved: true } },
      {
        onSuccess: () => {
          setShowRescheduleDialog(false);
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
          toast({ title: "Correo reprogramado", description: `Nuevo envío: ${newDate.toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` });
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message || "No se pudo reprogramar.", variant: "destructive" });
        },
      }
    );
  }

  function handleManualReschedule() {
    if (!editingCampaignId || !editingCampaign) return;
    if (editingCampaign.status === "scheduled" && editingCampaign.scheduledAt) {
      const existingTime = new Date(editingCampaign.scheduledAt).getTime();
      const fifteenMinFromNow = Date.now() + 15 * 60 * 1000;
      if (existingTime <= fifteenMinFromNow) {
        toast({ title: "No se puede reprogramar", description: "No puedes cambiar la fecha porque estás a menos de 15 minutos del envío programado.", variant: "destructive" });
        return;
      }
    }
    const current = editingCampaign.scheduledAt ? new Date(editingCampaign.scheduledAt) : new Date();
    const localDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}T${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;
    setRescheduleDate(localDateStr);
    setShowRescheduleDialog(true);
  }

  const editingCampaign = campaigns.find(c => c.id === editingCampaignId);

  const sortedTemplatesForSelector = useMemo(() => {
    return [...userTemplates].sort((a, b) => {
      if (a.hasAllPlaceholders && !b.hasAllPlaceholders) return -1;
      if (!a.hasAllPlaceholders && b.hasAllPlaceholders) return 1;
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return 0;
    });
  }, [userTemplates]);

  const selectedTextVersion = (localSelectedVersionId ? textVersions.find(v => v.id === localSelectedVersionId) : null) || textVersions.find(v => v.isSelected) || textVersions[0];
  const selectedImageVersion = imageVersions.find(v => v.isSelected) || imageVersions[0];
  const selectedVersion = selectedTextVersion;
  const contentData = selectedTextVersion?.contentJson as any;
  const selectedAsunto = contentData?.asunto || contentData?.title || "";
  const selectedPreheader = contentData?.preheader || "";
  const selectedCtaText = contentData?.cta_text || contentData?.cta || "Ver más";
  const selectedCtaUrl = contentData?.cta_url || "#";
  const selectedHtml = contentData
    ? contentData.cuerpo_html
      ? contentData.cuerpo_html
      : contentData.html
        ? contentData.html
        : contentData.body
          ? `<p>${contentData.body}</p>`
          : ""
    : "";
  const selectedImageUrl = editorLocalImageUrl || selectedImageVersion?.imageUrl || "https://placehold.co/600x300/002073/white?text=Sin+Imagen";

  useEffect(() => {
    if (selectedVersion) {
      const cd = selectedVersion.contentJson as any;
      setLocalAsunto(cd?.asunto || cd?.title || "");
      setLocalPreheader(cd?.preheader || "");
      setLocalCta(cd?.cta_text || cd?.cta || "");
      setLocalCtaUrl(cd?.cta_url || "");
      setCtaEnabled(cd?.cta_enabled !== false);
      setHasUnsavedChanges(false);
    } else {
      setLocalAsunto("");
      setLocalPreheader("");
      setLocalCta("");
      setLocalCtaUrl("");
      setCtaEnabled(true);
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
      cta_enabled: ctaEnabled,
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
    for (const c of campaigns) {
      if (!c.scheduledAt) continue;
      const d = new Date(c.scheduledAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(c);
      }
    }
    return map;
  }, [campaigns, year, month]);

  const handleDayClick = useCallback((day: number) => {
    openDay(day);
  }, [campaigns, year, month]);

  const todayDay = new Date().getDate();
  const todayMonth = new Date().getMonth();
  const todayYear = new Date().getFullYear();

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="min-h-[80px] md:min-h-[110px]" />);
  }
  for (let day = 1; day <= totalDays; day++) {
    const isToday = todayDay === day && todayMonth === month && todayYear === year;
    calendarCells.push(
      <CalendarCell
        key={day}
        day={day}
        isToday={isToday}
        campaigns={campaignsByDay[day] || []}
        thumbnails={thumbnails}
        onDayClick={handleDayClick}
      />
    );
  }

  if (editingCampaign) {
    const isCancelled = editingCampaign.status === "cancelled";
    const isSent = editingCampaign.status === "sent" || editingCampaign.status === "partial";
    const isSending = editingCampaign.status === "sending";
    const isGenerated = versions.length > 0;
    const isReady = imageApproved && textApproved;

    const statusTags: Array<{ label: string; className: string }> = [];
    if (isResend) {
      statusTags.push({ label: "Reenvío", className: "bg-violet-100 text-violet-700" });
    }
    if (isCancelled) {
      statusTags.push({ label: "Cancelado", className: "bg-red-100 text-red-700" });
    } else {
      if (isSending) statusTags.push({ label: "Enviando...", className: "bg-amber-100 text-amber-700 animate-pulse" });
      if (editingCampaign.status === "sent") statusTags.push({ label: "Enviado", className: "bg-emerald-100 text-emerald-700" });
      if (editingCampaign.status === "partial") statusTags.push({ label: "Envío Parcial", className: "bg-orange-100 text-orange-700" });
      if (editingCampaign.status === "failed") statusTags.push({ label: "Fallido", className: "bg-red-100 text-red-700" });
      if (isReady && !isSent && !isSending) statusTags.push({ label: "Listo", className: "bg-green-100 text-green-700" });
      if (isGenerated && !isSent && !isSending) statusTags.push({ label: "Generado", className: "bg-indigo-100 text-indigo-700" });
      if (editingCampaign.status === "scheduled") statusTags.push({ label: "Programado", className: "bg-blue-100 text-blue-700" });
      if (editingCampaign.status === "draft") statusTags.push({ label: "Borrador", className: "bg-gray-100 text-gray-600" });
    }

    const isFailed = editingCampaign?.status === "failed";
    const isPartial = editingCampaign?.status === "partial";
    const isLocked = isCancelled || isSent || isSending || isFailed || isPartial;
    const progressPercent = isLocked ? -1 : (imageApproved ? 50 : 0) + (textApproved ? 50 : 0);

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
                {editingCampaign.scheduledAt ? new Date(editingCampaign.scheduledAt).toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Sin fecha"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isLocked && (
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
              {textApproved && imageApproved && !isLocked && editingCampaign?.scheduledAt && editingCampaign.status === "scheduled" && (
                <Button
                  data-testid="button-reschedule"
                  variant="outline"
                  size="sm"
                  onClick={handleManualReschedule}
                  className="rounded-xl gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reprogramar
                </Button>
              )}
              {textApproved && imageApproved && !isLocked && (
                <Button
                  data-testid="button-publish-now"
                  onClick={handlePublishNow}
                  className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
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

          {(isSending || isSent || isFailed || isPartial) && (editingCampaign.totalExpectedSends ?? 0) > 0 && (
            <SendProgressBar campaignId={editingCampaign.id} campaign={editingCampaign} />
          )}

          {(isSent || isSending || isFailed || isPartial) && selectedVersion && (
            <div data-testid="section-sent-summary" className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Vista Final del Correo
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
                <div className="border border-border rounded-xl overflow-hidden bg-white">
                  <iframe
                    data-testid="iframe-sent-preview"
                    srcDoc={(() => {
                      const tpl = editingCampaign?.templateId ? userTemplates.find(t => t.id === editingCampaign.templateId) : null;
                      const asunto = localAsunto || selectedAsunto || "";
                      const preheader = localPreheader || selectedPreheader || "";
                      const imagen = selectedImageUrl || "https://placehold.co/600x300/002073/white?text=Sin+Imagen";
                      const contenido = selectedHtml || "";
                      const ctaTexto = ctaEnabled ? (localCta || selectedCtaText || "") : "";
                      const ctaUrl = ctaEnabled ? (localCtaUrl || selectedCtaUrl || "#") : "";
                      const logoUrl = brandIdentity?.logoUrl || "";
                      if (tpl?.html) {
                        let rendered = tpl.html;
                        if (!ctaEnabled) {
                          rendered = rendered.replace(/<!--\s*(?:BLOQUE\s*\d+\s*:\s*)?Botón CTA\s*-->\s*<tr>[\s\S]*?<\/tr>/i, '');
                        }
                        rendered = rendered.replace(/\{\{ASUNTO\}\}/g, asunto);
                        rendered = rendered.replace(/\{\{PREHEADER\}\}/g, preheader);
                        rendered = rendered.replace(/\{\{CONTENIDO\}\}/g, contenido);
                        rendered = rendered.replace(/\{\{CTA_TEXTO\}\}/g, ctaTexto);
                        rendered = rendered.replace(/\{\{CTA_URL\}\}/g, ctaUrl);
                        rendered = rendered.replace(/\{\{IMAGEN_URL\}\}/g, imagen);
                        rendered = rendered.replace(/\{\{LOGO_URL\}\}/g, logoUrl);
                        return `<html><body style="margin:0;font-family:Arial,sans-serif;overflow:hidden">${rendered}<script>
                          function sendHeight(){var h=document.body.scrollHeight;parent.postMessage({type:'sent-preview-height',height:h},'*');}
                          window.addEventListener('load',function(){setTimeout(sendHeight,100);});
                          new MutationObserver(sendHeight).observe(document.body,{childList:true,subtree:true});
                          var imgs=document.querySelectorAll('img');
                          for(var i=0;i<imgs.length;i++){imgs[i].addEventListener('load',sendHeight);}
                        </script></body></html>`;
                      }
                      return `<html><body style="margin:0;font-family:Arial,sans-serif;overflow:hidden">
                        <div style="max-width:600px;margin:0 auto">
                          ${asunto ? `<div style="padding:16px 24px;background:#002073;color:white"><h2 style="margin:0;font-size:18px">${asunto}</h2>${preheader ? `<p style="margin:4px 0 0;font-size:12px;opacity:0.8">${preheader}</p>` : ""}</div>` : ""}
                          <img src="${imagen}" style="width:100%;height:auto;display:block" />
                          <div style="padding:24px">${contenido}</div>
                          ${ctaEnabled && ctaTexto ? `<div style="padding:0 24px 24px;text-align:center"><a href="${ctaUrl}" style="display:inline-block;padding:12px 32px;background:#002073;color:white;text-decoration:none;border-radius:8px;font-weight:bold">${ctaTexto}</a></div>` : ""}
                        </div>
                        <script>
                          function sendHeight(){var h=document.body.scrollHeight;parent.postMessage({type:'sent-preview-height',height:h},'*');}
                          window.addEventListener('load',function(){setTimeout(sendHeight,100);});
                          new MutationObserver(sendHeight).observe(document.body,{childList:true,subtree:true});
                          var imgs=document.querySelectorAll('img');
                          for(var i=0;i<imgs.length;i++){imgs[i].addEventListener('load',sendHeight);}
                        </script>
                      </body></html>`;
                    })()}
                    sandbox="allow-scripts"
                    className="w-full border-0"
                    style={{ minHeight: "400px", height: sentPreviewHeight > 0 ? sentPreviewHeight + "px" : "700px" }}
                    title="Vista final del correo enviado"
                  />
                </div>
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Asunto</p>
                    <p className="text-sm font-semibold leading-snug">{localAsunto || selectedAsunto || "—"}</p>
                  </div>
                  {(localPreheader || selectedPreheader) && (
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Preheader</p>
                      <p className="text-sm font-semibold leading-snug">{localPreheader || selectedPreheader}</p>
                    </div>
                  )}
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Botón CTA</p>
                    <p className="text-sm font-semibold leading-snug">{localCta || selectedCtaText || "—"}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Versión</p>
                    <p className="text-sm font-semibold">V{selectedVersion.versionNumber}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Estado</p>
                    <p className={`text-sm font-semibold ${isFailed ? "text-red-600" : isPartial ? "text-amber-600" : isSending ? "text-blue-600" : "text-emerald-600"}`}>
                      {isSending ? "Enviando..." : isFailed ? "Fallido" : isPartial ? "Envío parcial" : isSent ? "Enviado" : "—"}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Base de Datos</p>
                    <p className="text-sm font-semibold leading-snug flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {editingCampaign?.targetDatabase
                        ? (userDatabases.find(db => String(db.id) === editingCampaign.targetDatabase)?.name || editingCampaign.targetDatabase)
                        : "Sin base de datos"}
                    </p>
                  </div>
                  {editingCampaign?.scheduledAt && (
                    <div className="bg-muted/50 rounded-xl p-4">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Fecha de Envío</p>
                      <p className="text-sm font-semibold leading-snug">
                        {new Date(editingCampaign.scheduledAt).toLocaleString("es", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
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

          {!isLocked && (
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
                  {editingCampaign?.templateId && textApproved && imageApproved && (
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

          <div data-testid="section-database-selector" className="bg-card rounded-2xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Database className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-semibold">Base de Datos de Destino</span>
                  {editingCampaign?.targetDatabase ? (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {userDatabases.find(db => String(db.id) === editingCampaign.targetDatabase)?.name || editingCampaign.targetDatabase}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Sin base de datos asignada.</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={editingCampaign?.targetDatabase || "__none__"}
                  onValueChange={(v) => {
                    updateCampaignMutation.mutate(
                      { id: editingCampaignId!, updates: { targetDatabase: v === "__none__" ? null : v } },
                      {
                        onSuccess: () => {
                          toast({ title: "Base de datos actualizada" });
                        },
                      }
                    );
                  }}
                  disabled={isLocked}
                >
                  <SelectTrigger data-testid="select-editor-database" className="w-48 text-xs rounded-xl">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin base de datos</SelectItem>
                    {userDatabases.map(db => (
                      <SelectItem key={db.id} value={String(db.id)}>{db.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {!isSent && !isSending && !isFailed && !isPartial && ((generateVersionMutation.isPending || createCampaignMutation.isPending) ? (
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
                    {imageApproved && !isLocked && !isResend && (
                      <div className="flex items-center gap-2">
                        <span data-testid="badge-image-approved" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Aprobada
                        </span>
                        <button
                          data-testid="button-unapprove-image"
                          onClick={() => { setImageApproved(false); toast({ title: "Aprobación de imagen retirada" }); }}
                          className="text-[10px] text-muted-foreground hover:text-destructive underline"
                        >
                          Desaprobar
                        </button>
                      </div>
                    )}
                    {imageApproved && (isLocked || isResend) && (
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
                      className="w-full object-contain max-h-[400px]"
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
                  {selectedImageUrl.includes("placehold.co") && (
                    <div data-testid="warning-placeholder-image" className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Imagen de prueba</p>
                        <p className="text-[11px] text-amber-600 mt-0.5">La imagen actual es un placeholder. Regenere con IA o cargue su propia imagen antes de aprobar.</p>
                      </div>
                    </div>
                  )}

                  {!isResend && !imageApproved && (
                    <div className="flex flex-wrap gap-2">
                      {((editingCampaign as any)?.imageRegenCount || 0) >= 2 ? (
                        <span data-testid="text-image-regen-exhausted" className="text-xs text-gray-400 italic flex items-center gap-1 px-2 py-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Regeneraciones de imagen agotadas
                        </span>
                      ) : (
                      <Button
                        data-testid="button-regenerate-image"
                        size="sm"
                        className="rounded-xl gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={handleRegenerateImage}
                        disabled={isCancelled || isSent || regenerateImageMutation.isPending || generateVersionMutation.isPending}
                      >
                        {regenerateImageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Regenerar ({Math.max(0, 2 - ((editingCampaign as any)?.imageRegenCount || 0))})
                      </Button>
                      )}
                      <Button
                        data-testid="button-upload-image"
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1 border-slate-300 hover:bg-slate-50"
                        disabled={isLocked}
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
                      {((editingCampaign as any)?.imageRegenCount || 0) < 2 && (
                      <Button
                        data-testid="button-nano-banana"
                        size="sm"
                        className="rounded-xl gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={handleEditWithNanoBanana}
                        disabled={isCancelled || isSent || editImageMutation.isPending || !selectedImageVersion?.imageUrl || !!editorLocalImageUrl}
                      >
                        {editImageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        Nano Banana
                      </Button>
                      )}
                    </div>
                  )}

                  {!isResend && !imageApproved && imageVersions.length > 1 && (
                    <Button
                      data-testid="button-image-history"
                      variant={showImageHistory ? "default" : "secondary"}
                      size="sm"
                      className="rounded-xl gap-1 w-full"
                      onClick={() => setShowImageHistory(!showImageHistory)}
                    >
                      <History className="w-3.5 h-3.5" />
                      Imágenes ({imageVersions.length})
                    </Button>
                  )}

                  {!isResend && !imageApproved && (
                    <AnimatePresence>
                      {showImageHistory && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                            {imageVersions.map(v => (
                              <button
                                key={v.id}
                                data-testid={`button-select-image-${v.versionNumber}`}
                                onClick={() => !isLocked && handleSelectImageVersion(v.id)}
                                disabled={isLocked}
                                className={`rounded-lg border-2 overflow-hidden transition-all ${selectedImageVersion?.id === v.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"} ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                              >
                                <img src={v.imageUrl || "https://placehold.co/600x300/002073/white?text=V" + v.versionNumber} alt={`Versión ${v.versionNumber}`} className="w-full h-16 object-cover" />
                                <span className="text-[10px] font-medium block py-0.5 text-center">V{v.versionNumber}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}

                  {isResend && (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Imagen del correo original (no editable)
                    </div>
                  )}

                  {!imageApproved && !isLocked && !isResend && (
                    <Button
                      data-testid="button-approve-image"
                      onClick={handleApproveImage}
                      className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="w-4 h-4" />
                      Aprobar Imagen
                    </Button>
                  )}

                  {!(textApproved && imageApproved) && (
                    <Button
                      data-testid="button-toggle-preview"
                      onClick={() => setShowPreview(true)}
                      className="w-full rounded-xl gap-2 text-white"
                      style={{ backgroundColor: "#002073" }}
                    >
                      <Eye className="w-4 h-4" />
                      Vista Previa del Correo
                    </Button>
                  )}
                </div>

                <div className="space-y-4 relative">
                  {!isResend && regenerateTextMutation.isPending && (
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
                    {textApproved && !isLocked && !isResend && (
                      <div className="flex items-center gap-2">
                        <span data-testid="badge-text-approved" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Aprobado
                        </span>
                        <button
                          data-testid="button-unapprove-text"
                          onClick={() => { setTextApproved(false); toast({ title: "Aprobación de texto retirada" }); }}
                          className="text-[10px] text-muted-foreground hover:text-destructive underline"
                        >
                          Desaprobar
                        </button>
                      </div>
                    )}
                    {textApproved && (isLocked || isResend) && (
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
                        onChange={(e) => { setLocalAsunto(e.target.value); setHasUnsavedChanges(true); setTextApprovedLocal(false); }}
                        maxLength={60}
                        disabled={isLocked || textApproved}
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
                        onChange={(e) => { setLocalPreheader(e.target.value); setHasUnsavedChanges(true); setTextApprovedLocal(false); }}
                        maxLength={100}
                        disabled={isLocked || textApproved}
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
                            editable={!isLocked && !textApproved}
                          />
                        ) : (
                          <div className="p-4 text-sm text-muted-foreground">Sin contenido generado aún.</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Botón de acción (CTA)</Label>
                        <div className="flex items-center gap-2">
                          {ctaEnabled && <span className="text-[10px] text-muted-foreground">{localCta.length}/25</span>}
                          <Button
                            data-testid="button-toggle-cta"
                            variant="ghost"
                            size="sm"
                            className={`h-6 px-2 text-xs ${ctaEnabled ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-700'}`}
                            disabled={isLocked || textApproved}
                            onClick={() => { setCtaEnabled(!ctaEnabled); setHasUnsavedChanges(true); setTextApprovedLocal(false); }}
                          >
                            {ctaEnabled ? <><Trash2 className="h-3 w-3 mr-1" />Quitar</> : <><PlusCircle className="h-3 w-3 mr-1" />Añadir</>}
                          </Button>
                        </div>
                      </div>
                      {ctaEnabled && (
                        <>
                          <Input
                            data-testid="input-edit-cta"
                            value={localCta}
                            onChange={(e) => { setLocalCta(e.target.value); setHasUnsavedChanges(true); setTextApprovedLocal(false); }}
                            maxLength={40}
                            disabled={isLocked || textApproved}
                            placeholder="Texto del botón CTA"
                            className="rounded-xl"
                          />
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Enlace del botón (URL)</Label>
                          <Input
                            data-testid="input-edit-cta-url"
                            value={localCtaUrl}
                            onChange={(e) => { setLocalCtaUrl(e.target.value); setHasUnsavedChanges(true); setTextApprovedLocal(false); }}
                            maxLength={500}
                            disabled={isLocked || textApproved}
                            placeholder="https://ejemplo.com/promo"
                            className="rounded-xl"
                            type="url"
                          />
                        </>
                      )}
                      {!ctaEnabled && (
                        <p className="text-xs text-muted-foreground italic">El botón CTA no se incluirá en el correo.</p>
                      )}
                    </div>
                  </div>

                  {hasUnsavedChanges && (
                    <Button
                      data-testid="button-save-text-changes"
                      onClick={handleSaveTextChanges}
                      disabled={isCancelled || isSent || updateVersionMutation.isPending}
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

                  {!isResend && !textApproved && (
                    <div className="flex flex-wrap gap-2">
                      {((editingCampaign as any)?.textRegenCount || 0) >= 2 ? (
                        <span data-testid="text-text-regen-exhausted" className="text-xs text-gray-400 italic flex items-center gap-1 px-2 py-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Regeneraciones de texto agotadas
                        </span>
                      ) : (
                      <Button
                        data-testid="button-regenerate-text"
                        size="sm"
                        className="rounded-xl gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={handleRegenerateText}
                        disabled={isCancelled || isSent || regenerateTextMutation.isPending || generateVersionMutation.isPending}
                      >
                        {regenerateTextMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Regenerar Texto ({Math.max(0, 2 - ((editingCampaign as any)?.textRegenCount || 0))})
                      </Button>
                      )}
                      {textVersions.length > 1 && (
                        <Button
                          data-testid="button-text-history"
                          variant={showTextHistory ? "default" : "secondary"}
                          size="sm"
                          className="rounded-xl gap-1"
                          onClick={() => setShowTextHistory(!showTextHistory)}
                        >
                          <History className="w-3.5 h-3.5" />
                          Seleccionar Textos ({textVersions.length})
                        </Button>
                      )}
                    </div>
                  )}

                  {!isResend && !textApproved && (
                    <AnimatePresence>
                      {showTextHistory && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-2 border-t border-border">
                            {textVersions.map(v => {
                              const vContent = v.contentJson as any;
                              const html = vContent?.cuerpo_html
                                || vContent?.html
                                || vContent?.body
                                || "";
                              return (
                                <button
                                  key={v.id}
                                  data-testid={`button-select-text-${v.versionNumber}`}
                                  onClick={() => !isLocked && handleSelectTextVersion(v.id)}
                                  disabled={isLocked}
                                  className={`w-full p-3 rounded-xl text-left border-2 transition-all text-sm ${selectedTextVersion?.id === v.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"} ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold text-xs">Versión {v.versionNumber}</span>
                                    {selectedTextVersion?.id === v.id && <span className="text-[10px] font-semibold text-primary">Seleccionada</span>}
                                  </div>
                                  <div className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: html.replace(/<[^>]*>/g, " ").substring(0, 120) }} />
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}

                  {!textApproved && !isLocked && (
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

            </>
          ))}

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
                    srcDoc={(() => {
                      const tpl = editingCampaign?.templateId ? userTemplates.find(t => t.id === editingCampaign.templateId) : null;
                      const asunto = localAsunto || selectedAsunto || "";
                      const preheader = localPreheader || selectedPreheader || "";
                      const imagen = selectedImageUrl || "https://placehold.co/600x300/002073/white?text=Sin+Imagen";
                      const contenido = selectedHtml || "";
                      const ctaTexto = ctaEnabled ? (localCta || selectedCtaText || "") : "";
                      const ctaUrl = ctaEnabled ? (localCtaUrl || selectedCtaUrl || "#") : "";
                      const logoUrl = brandIdentity?.logoUrl || "";
                      if (tpl?.html) {
                        let rendered = tpl.html;
                        if (!ctaEnabled) {
                          rendered = rendered.replace(/<!--\s*(?:BLOQUE\s*\d+\s*:\s*)?Botón CTA\s*-->\s*<tr>[\s\S]*?<\/tr>/i, '');
                        }
                        rendered = rendered.replace(/\{\{ASUNTO\}\}/g, asunto);
                        rendered = rendered.replace(/\{\{PREHEADER\}\}/g, preheader);
                        rendered = rendered.replace(/\{\{CONTENIDO\}\}/g, contenido);
                        rendered = rendered.replace(/\{\{CTA_TEXTO\}\}/g, ctaTexto);
                        rendered = rendered.replace(/\{\{CTA_URL\}\}/g, ctaUrl);
                        rendered = rendered.replace(/\{\{IMAGEN_URL\}\}/g, imagen);
                        rendered = rendered.replace(/\{\{LOGO_URL\}\}/g, logoUrl);
                        return `<html><body style="margin:0;font-family:Arial,sans-serif;overflow:hidden">${rendered}<script>
                          function sendHeight(){var h=document.body.scrollHeight;parent.postMessage({type:'preview-height',height:h},'*');}
                          window.addEventListener('load',function(){setTimeout(sendHeight,100);});
                          new MutationObserver(sendHeight).observe(document.body,{childList:true,subtree:true});
                          var imgs=document.querySelectorAll('img');
                          for(var i=0;i<imgs.length;i++){imgs[i].addEventListener('load',sendHeight);}
                        </script></body></html>`;
                      }
                      return `<html><body style="margin:0;font-family:Arial,sans-serif;overflow:hidden">
                        <div style="max-width:600px;margin:0 auto">
                          ${asunto ? `<div style="padding:16px 24px;background:#002073;color:white"><h2 style="margin:0;font-size:18px">${asunto}</h2>${preheader ? `<p style="margin:4px 0 0;font-size:12px;opacity:0.8">${preheader}</p>` : ""}</div>` : ""}
                          <img src="${imagen}" style="width:100%;height:auto;display:block" />
                          <div style="padding:24px">${contenido}</div>
                          ${ctaEnabled && ctaTexto ? `<div style="padding:0 24px 24px;text-align:center"><a href="${ctaUrl}" style="display:inline-block;padding:12px 32px;background:#002073;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px">${ctaTexto}</a></div>` : ""}
                        </div>
                        <script>
                          function sendHeight(){var h=document.body.scrollHeight;parent.postMessage({type:'preview-height',height:h},'*');}
                          window.addEventListener('load',function(){setTimeout(sendHeight,100);});
                          new MutationObserver(sendHeight).observe(document.body,{childList:true,subtree:true});
                          var imgs=document.querySelectorAll('img');
                          for(var i=0;i<imgs.length;i++){imgs[i].addEventListener('load',sendHeight);}
                        </script>
                      </body></html>`;
                    })()}
                    sandbox="allow-scripts"
                    className="w-full border-0"
                    style={{ minHeight: "400px", height: previewHeight > 0 ? previewHeight + "px" : "600px" }}
                    title="Vista previa completa"
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
                {sortedTemplatesForSelector.map(t => (
                  <button
                    key={t.id}
                    data-testid={`button-assign-template-${t.id}`}
                    onClick={() => t.hasAllPlaceholders && handleAssignTemplate(String(t.id))}
                    disabled={!t.hasAllPlaceholders}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${!t.hasAllPlaceholders ? "opacity-50 cursor-not-allowed" : "hover:border-primary/40 cursor-pointer"} ${editingCampaign?.templateId === t.id ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <div className="w-24 h-16 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-muted-foreground" />
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

        <Dialog open={showRegenTextModal} onOpenChange={(open) => { if (!open && regenerateTextMutation.isPending) return; setShowRegenTextModal(open); }}>
          <DialogContent className="sm:max-w-lg rounded-2xl" onInteractOutside={e => { if (regenerateTextMutation.isPending) e.preventDefault(); }} onEscapeKeyDown={e => { if (regenerateTextMutation.isPending) e.preventDefault(); }}>
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

        <Dialog open={showRegenImageModal} onOpenChange={(open) => { if (!open && regenerateImageMutation.isPending) return; setShowRegenImageModal(open); }}>
          <DialogContent className="sm:max-w-lg rounded-2xl" onInteractOutside={e => { if (regenerateImageMutation.isPending) e.preventDefault(); }} onEscapeKeyDown={e => { if (regenerateImageMutation.isPending) e.preventDefault(); }}>
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
                <Label className="text-xs font-semibold uppercase tracking-wide">Prompt de imagen</Label>
                <Textarea
                  data-testid="input-regen-image-prompt"
                  placeholder="Escriba un prompt para la imagen..."
                  value={regenImagePrompt}
                  onChange={e => setRegenImagePrompt(e.target.value)}
                  className="rounded-xl min-h-[120px]"
                  maxLength={1200}
                />
                <div className="flex justify-end">
                  <span className="text-[10px] text-muted-foreground">{regenImagePrompt.length}/1200</span>
                </div>
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

        <Dialog open={showEditImageModal} onOpenChange={(open) => { if (!open && editImageMutation.isPending) return; setShowEditImageModal(open); }}>
          <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => { if (editImageMutation.isPending) e.preventDefault(); }} onEscapeKeyDown={e => { if (editImageMutation.isPending) e.preventDefault(); }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-amber-500" />
                Compositor Avanzado — Nano Banana
              </DialogTitle>
              <DialogDescription>
                Seleccione una acción, agregue imágenes de referencia si lo necesita, y describa lo que desea hacer.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="border border-border rounded-xl overflow-hidden bg-white">
                <img
                  data-testid="img-edit-preview"
                  src={selectedImageUrl}
                  alt="Imagen base"
                  className="w-full h-40 object-cover"
                />
                <p className="text-[10px] text-muted-foreground text-center py-1 bg-muted/30">Imagen base (se editará esta imagen)</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">Acción</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "agregar", label: "Agregar", icon: PlusCircle, desc: "Logos, productos" },
                    { key: "reemplazar", label: "Reemplazar", icon: RefreshCw, desc: "Enmascaramiento" },
                    { key: "fusionar", label: "Fusionar", icon: Layers, desc: "Composición" },
                    { key: "estilo", label: "Estilo", icon: Palette, desc: "Transferencia" },
                    { key: "borrar_elemento", label: "Borrar Elemento", icon: Eraser, desc: "Inpainting" },
                  ].map(action => (
                    <button
                      key={action.key}
                      data-testid={`action-${action.key}`}
                      onClick={() => {
                        setAdvancedAction(action.key);
                        if (action.key === "borrar_elemento") setReferenceImages([]);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all ${
                        advancedAction === action.key
                          ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                          : "bg-card border-border text-muted-foreground hover:border-amber-300"
                      }`}
                    >
                      <action.icon className="w-3.5 h-3.5" />
                      {action.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {advancedAction === "agregar" && "Integra un elemento de referencia preservando su fidelidad visual."}
                  {advancedAction === "reemplazar" && "Reemplaza un elemento específico usando la referencia como guía."}
                  {advancedAction === "fusionar" && "Combina la imagen base con las referencias en una composición natural."}
                  {advancedAction === "estilo" && "Aplica el estilo artístico de la referencia a la imagen base."}
                  {advancedAction === "borrar_elemento" && "Elimina un elemento y rellena el espacio de forma natural (inpainting)."}
                </p>
              </div>

              {advancedAction !== "borrar_elemento" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Imágenes de Referencia (máx. 3)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {referenceImages.map((img, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                        <img src={img} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          data-testid={`remove-ref-${i}`}
                          onClick={() => removeReferenceImage(i)}
                          className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {referenceImages.length < 3 && (
                      <button
                        data-testid="button-add-ref-upload"
                        onClick={() => refFileInputRef.current?.click()}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-amber-400 hover:text-amber-500 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        <span className="text-[9px]">Subir</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={refFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleRefImageUpload}
                  />

                  {versions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium">O seleccione del historial:</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {versions
                          .filter(v => v.imageUrl && !referenceImages.includes(v.imageUrl))
                          .map(v => (
                            <button
                              key={v.id}
                              data-testid={`ref-history-${v.id}`}
                              onClick={() => v.imageUrl && handleSelectHistoryImage(v.imageUrl)}
                              disabled={referenceImages.length >= 3}
                              className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-amber-400 transition-colors disabled:opacity-40"
                            >
                              <img src={v.imageUrl} alt={`V${v.versionNumber}`} className="w-full h-full object-cover" />
                            </button>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">Instrucciones</Label>
                <Textarea
                  data-testid="input-edit-image-prompt"
                  placeholder={ACTION_PLACEHOLDERS[advancedAction] || "Describa lo que desea hacer..."}
                  value={editImagePrompt}
                  onChange={e => setEditImagePrompt(e.target.value)}
                  className="rounded-xl min-h-[80px]"
                  maxLength={1200}
                />
              </div>

              <Button
                data-testid="button-confirm-edit-image"
                onClick={() => editingCampaignId && editImageMutation.mutate({
                  campaignId: editingCampaignId,
                  editPrompt: editImagePrompt,
                  selectedAction: advancedAction,
                  refImages: referenceImages,
                })}
                disabled={!editImagePrompt.trim() || editImageMutation.isPending}
                className="w-full rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {editImageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Aplicar Edición
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
          <DialogContent data-testid="dialog-reschedule" className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Reprogramar Envío
              </DialogTitle>
              <DialogDescription>
                {editingCampaign?.scheduledAt && new Date(editingCampaign.scheduledAt).getTime() <= Date.now()
                  ? "La hora programada originalmente ya pasó. Por favor selecciona una nueva fecha y hora para enviar tu correo."
                  : "Selecciona una nueva fecha y hora para el envío de tu correo."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Nueva fecha y hora de envío</Label>
                <Input
                  data-testid="input-reschedule-date"
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <Button
                data-testid="button-confirm-reschedule"
                onClick={handleReschedule}
                disabled={!rescheduleDate || updateCampaignMutation.isPending}
                className="w-full rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {updateCampaignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Confirmar Nueva Fecha
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TutorialHighlight fieldId="calendar-overview">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">Calendario</h1>
              <p className="text-muted-foreground mt-1">Organiza tu estrategia mensual. Haz clic en cualquier día para crear una nueva campaña con IA o gestionar tus envíos programados.</p>
            </div>
          </TutorialHighlight>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                data-testid="button-clear-history"
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={deleteAllCampaignsMutation.isPending}
              >
                {deleteAllCampaignsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Vaciar Historial
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Vaciar todo el historial?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará TODOS los correos y sus versiones generadas de todos los meses. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  data-testid="button-confirm-clear-history"
                  onClick={() => deleteAllCampaignsMutation.mutate()}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
                >
                  Sí, vaciar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
        <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedDay} de {MONTHS[month]} {year}
            </DialogTitle>
            <DialogDescription>
              Elija qué desea hacer con esta fecha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2 overflow-hidden min-w-0">
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
              <div
                key={campaign.id}
                data-testid={`button-choice-edit-${campaign.id}`}
                role="button"
                tabIndex={0}
                onClick={() => handleEditCampaign(campaign.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleEditCampaign(campaign.id); }}
                className="w-full rounded-xl border shadow-xs flex items-center gap-2 text-left py-3 px-4 hover:bg-accent/5 transition-colors cursor-pointer"
                style={{ overflow: 'hidden' }}
              >
                <Pencil className="w-5 h-5 text-accent flex-shrink-0" />
                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <div className="font-semibold text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.name || campaign.idea}</div>
                  <div className="text-xs text-muted-foreground capitalize">{STATUS_MAP[campaign.status] || campaign.status}</div>
                </div>
              </div>
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
            <TutorialHighlight fieldId="idea">
              <div className="space-y-2">
                <Label>Idea / Tema</Label>
                <Textarea
                  data-testid="input-calendar-idea"
                  placeholder="Ej: Promoción de verano con 30% de descuento en todo el catálogo"
                  value={form.idea}
                  onChange={e => setForm(f => ({ ...f, idea: e.target.value }))}
                  onBlur={() => advanceTutorialOnBlur("idea", form.idea)}
                  className="rounded-xl min-h-[80px]"
                  maxLength={1000}
                />
              </div>
            </TutorialHighlight>
            <TutorialHighlight fieldId="objective">
              <div className="space-y-2">
                <Label>Objetivo</Label>
                <Textarea
                  data-testid="input-calendar-objective"
                  placeholder="Ej: Aumentar ventas del catálogo nuevo, generar tráfico al sitio web"
                  value={form.objective}
                  onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                  onBlur={() => advanceTutorialOnBlur("objective", form.objective)}
                  className="rounded-xl min-h-[70px]"
                  maxLength={1000}
                />
              </div>
            </TutorialHighlight>
            <TutorialHighlight fieldId="targetAudience">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    data-testid="checkbox-target-audience"
                    type="checkbox"
                    id="targetAudienceToggle"
                    checked={showTargetAudience}
                    onChange={e => {
                      setShowTargetAudience(e.target.checked);
                      if (!e.target.checked) setForm(f => ({ ...f, targetAudience: "" }));
                    }}
                    className="rounded border-border"
                  />
                  <Label htmlFor="targetAudienceToggle" className="cursor-pointer text-sm">Definir público objetivo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                </div>
                <AnimatePresence>
                  {showTargetAudience && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <Textarea
                        data-testid="input-calendar-target-audience"
                        placeholder="Ej: Gerentes de logística en Centroamérica, directores de marketing de empresas medianas"
                        value={form.targetAudience}
                        onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                        onBlur={() => advanceTutorialOnBlur("targetAudience", form.targetAudience)}
                        className="rounded-xl min-h-[60px] mt-1"
                        maxLength={1000}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TutorialHighlight>
            <TutorialHighlight fieldId="imagePrompt">
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
                      onBlur={() => advanceTutorialOnBlur("imagePrompt", form.imagePrompt)}
                      className="rounded-xl min-h-[70px] mt-2"
                      maxLength={1200}
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
            </TutorialHighlight>
            <TutorialHighlight fieldId="template">
              <div className="space-y-2">
                <Label>Plantilla</Label>
                <Select
                  value={form.templateId}
                  onValueChange={(v) => {
                    setForm(f => ({ ...f, templateId: v }));
                    if (tutorial.tutorialActive && tutorial.getCurrentStep()?.fieldId === "template" && v) {
                      tutorial.nextStep();
                    }
                  }}
                >
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
            </TutorialHighlight>
            <TutorialHighlight fieldId="targetDatabase">
              <div className="space-y-2">
                <Label>Base de Datos de Destino</Label>
                <Select
                  value={form.targetDatabase}
                  onValueChange={(v) => {
                    setForm(f => ({ ...f, targetDatabase: v }));
                    if (tutorial.tutorialActive && tutorial.getCurrentStep()?.fieldId === "targetDatabase" && v) {
                      tutorial.nextStep();
                    }
                  }}
                >
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
            </TutorialHighlight>
            <TutorialHighlight fieldId="scheduledDate">
              <div className="space-y-2">
                <Label>Fecha y Hora de Programación</Label>
                <Input
                  data-testid="input-calendar-date"
                  type="datetime-local"
                  value={form.scheduledDate}
                  onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                  onBlur={() => advanceTutorialOnBlur("scheduledDate", form.scheduledDate)}
                  className="rounded-xl"
                  min={(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}T${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; })()}
                />
              </div>
            </TutorialHighlight>
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
      <TutorialTip />
      <AlertDialog open={!!pendingVersionSwitch} onOpenChange={(open) => { if (!open) setPendingVersionSwitch(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Tiene cambios de texto sin guardar. Si cambia de versión ahora, perderá estos cambios. ¿Desea continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingVersionSwitch(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingVersionSwitch) {
                pendingVersionSwitch.fn();
              }
              setPendingVersionSwitch(null);
            }}>
              Cambiar de versión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
