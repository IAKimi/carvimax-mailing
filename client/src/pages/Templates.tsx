import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Star, StarOff, Trash2, Code, Eye, Loader2, Sparkles, Wand2, Pencil, CheckCircle2, AlertTriangle, Info, Check, X, GitBranch, Shield, ArrowRight, Type } from "lucide-react";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialHighlight } from "@/components/TutorialHighlight";
import { TutorialTip } from "@/components/TutorialTip";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import type { Template } from "@shared/schema";
import { TEMPLATE_PLACEHOLDERS, ALL_PLACEHOLDER_KEYS } from "@shared/schema";

function checkPlaceholders(html: string) {
  const present: string[] = [];
  const missing: string[] = [];
  for (const key of ALL_PLACEHOLDER_KEYS) {
    if (html.includes(key)) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }
  return { valid: missing.length === 0, present, missing };
}

export default function Templates() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setCurrentSection, tutorialActive } = useTutorial();
  const [showDialog, setShowDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showEditAiDialog, setShowEditAiDialog] = useState(false);
  const [showManualEditDialog, setShowManualEditDialog] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newHtml, setNewHtml] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [editAiInstructions, setEditAiInstructions] = useState("");
  const [manualHtml, setManualHtml] = useState("");
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [versionsParentId, setVersionsParentId] = useState<number | null>(null);
  const [showTextEditDialog, setShowTextEditDialog] = useState(false);
  const [textEditNodes, setTextEditNodes] = useState<{ index: number; original: string; edited: string }[]>([]);

  useEffect(() => {
    setCurrentSection("templates");
  }, [setCurrentSection]);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: onboardingStatus } = useQuery<{ hasBrand: boolean; hasTemplates: boolean; hasContactDatabases: boolean }>({
    queryKey: ["/api/onboarding-status"],
  });

  const displayTemplates = useMemo(() => {
    const parentGroups = new Map<number, Template[]>();
    for (const t of templates) {
      const parentId = (t as any).parentTemplateId;
      if (parentId && !(t as any).isConfirmed) {
        if (!parentGroups.has(parentId)) parentGroups.set(parentId, []);
        parentGroups.get(parentId)!.push(t);
      }
    }
    const parentsWithUnconfirmedChildren = new Set(parentGroups.keys());
    const shown = new Set<number>();
    const result: Template[] = [];
    for (const t of templates) {
      const parentId = (t as any).parentTemplateId;
      if (parentId && !(t as any).isConfirmed) {
        if (!shown.has(parentId)) {
          shown.add(parentId);
          const group = parentGroups.get(parentId)!;
          result.push(group.sort((a, b) => ((b as any).versionNumber || 1) - ((a as any).versionNumber || 1))[0]);
        }
      } else if (parentsWithUnconfirmedChildren.has(t.id)) {
        continue;
      } else {
        result.push(t);
      }
    }
    return result;
  }, [templates]);

  const sortedTemplates = useMemo(() => {
    return [...displayTemplates].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      if (a.hasAllPlaceholders && !b.hasAllPlaceholders) return -1;
      if (!a.hasAllPlaceholders && b.hasAllPlaceholders) return 1;
      return 0;
    });
  }, [displayTemplates]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; html: string }) => {
      const res = await apiRequest("POST", "/api/templates", data);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      setShowDialog(false);
      setNewName("");
      setNewHtml("");
      if (result.missingPlaceholders && result.missingPlaceholders.length > 0) {
        toast({ title: "Plantilla guardada", description: `Nota: faltan ${result.missingPlaceholders.length} placeholder(s) para compatibilidad completa.` });
      } else {
        toast({ title: "Plantilla guardada", description: "Su plantilla es totalmente compatible con el editor de campañas." });
      }
    },
  });

  const generateAiMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/templates/generate", { prompt });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      setShowAiDialog(false);
      setAiPrompt("");
      toast({ title: "Plantilla generada", description: "Su plantilla ha sido creada con IA." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const editAiMutation = useMutation({
    mutationFn: async ({ id, instructions }: { id: number; instructions: string }) => {
      const res = await apiRequest("POST", `/api/templates/${id}/edit-ai`, { instructions });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      setShowEditAiDialog(false);
      setEditAiInstructions("");
      setEditingTemplateId(null);
      toast({ title: "Plantilla editada", description: "Los cambios con IA han sido aplicados." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, html }: { id: number; html: string }) => {
      const res = await apiRequest("PATCH", `/api/templates/${id}`, { html });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      setShowManualEditDialog(false);
      setManualHtml("");
      setEditingTemplateId(null);
      toast({ title: "Plantilla actualizada" });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, favorite }: { id: number; favorite: boolean }) => {
      const res = await apiRequest("PATCH", `/api/templates/${id}`, { favorite });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      toast({ title: "Plantilla eliminada" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/templates/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      setRenamingId(null);
      setRenameValue("");
      toast({ title: "Nombre actualizado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo renombrar la plantilla.", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/templates/${id}/confirm`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      setShowVersionsDialog(false);
      setVersionsParentId(null);
      toast({ title: "Plantilla confirmada", description: "Las otras versiones han sido eliminadas." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/templates/${id}/analyze`);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      if (result.missingPlaceholders && result.missingPlaceholders.length > 0) {
        toast({ title: "Análisis parcial", description: `Aún faltan ${result.missingPlaceholders.length} placeholder(s).` });
      } else {
        toast({ title: "Plantilla analizada", description: "Todos los placeholders han sido insertados correctamente." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: versionsList = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates", versionsParentId, "versions"],
    enabled: !!versionsParentId,
  });

  function openVersions(template: Template) {
    const parentId = (template as any).parentTemplateId || template.id;
    setVersionsParentId(parentId);
    setShowVersionsDialog(true);
  }

  function getVersionCount(template: Template): number {
    const parentId = (template as any).parentTemplateId || template.id;
    return templates.filter(t => (t as any).parentTemplateId === parentId).length;
  }

  function startRename(template: Template) {
    setRenamingId(template.id);
    setRenameValue(template.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  function confirmRename() {
    if (renamingId && renameValue.trim()) {
      renameMutation.mutate({ id: renamingId, name: renameValue.trim() });
    }
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  function handleSaveTemplate() {
    if (!newName.trim() || !newHtml.trim()) return;
    createMutation.mutate({ name: newName.trim(), html: newHtml.trim() });
  }

  function toggleFavorite(id: number) {
    const template = templates.find(t => t.id === id);
    if (template) {
      toggleFavoriteMutation.mutate({ id, favorite: !template.favorite });
    }
  }

  function deleteTemplate(id: number) {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta plantilla?")) return;
    deleteMutation.mutate(id);
  }

  function openEditAi(template: Template) {
    setEditingTemplateId(template.id);
    setEditAiInstructions("");
    setShowEditAiDialog(true);
  }

  function openManualEdit(template: Template) {
    setEditingTemplateId(template.id);
    setManualHtml(template.html);
    setShowManualEditDialog(true);
  }

  function extractTextNodes(html: string): { index: number; original: string }[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const nodes: { index: number; original: string }[] = [];
    const placeholderPattern = /\{\{[A-Z_]+\}\}/;
    let idx = 0;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (text.length > 2 && !placeholderPattern.test(text)) {
        const parent = node.parentElement;
        if (parent && !["STYLE", "SCRIPT"].includes(parent.tagName)) {
          nodes.push({ index: idx, original: text });
        }
      }
      idx++;
    }
    return nodes;
  }

  function openTextEdit(template: Template) {
    setEditingTemplateId(template.id);
    const nodes = extractTextNodes(template.html);
    setTextEditNodes(nodes.map(n => ({ ...n, edited: n.original })));
    setShowTextEditDialog(true);
  }

  function applyTextEdits() {
    if (!editingTemplateId) return;
    const template = templates.find(t => t.id === editingTemplateId);
    if (!template) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(template.html, "text/html");
    const placeholderPattern = /\{\{[A-Z_]+\}\}/;
    let idx = 0;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    const editMap = new Map(textEditNodes.filter(n => n.edited !== n.original).map(n => [n.index, n.edited]));
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (text.length > 2 && !placeholderPattern.test(text)) {
        const parent = node.parentElement;
        if (parent && !["STYLE", "SCRIPT"].includes(parent.tagName)) {
          if (editMap.has(idx)) {
            node.textContent = (node.textContent || "").replace(text, editMap.get(idx)!);
          }
        }
      }
      idx++;
    }
    const doctype = "<!DOCTYPE html>";
    const html = doctype + doc.documentElement.outerHTML;
    updateMutation.mutate({ id: editingTemplateId, html });
    setShowTextEditDialog(false);
    setTextEditNodes([]);
  }

  const editingTemplate = templates.find(t => t.id === editingTemplateId);
  const newHtmlValidation = newHtml.trim() ? checkPlaceholders(newHtml) : null;
  const manualHtmlValidation = manualHtml.trim() ? checkPlaceholders(manualHtml) : null;

  const placeholderList = Object.values(TEMPLATE_PLACEHOLDERS);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Plantillas</h1>
            <p className="text-muted-foreground mt-1">Administre sus plantillas HTML de correo electrónico. Genere plantillas con IA o suba las suyas para usarlas en sus campañas.</p>
          </div>
          <div className="flex items-center gap-2">
            <TutorialHighlight fieldId="generate-ai">
              <Button
                data-testid="button-create-ai-template"
                onClick={() => setShowAiDialog(true)}
                className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Sparkles className="w-4 h-4" />
                Crear con IA
              </Button>
            </TutorialHighlight>
            <Button
              data-testid="button-add-template"
              onClick={() => setShowDialog(true)}
              className="rounded-xl gap-2"
              variant="outline"
            >
              <Plus className="w-4 h-4" />
              Cargar Plantilla
            </Button>
          </div>
        </div>

        <TutorialHighlight fieldId="templates-overview">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                <Skeleton className="h-48 w-full" />
                <div className="p-4">
                  <Skeleton className="h-5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground" data-testid="text-no-templates">
            <Code className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No tiene plantillas aún</p>
            <p className="text-sm mt-1">Haga clic en "Crear con IA" para generar su primera plantilla o "Cargar Plantilla" para subir una existente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedTemplates.map((template, i) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm group"
              >
                <div
                  className="h-48 overflow-hidden border-b border-border bg-white cursor-pointer relative"
                  onClick={() => setPreviewId(template.id)}
                >
                  <iframe
                    srcDoc={template.html}
                    sandbox=""
                    className="w-full h-full pointer-events-none"
                    style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
                    title={template.name}
                  />
                  <div className="absolute inset-0 bg-transparent hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium shadow-sm">
                      <Eye className="w-4 h-4" />
                      Vista previa
                    </div>
                  </div>
                  {template.isAiGenerated && (
                    <div data-testid={`badge-postialo-${template.id}`} className="absolute bottom-2 left-2 bg-[#002073] rounded-md px-2 py-0.5 flex items-center gap-0.5 shadow-sm">
                      <span className="text-[10px] font-bold text-white">Post</span>
                      <span className="text-[10px] font-bold text-[#e3001b]">IA</span>
                      <span className="text-[10px] font-bold text-white">lo</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {template.hasAllPlaceholders ? (
                      <span data-testid={`badge-compatible-${template.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                        Compatible
                      </span>
                    ) : (
                      <span data-testid={`badge-incomplete-${template.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 shadow-sm">
                        <AlertTriangle className="w-3 h-3" />
                        Incompleta
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    {renamingId === template.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Input
                          ref={renameInputRef}
                          data-testid={`input-rename-template-${template.id}`}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") confirmRename();
                            if (e.key === "Escape") cancelRename();
                          }}
                          className="h-8 text-sm font-bold flex-1"
                          maxLength={200}
                        />
                        <Button
                          data-testid={`button-confirm-rename-${template.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={confirmRename}
                          disabled={!renameValue.trim() || renameMutation.isPending}
                        >
                          <Check className="w-4 h-4 text-emerald-600" />
                        </Button>
                        <Button
                          data-testid={`button-cancel-rename-${template.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={cancelRename}
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <h3
                        data-testid={`text-template-name-${template.id}`}
                        className="font-bold truncate flex-1 cursor-pointer"
                        onClick={() => startRename(template)}
                        title="Clic para renombrar"
                      >
                        {template.name}
                      </h3>
                    )}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {renamingId !== template.id && (
                        <Button
                          data-testid={`button-rename-template-${template.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => startRename(template)}
                          title="Renombrar plantilla"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                      <Button
                        data-testid={`button-favorite-${template.id}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFavorite(template.id)}
                      >
                        {template.favorite ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> : <StarOff className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                      <Button
                        data-testid={`button-preview-template-${template.id}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewId(template.id)}
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        data-testid={`button-delete-template-${template.id}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  {!(template as any).isConfirmed && (template as any).parentTemplateId && (
                    <div className="flex items-center gap-2">
                      <span data-testid={`badge-unconfirmed-${template.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
                        <GitBranch className="w-3 h-3" />
                        Sin confirmar
                      </span>
                      {getVersionCount(template) > 1 && (
                        <Button
                          data-testid={`button-view-versions-${template.id}`}
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1 text-xs"
                          onClick={() => openVersions(template)}
                        >
                          <GitBranch className="w-3 h-3" />
                          Ver {getVersionCount(template)} versiones
                        </Button>
                      )}
                      <Button
                        data-testid={`button-confirm-template-${template.id}`}
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        onClick={() => confirmMutation.mutate(template.id)}
                        disabled={confirmMutation.isPending}
                      >
                        {confirmMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                        Confirmar
                      </Button>
                    </div>
                  )}
                  {template.isAiGenerated && !(template as any).isConfirmed && (
                    <div className="flex items-center gap-2">
                      {getVersionCount(template) < 3 ? (
                        <Button
                          data-testid={`button-edit-ai-template-${template.id}`}
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1 text-xs flex-1"
                          onClick={() => openEditAi(template)}
                        >
                          <Wand2 className="w-3 h-3" />
                          Nueva versión IA
                        </Button>
                      ) : (
                        <Button
                          data-testid={`button-manual-edit-${template.id}`}
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1 text-xs flex-1"
                          onClick={() => openManualEdit(template)}
                        >
                          <Pencil className="w-3 h-3" />
                          Editar Manual
                        </Button>
                      )}
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {getVersionCount(template)}/3 versiones
                      </span>
                    </div>
                  )}
                  {template.isAiGenerated && (
                    <Button
                      data-testid={`button-text-edit-${template.id}`}
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1 text-xs w-full"
                      onClick={() => openTextEdit(template)}
                    >
                      <Type className="w-3 h-3" />
                      Editar textos
                    </Button>
                  )}
                  {!template.isAiGenerated && !template.hasAllPlaceholders && (
                    <div className="flex items-center gap-2">
                      <Button
                        data-testid={`button-analyze-template-${template.id}`}
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1 text-xs flex-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                        onClick={() => analyzeMutation.mutate(template.id)}
                        disabled={analyzeMutation.isPending}
                      >
                        {analyzeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Analizar con IA
                      </Button>
                      <Button
                        data-testid={`button-manual-edit-uploaded-${template.id}`}
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1 text-xs"
                        onClick={() => openManualEdit(template)}
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </Button>
                    </div>
                  )}
                  {!template.isAiGenerated && template.hasAllPlaceholders && (
                    <div className="flex items-center gap-2">
                      <Button
                        data-testid={`button-manual-edit-uploaded-${template.id}`}
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1 text-xs flex-1"
                        onClick={() => openManualEdit(template)}
                      >
                        <Pencil className="w-3 h-3" />
                        Editar HTML
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </TutorialHighlight>

        {tutorialActive && <TutorialTip />}

        {templates.length > 0 && !onboardingStatus?.hasContactDatabases && (
          <div className="flex justify-end mt-6">
            <Button
              data-testid="button-next-to-contacts"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
                setLocation("/contacts");
              }}
              className="rounded-xl gap-2 bg-[#002073] hover:bg-[#001a5e] text-white px-6"
            >
              Siguiente: Base de Datos
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              Cargar Plantilla HTML
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div data-testid="panel-placeholder-info" className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Para que su plantilla funcione con el editor de campañas, incluya estos marcadores en su HTML:</p>
                  <div className="grid grid-cols-1 gap-1">
                    {placeholderList.map(p => (
                      <div key={p.key} className="flex items-baseline gap-2 text-[11px]">
                        <code className="font-mono text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 rounded px-1 py-0.5 flex-shrink-0">{p.key}</code>
                        <span className="text-blue-600 dark:text-blue-400">— {p.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la Plantilla</Label>
              <Input
                data-testid="input-template-name"
                placeholder="Ej: Mi plantilla promocional"
                maxLength={200}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Código HTML</Label>
              <Textarea
                data-testid="input-template-html"
                placeholder="Pegue su código HTML aquí..."
                value={newHtml}
                onChange={e => setNewHtml(e.target.value)}
                className="rounded-xl min-h-[200px] font-mono text-sm"
              />
            </div>
            {newHtmlValidation && !newHtmlValidation.valid && (
              <div data-testid="warning-missing-placeholders" className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Placeholders faltantes ({newHtmlValidation.missing.length}):</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {newHtmlValidation.missing.map(m => (
                        <code key={m} className="text-[10px] font-mono bg-amber-100 dark:bg-amber-900/50 text-amber-700 rounded px-1 py-0.5">{m}</code>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-600 mt-1">La plantilla se guardará pero no será totalmente compatible con el editor.</p>
                  </div>
                </div>
              </div>
            )}
            {newHtmlValidation && newHtmlValidation.valid && (
              <div data-testid="success-all-placeholders" className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Todos los placeholders presentes. Plantilla totalmente compatible.</p>
              </div>
            )}
            {newHtml && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="text-xs font-semibold text-muted-foreground px-3 py-1.5 bg-muted">Vista Previa</div>
                <iframe srcDoc={newHtml} sandbox="" className="w-full h-48 bg-white" title="preview" />
              </div>
            )}
            <Button
              data-testid="button-save-new-template"
              onClick={handleSaveTemplate}
              className="w-full rounded-xl"
              disabled={!newName.trim() || !newHtml.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                "Guardar Plantilla"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              Crear Plantilla con IA
            </DialogTitle>
            <DialogDescription>
              Describa la plantilla que necesita y la IA la generará automáticamente con los 6 placeholders estándar integrados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Descripción de la plantilla</Label>
              <Textarea
                data-testid="input-ai-template-prompt"
                placeholder="Ej: Necesito una plantilla corporativa minimalista para el sector tecnológico, con colores azul oscuro y blanco, que tenga espacio para un banner principal, un bloque de texto y un botón de llamada a la acción..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="rounded-xl min-h-[120px]"
                maxLength={1000}
              />
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground">{aiPrompt.length}/1000</span>
              </div>
            </div>
            <Button
              data-testid="button-generate-template"
              onClick={() => generateAiMutation.mutate(aiPrompt)}
              className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!aiPrompt.trim() || generateAiMutation.isPending}
            >
              {generateAiMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando plantilla...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generar Plantilla
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditAiDialog} onOpenChange={(open) => { setShowEditAiDialog(open); if (!open) setEditingTemplateId(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-blue-600" />
              Editar Plantilla con IA
            </DialogTitle>
            <DialogDescription>
              Describa los cambios que desea aplicar. La IA mantendrá la estructura base y solo modificará lo solicitado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground">
              Plantilla: <span className="font-semibold text-foreground">{editingTemplate?.name}</span>
              <span className="text-xs ml-2">({editingTemplate?.aiEditCount || 0}/3 ediciones usadas)</span>
            </div>
            <div className="space-y-2">
              <Label>Instrucciones de edición</Label>
              <Textarea
                data-testid="input-edit-ai-instructions"
                placeholder="Ej: Cambia los colores principales a tonos verdes, agrega un segundo bloque de contenido, cambia la fuente a Helvetica..."
                value={editAiInstructions}
                onChange={e => setEditAiInstructions(e.target.value)}
                className="rounded-xl min-h-[120px]"
                maxLength={1000}
              />
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground">{editAiInstructions.length}/1000</span>
              </div>
            </div>
            <Button
              data-testid="button-confirm-edit-ai"
              onClick={() => editingTemplateId && editAiMutation.mutate({ id: editingTemplateId, instructions: editAiInstructions })}
              className="w-full rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!editAiInstructions.trim() || editAiMutation.isPending}
            >
              {editAiMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aplicando cambios...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Aplicar Edición con IA
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showManualEditDialog} onOpenChange={(open) => { setShowManualEditDialog(open); if (!open) setEditingTemplateId(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Edición Manual — {editingTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Edite el código HTML directamente. Las ediciones con IA ya fueron agotadas para esta plantilla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Textarea
              data-testid="input-manual-html"
              value={manualHtml}
              onChange={e => setManualHtml(e.target.value)}
              className="rounded-xl min-h-[300px] font-mono text-sm"
            />
            {manualHtmlValidation && !manualHtmlValidation.valid && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Placeholders faltantes ({manualHtmlValidation.missing.length}):</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {manualHtmlValidation.missing.map(m => (
                        <code key={m} className="text-[10px] font-mono bg-amber-100 dark:bg-amber-900/50 text-amber-700 rounded px-1 py-0.5">{m}</code>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {manualHtmlValidation && manualHtmlValidation.valid && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Todos los placeholders presentes.</p>
              </div>
            )}
            {manualHtml && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="text-xs font-semibold text-muted-foreground px-3 py-1.5 bg-muted">Vista Previa</div>
                <iframe srcDoc={manualHtml} sandbox="" className="w-full h-48 bg-white" title="manual-preview" />
              </div>
            )}
            <Button
              data-testid="button-save-manual-edit"
              onClick={() => editingTemplateId && updateMutation.mutate({ id: editingTemplateId, html: manualHtml })}
              className="w-full rounded-xl"
              disabled={!manualHtml.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewId !== null} onOpenChange={() => setPreviewId(null)}>
        <DialogContent data-testid="dialog-preview-template" className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-4 border-b border-border">
            <DialogTitle>{templates.find(t => t.id === previewId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="bg-white overflow-y-auto max-h-[calc(90vh-80px)]">
            <iframe
              srcDoc={templates.find(t => t.id === previewId)?.html || ""}
              sandbox=""
              className="w-full h-[500px]"
              title="preview-full"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVersionsDialog} onOpenChange={(open) => { setShowVersionsDialog(open); if (!open) setVersionsParentId(null); }}>
        <DialogContent data-testid="dialog-versions" className="sm:max-w-4xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-blue-600" />
              Comparar Versiones
            </DialogTitle>
            <DialogDescription>
              Seleccione la versi&oacute;n que desea conservar. Las dem&aacute;s ser&aacute;n eliminadas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {versionsList.map((v) => (
              <div key={v.id} data-testid={`version-card-${v.id}`} className="border border-border rounded-xl overflow-hidden">
                <div className="h-40 bg-white overflow-hidden">
                  <iframe
                    srcDoc={v.html}
                    sandbox=""
                    className="w-full h-full pointer-events-none"
                    style={{ transform: "scale(0.4)", transformOrigin: "top left", width: "250%", height: "250%" }}
                    title={`version-${(v as any).versionNumber}`}
                  />
                </div>
                <div className="p-3 space-y-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Versi&oacute;n {(v as any).versionNumber || 1}</span>
                    {v.hasAllPlaceholders ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Compatible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        Incompleta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{v.name}</p>
                  <Button
                    data-testid={`button-confirm-version-${v.id}`}
                    onClick={() => confirmMutation.mutate(v.id)}
                    disabled={confirmMutation.isPending}
                    className="w-full rounded-xl gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="sm"
                  >
                    {confirmMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    Confirmar esta versi&oacute;n
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTextEditDialog} onOpenChange={(open) => { setShowTextEditDialog(open); if (!open) { setEditingTemplateId(null); setTextEditNodes([]); } }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Type className="w-5 h-5 text-blue-600" />
              Editar Textos — {editingTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Modifique los textos de la plantilla sin alterar el diseño ni la estructura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {textEditNodes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No se encontraron textos editables en esta plantilla.</p>
            ) : (
              textEditNodes.map((node, i) => (
                <div key={node.index} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Texto {i + 1}</Label>
                  <Textarea
                    data-testid={`input-text-node-${i}`}
                    value={node.edited}
                    onChange={e => {
                      const updated = [...textEditNodes];
                      updated[i] = { ...updated[i], edited: e.target.value };
                      setTextEditNodes(updated);
                    }}
                    className="rounded-xl text-sm min-h-[60px]"
                  />
                </div>
              ))
            )}
            {textEditNodes.length > 0 && (
              <Button
                data-testid="button-save-text-edits"
                onClick={applyTextEdits}
                className="w-full rounded-xl gap-2"
                disabled={updateMutation.isPending || textEditNodes.every(n => n.edited === n.original)}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios de Texto"
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
