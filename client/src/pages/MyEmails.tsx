import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Clock, Check, CalendarDays, Send, ArrowRight, Loader2, ChevronDown, Lightbulb, Target, MessageSquare, Database, LayoutTemplate, Image, Users, Filter, X, RefreshCw, Eye, Trash2, CheckSquare, Square, AlertTriangle, XCircle, Ban } from "lucide-react";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialHighlight } from "@/components/TutorialHighlight";
import { TutorialTip } from "@/components/TutorialTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TipTapEditor } from "@/components/TipTapEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Campaign } from "@shared/schema";

interface CampaignVersion {
  id: number;
  campaignId: number;
  versionNumber: number;
  contentJson: any;
  imageUrl: string | null;
  isSelected: boolean;
  type: string;
  sentHtml: string | null;
}

interface ContactDatabaseType {
  id: number;
  name: string;
  userId: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-700", icon: Clock },
  scheduled: { label: "Programado", color: "bg-blue-100 text-blue-700", icon: CalendarDays },
  sending: { label: "Enviando", color: "bg-amber-100 text-amber-700", icon: Send },
  sent: { label: "Enviado", color: "bg-emerald-100 text-emerald-700", icon: Check },
  partial: { label: "Parcial", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  failed: { label: "Fallido", color: "bg-red-100 text-red-700", icon: XCircle },
  cancelled: { label: "Cancelado", color: "bg-slate-100 text-slate-600", icon: Ban },
};

const STATUS_ORDER = ["draft", "scheduled", "sending", "sent", "partial", "failed", "cancelled"] as const;

export default function MyEmails() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { setCurrentSection, tutorialActive } = useTutorial();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [resendCampaign, setResendCampaign] = useState<Campaign | null>(null);
  const [resendSubject, setResendSubject] = useState("");
  const [resendPreheader, setResendPreheader] = useState("");
  const [resendBody, setResendBody] = useState("");
  const [resendCta, setResendCta] = useState("");
  const [resendCtaUrl, setResendCtaUrl] = useState("");
  const [resendDatabase, setResendDatabase] = useState("");
  const [resendDate, setResendDate] = useState("");
  const [resendTime, setResendTime] = useState("");

  const resendMutation = useMutation({
    mutationFn: async (data: { campaignId: number; subject: string; preheader: string; body: string; cta: string; ctaUrl: string; targetDatabase: string; scheduledAt: string }) => {
      const res = await apiRequest("POST", `/api/campaigns/${data.campaignId}/resend`, data);
      return res.json();
    },
    onSuccess: (newCampaign: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setResendCampaign(null);
      toast({ title: "Campaña programada", description: "Se agregó al calendario como reenvío." });
      setTimeout(() => setLocation(`/calendar?edit=${newCampaign.id}`), 300);
    },
    onError: (err: Error) => {
      toast({ title: "Error al reenviar", description: err.message, variant: "destructive" });
    },
  });

  const deleteSelectedMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("DELETE", "/api/campaigns", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setSelectedIds(new Set());
      setSelectionMode(false);
      toast({ title: "Correos eliminados", description: "Los correos indicados han sido eliminados." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudieron eliminar los correos.", variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/campaigns");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setSelectedIds(new Set());
      setSelectionMode(false);
      toast({ title: "Historial vaciado", description: "Todos los correos han sido eliminados." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo vaciar el historial.", variant: "destructive" });
    },
  });

  function toggleSelection(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map(c => c.id)));
    }
  }

  useEffect(() => {
    setCurrentSection("emails");
  }, [setCurrentSection]);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: databases = [] } = useQuery<ContactDatabaseType[]>({
    queryKey: ["/api/contact-databases"],
  });

  const campaignIds = useMemo(() => campaigns.map(c => c.id), [campaigns]);

  const { data: allVersions = [] } = useQuery<CampaignVersion[]>({
    queryKey: ["/api/campaigns/versions-bulk", campaignIds.join(",")],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];
      const results: CampaignVersion[] = [];
      for (const id of campaignIds) {
        const res = await fetch(`/api/campaigns/${id}/versions`, { credentials: "include" });
        if (res.ok) {
          const vs = await res.json();
          results.push(...vs);
        }
      }
      return results;
    },
    enabled: campaignIds.length > 0,
  });

  const statusByCampaign = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of campaigns) m.set(c.id, c.status);
    return m;
  }, [campaigns]);

  const versionsByCampaign = useMemo(() => {
    const grouped = new Map<number, CampaignVersion[]>();
    for (const v of allVersions) {
      const arr = grouped.get(v.campaignId) || [];
      arr.push(v);
      grouped.set(v.campaignId, arr);
    }
    const map = new Map<number, { contentJson: any; imageUrl: string | null }>();
    grouped.forEach((versions, campaignId) => {
      const ordered = [...versions].sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0));
      const status = statusByCampaign.get(campaignId);
      const isHistorical = status === "sent" || status === "partial" || status === "failed";

      const lastSelectedAny = [...ordered].reverse().find(v => v.isSelected);
      const currentSrc = lastSelectedAny || ordered[ordered.length - 1];

      let textSrc: CampaignVersion | undefined = currentSrc;
      if (isHistorical) {
        const sentVersions = ordered.filter(v => v.sentHtml);
        const lastSent = sentVersions[sentVersions.length - 1];
        if (lastSent) textSrc = lastSent;
      }

      const imageVersions = ordered.filter(v => v.type === "initial" || v.type === "image");
      let imgSrc: CampaignVersion | undefined;
      if (isHistorical && textSrc?.sentHtml) {
        const sentVN = textSrc.versionNumber ?? 0;
        imgSrc = [...imageVersions].reverse().find(v => (v.versionNumber ?? 0) <= sentVN);
        if (!imgSrc) imgSrc = imageVersions[imageVersions.length - 1];
      } else {
        const lastSelectedImage = [...imageVersions].reverse().find(v => v.isSelected);
        imgSrc = lastSelectedImage || imageVersions[imageVersions.length - 1];
      }

      map.set(campaignId, {
        contentJson: (textSrc?.contentJson as any) || {},
        imageUrl: imgSrc?.imageUrl || textSrc?.imageUrl || null,
      });
    });
    return map;
  }, [allVersions, statusByCampaign]);

  const dbNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const db of databases) {
      map.set(String(db.id), db.name);
    }
    return map;
  }, [databases]);

  const baseHistory = useMemo(() => campaigns, [campaigns]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of baseHistory) counts[c.status] = (counts[c.status] || 0) + 1;
    return counts;
  }, [baseHistory]);

  const hasDateFilter = !!(dateFrom || dateTo);
  const hasStatusFilter = selectedStatuses.size > 0;
  const hasActiveFilter = hasDateFilter || hasStatusFilter;

  const history = useMemo(() => {
    return baseHistory
      .filter(c => {
        if (!hasStatusFilter) return true;
        return selectedStatuses.has(c.status);
      })
      .filter(c => {
        if (!hasDateFilter) return true;
        if (!c.scheduledAt) return false;
        const d = new Date(c.scheduledAt).getTime();
        if (dateFrom && d < new Date(dateFrom).getTime()) return false;
        if (dateTo && d > new Date(dateTo + "T23:59:59").getTime()) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return dateB - dateA;
      });
  }, [baseHistory, hasStatusFilter, selectedStatuses, hasDateFilter, dateFrom, dateTo]);

  function toggleStatus(status: string) {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function clearAllFilters() {
    setDateFrom("");
    setDateTo("");
    setSelectedStatuses(new Set());
  }

  function openResendPopup(campaign: Campaign) {
    const version = versionsByCampaign.get(campaign.id);
    const content = version?.contentJson || {};
    setResendCampaign(campaign);
    setResendSubject(content.asunto || content.subject || "");
    setResendPreheader(content.preheader || "");
    setResendBody(content.cuerpo_html || content.body || "");
    setResendCta(content.cta_text || content.cta || "");
    setResendCtaUrl(content.cta_url || content.ctaUrl || "");
    setResendDatabase(campaign.targetDatabase || "");
    setResendDate("");
    setResendTime("");
  }

  function handleResendSubmit() {
    if (!resendCampaign) return;
    if (!resendDate || !resendTime) {
      toast({ title: "Fecha requerida", description: "Seleccione fecha y hora para programar el reenvío.", variant: "destructive" });
      return;
    }
    const scheduledAt = `${resendDate}T${resendTime}:00`;
    resendMutation.mutate({
      campaignId: resendCampaign.id,
      subject: resendSubject,
      preheader: resendPreheader,
      body: resendBody,
      cta: resendCta,
      ctaUrl: resendCtaUrl,
      targetDatabase: resendDatabase,
      scheduledAt,
    });
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Historial de Correos</h1>
            <p className="text-muted-foreground mt-1">Registro de correos enviados y programados.</p>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <>
                <Button
                  data-testid="button-toggle-selection"
                  variant={selectionMode ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    if (selectionMode) setSelectedIds(new Set());
                  }}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectionMode ? "Cancelar" : "Seleccionar"}
                </Button>
                {selectionMode && selectedIds.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        data-testid="button-delete-selected"
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={deleteSelectedMutation.isPending}
                      >
                        {deleteSelectedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Eliminar ({selectedIds.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar {selectedIds.size} correo(s)?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará los correos seleccionados y sus versiones. No se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          data-testid="button-confirm-delete-selected"
                          onClick={() => deleteSelectedMutation.mutate(Array.from(selectedIds))}
                          className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
                        >
                          Sí, eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      data-testid="button-clear-history"
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={deleteAllMutation.isPending || deleteSelectedMutation.isPending || history.length === 0}
                    >
                      {(deleteAllMutation.isPending || deleteSelectedMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      {hasActiveFilter ? `Vaciar lo filtrado (${history.length})` : "Vaciar Todo"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {hasActiveFilter
                          ? `¿Eliminar las ${history.length} campañas filtradas?`
                          : "¿Vaciar todo el historial?"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {hasActiveFilter
                          ? "Solo se eliminarán las campañas que coinciden con los filtros activos (estado y/o fechas). Las demás se conservan. No se puede deshacer."
                          : "Esta acción eliminará TODOS los correos y sus versiones generadas. No se puede deshacer."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        data-testid="button-confirm-clear-history"
                        onClick={() => {
                          if (hasActiveFilter) {
                            deleteSelectedMutation.mutate(history.map(c => c.id));
                          } else {
                            deleteAllMutation.mutate();
                          }
                        }}
                        className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
                      >
                        {hasActiveFilter ? `Sí, eliminar ${history.length}` : "Sí, vaciar todo"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <Button
              data-testid="button-toggle-filters"
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtrar
              {hasActiveFilter && <span className="w-2 h-2 rounded-full bg-white" />}
            </Button>
            <Link href="/calendar">
              <Button data-testid="button-go-calendar" className="rounded-xl gap-2">
                <CalendarDays className="w-4 h-4" />
                Ir al Calendario
              </Button>
            </Link>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-end gap-3">
                  <div className="space-y-1 flex-1 w-full">
                    <Label className="text-xs text-muted-foreground">Desde</Label>
                    <Input
                      data-testid="input-filter-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1 flex-1 w-full">
                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                    <Input
                      data-testid="input-filter-date-to"
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  {hasActiveFilter && (
                    <Button
                      data-testid="button-clear-filters"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl gap-1 text-muted-foreground hover:text-foreground"
                      onClick={clearAllFilters}
                    >
                      <X className="w-3.5 h-3.5" />
                      Limpiar
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground" id="status-filter-label">Estado</Label>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="status-filter-label">
                    {STATUS_ORDER.map(status => {
                      const cfg = statusConfig[status];
                      const Icon = cfg.icon;
                      const count = statusCounts[status] || 0;
                      const active = selectedStatuses.has(status);
                      const disabled = count === 0 && !active;
                      return (
                        <button
                          key={status}
                          type="button"
                          data-testid={`chip-status-${status}`}
                          onClick={() => toggleStatus(status)}
                          disabled={disabled}
                          aria-pressed={active}
                          aria-label={`${cfg.label} (${count})`}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all ${
                            active
                              ? `${cfg.color} border-current shadow-sm`
                              : disabled
                                ? "bg-muted/40 text-muted-foreground/50 border-transparent cursor-not-allowed"
                                : "bg-muted/60 text-muted-foreground border-transparent hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                          <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/60" : "bg-background/80"}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <TutorialHighlight fieldId="historial-overview">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-3">
            {selectionMode && (
              <div className="flex items-center gap-3 px-2">
                <button
                  data-testid="button-select-all"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {selectedIds.size === history.length ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  {selectedIds.size === history.length ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>
                <span className="text-xs text-muted-foreground">{selectedIds.size} de {history.length} seleccionados</span>
              </div>
            )}
            {history.map((campaign, i) => {
              const config = statusConfig[campaign.status] || statusConfig.draft;
              const StatusIcon = config.icon;
              const isExpanded = expandedId === campaign.id;
              const version = versionsByCampaign.get(campaign.id);
              const subject = version?.contentJson?.asunto || version?.contentJson?.subject || campaign.name;
              const scheduledDate = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null;
              const displayDate = scheduledDate
                ? `${scheduledDate.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })} a las ${scheduledDate.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`
                : "Sin fecha";
              const dbName = campaign.targetDatabase ? (dbNameMap.get(campaign.targetDatabase) || campaign.targetDatabase) : null;

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
                    onClick={() => selectionMode ? toggleSelection(campaign.id) : setExpandedId(isExpanded ? null : campaign.id)}
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    {selectionMode && (
                      <div className="flex-shrink-0" data-testid={`checkbox-campaign-${campaign.id}`}>
                        {selectedIds.has(campaign.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <StatusIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate" data-testid={`text-campaign-subject-${campaign.id}`}>{subject}</h3>
                      <p className="text-xs text-muted-foreground">{displayDate}</p>
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
                            {campaign.targetAudience && (
                              <DetailField icon={Users} label="Público objetivo" value={campaign.targetAudience} />
                            )}
                            {campaign.imagePrompt && (
                              <DetailField icon={Image} label="Prompt de imagen" value={campaign.imagePrompt} />
                            )}
                            {dbName && (
                              <DetailField icon={Database} label="Base de datos destino" value={dbName} />
                            )}
                          </div>
                          {campaign.status === "sent" && (
                            <div className="pt-3 mt-3 border-t border-border">
                              <Button
                                data-testid={`button-resend-${campaign.id}`}
                                size="sm"
                                className="rounded-xl gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openResendPopup(campaign);
                                }}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Reenviar Campaña
                              </Button>
                            </div>
                          )}
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
            <h3 className="text-lg font-bold mb-2">
              {hasActiveFilter && campaigns.length > 0 ? "Ningún correo coincide con los filtros" : "No hay correos en el historial"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {hasActiveFilter && campaigns.length > 0 ? "Prueba quitando o ajustando los filtros activos." : "Los correos que envíe o programe aparecerán aquí."}
            </p>
            {hasActiveFilter && campaigns.length > 0 ? (
              <Button
                data-testid="button-clear-filter-empty"
                variant="outline"
                className="rounded-xl gap-2"
                onClick={clearAllFilters}
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </Button>
            ) : (
              <Link href="/calendar">
                <Button className="rounded-xl gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Ir al Calendario
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        )}
        </TutorialHighlight>
        {tutorialActive && <TutorialTip />}
      </div>

      <Dialog open={!!resendCampaign} onOpenChange={(open) => { if (!open) setResendCampaign(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Reenviar Campaña
            </DialogTitle>
          </DialogHeader>

          {resendCampaign && (
            <div className="space-y-5">
              {versionsByCampaign.get(resendCampaign.id)?.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img
                    src={(() => {
                      const url = versionsByCampaign.get(resendCampaign.id)!.imageUrl!;
                      return url.startsWith("http") ? url : `/uploads/campaigns/${url}`;
                    })()}
                    alt="Preview"
                    className="w-full max-h-48 object-cover"
                  />
                </div>
              )}

              <div className="space-y-4">
                <h3 className="font-bold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                  <Eye className="w-4 h-4" />
                  Editar textos del correo
                </h3>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Asunto</Label>
                  <Input
                    data-testid="input-resend-subject"
                    value={resendSubject}
                    onChange={(e) => setResendSubject(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Preheader</Label>
                  <Input
                    data-testid="input-resend-preheader"
                    value={resendPreheader}
                    onChange={(e) => setResendPreheader(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contenido</Label>
                  <div data-testid="input-resend-body" className="border border-border rounded-xl overflow-hidden">
                    <TipTapEditor
                      key={resendCampaign?.id}
                      content={resendBody}
                      onChange={(html) => setResendBody(html)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Texto del botón (CTA)</Label>
                    <Input
                      data-testid="input-resend-cta"
                      value={resendCta}
                      onChange={(e) => setResendCta(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">URL del botón</Label>
                    <Input
                      data-testid="input-resend-cta-url"
                      value={resendCtaUrl}
                      onChange={(e) => setResendCtaUrl(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Base de datos</Label>
                  <Select value={resendDatabase} onValueChange={setResendDatabase}>
                    <SelectTrigger data-testid="select-resend-database" className="rounded-xl">
                      <SelectValue placeholder="Seleccionar base de datos" />
                    </SelectTrigger>
                    <SelectContent>
                      {databases.map(db => (
                        <SelectItem key={db.id} value={String(db.id)}>{db.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Fecha</Label>
                    <Input
                      data-testid="input-resend-date"
                      type="date"
                      value={resendDate}
                      onChange={(e) => setResendDate(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Hora</Label>
                    <Input
                      data-testid="input-resend-time"
                      type="time"
                      value={resendTime}
                      onChange={(e) => setResendTime(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <Button
                data-testid="button-resend-submit"
                className="w-full rounded-xl gap-2"
                onClick={handleResendSubmit}
                disabled={resendMutation.isPending}
              >
                {resendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CalendarDays className="w-4 h-4" />
                )}
                Agregar a Calendario
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
