import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

function detectUnsupportedPlaceholders(html: string): string[] {
  const matches = html.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g) || [];
  const unique = [...new Set(matches)];
  return unique.filter(p => !ALL_PLACEHOLDER_KEYS.includes(p));
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
  const [textEditNodes, setTextEditNodes] = useState<{ index: number; original: string; edited: string; label: string }[]>([]);
  const [adaptAiPending, setAdaptAiPending] = useState(false);
  const [uploadLockedFields, setUploadLockedFields] = useState<string[]>([]);
  const [aiAdapted, setAiAdapted] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    setCurrentSection("templates");
  }, [setCurrentSection]);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: onboardingStatus } = useQuery<{ hasBrand: boolean; hasTemplates: boolean; hasContactDatabases: boolean }>({
    queryKey: ["/api/onboarding-status"],
  });

  const { confirmedTemplates, draftTemplates } = useMemo(() => {
    const confirmed: Template[] = [];
    const drafts: Template[] = [];
    const parentGroups = new Map<number, Template[]>();
    for (const t of templates) {
      const parentId = (t as any).parentTemplateId;
      if (parentId && !(t as any).isConfirmed) {
        if (!parentGroups.has(parentId)) parentGroups.set(parentId, []);
        parentGroups.get(parentId)!.push(t);
      }
    }
    const shown = new Set<number>();
    for (const t of templates) {
      const parentId = (t as any).parentTemplateId;
      if (parentId && !(t as any).isConfirmed) {
        if (!shown.has(parentId)) {
          shown.add(parentId);
          const group = parentGroups.get(parentId)!;
          drafts.push(group.sort((a, b) => ((b as any).versionNumber || 1) - ((a as any).versionNumber || 1))[0]);
        }
      } else if (!(t as any).parentTemplateId || (t as any).isConfirmed) {
        confirmed.push(t);
      }
    }
    return { confirmedTemplates: confirmed, draftTemplates: drafts };
  }, [templates]);

  const sortedTemplates = useMemo(() => {
    return [...confirmedTemplates].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      if (a.hasAllPlaceholders && !b.hasAllPlaceholders) return -1;
      if (!a.hasAllPlaceholders && b.hasAllPlaceholders) return 1;
      return 0;
    });
  }, [confirmedTemplates]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; html: string; lockedFields?: string[] }) => {
      const res = await apiRequest("POST", "/api/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      setShowDialog(false);
      setNewName("");
      setNewHtml("");
      setUploadLockedFields([]);
      setAiAdapted(false);
      toast({ title: "Plantilla guardada", description: "Su plantilla ha sido guardada exitosamente." });
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
      const res = await apiRequest("DELETE", `/api/templates/${id}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      toast({ title: "Plantilla eliminada" });
    },
    onError: (err: any) => {
      let msg = "No se pudo eliminar la plantilla.";
      try {
        const raw = err?.message || "";
        const jsonPart = raw.substring(raw.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.message) msg = parsed.message;
      } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
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
    const children = templates.filter(t => (t as any).parentTemplateId === parentId).length;
    return children + 1;
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
    const payload: { name: string; html: string; lockedFields?: string[] } = { name: newName.trim(), html: newHtml.trim() };
    if (uploadLockedFields.length > 0) {
      payload.lockedFields = uploadLockedFields;
    }
    createMutation.mutate(payload);
  }

  function toggleFavorite(id: number) {
    const template = templates.find(t => t.id === id);
    if (template) {
      toggleFavoriteMutation.mutate({ id, favorite: !template.favorite });
    }
  }

  function handleDeleteClick(id: number) {
    setDeleteConfirmId(id);
  }

  function confirmDelete() {
    if (deleteConfirmId !== null) {
      deleteMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
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

  function extractTextNodes(html: string): { index: number; original: string; label: string }[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const placeholderPattern = /\{\{[A-Z_]+\}\}/;
    const blockTags = ["TD", "DIV", "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TH", "BLOCKQUOTE"];

    function findBlockParent(el: Element | null): Element | null {
      while (el) {
        if (blockTags.includes(el.tagName)) return el;
        el = el.parentElement;
      }
      return null;
    }

    const rawNodes: { idx: number; text: string; block: Element | null }[] = [];
    let idx = 0;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (text.length > 2 && !placeholderPattern.test(text)) {
        const parent = node.parentElement;
        if (parent && !["STYLE", "SCRIPT"].includes(parent.tagName)) {
          rawNodes.push({ idx, text, block: findBlockParent(parent) });
        }
      }
      idx++;
    }

    const groups = new Map<Element | null, { indices: number[]; texts: string[] }>();
    for (const n of rawNodes) {
      if (!groups.has(n.block)) groups.set(n.block, { indices: [], texts: [] });
      const g = groups.get(n.block)!;
      g.indices.push(n.idx);
      g.texts.push(n.text);
    }

    const labelMap: Record<string, string> = {
      TD: "Celda", DIV: "Sección", P: "Párrafo", LI: "Elemento de lista",
      H1: "Título", H2: "Subtítulo", H3: "Subtítulo", H4: "Subtítulo",
      TH: "Encabezado", BLOCKQUOTE: "Cita",
    };

    const result: { index: number; original: string; label: string }[] = [];
    let groupIdx = 0;
    for (const [block, g] of groups) {
      const tag = block?.tagName || "DIV";
      const label = labelMap[tag] || "Texto";
      result.push({
        index: g.indices[0],
        original: g.texts.join(" "),
        label: `${label} ${++groupIdx}`,
      });
    }
    return result;
  }

  function openTextEdit(template: Template) {
    setEditingTemplateId(template.id);
    const nodes = extractTextNodes(template.html);
    setTextEditNodes(nodes.map(n => ({ ...n, edited: n.original, label: n.label })));
    setShowTextEditDialog(true);
  }

  function applyTextEdits() {
    if (!editingTemplateId) return;
    const template = templates.find(t => t.id === editingTemplateId);
    if (!template) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(template.html, "text/html");
    const placeholderPattern = /\{\{[A-Z_]+\}\}/;
    const blockTags = ["TD", "DIV", "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TH", "BLOCKQUOTE"];
    function findBlockParent(el: Element | null): Element | null {
      while (el) { if (blockTags.includes(el.tagName)) return el; el = el.parentElement; }
      return null;
    }

    const rawNodes: { idx: number; text: string; block: Element | null; node: Node }[] = [];
    let idx = 0;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const text = (n.textContent || "").trim();
      if (text.length > 2 && !placeholderPattern.test(text)) {
        const parent = n.parentElement;
        if (parent && !["STYLE", "SCRIPT"].includes(parent.tagName)) {
          rawNodes.push({ idx, text, block: findBlockParent(parent), node: n });
        }
      }
      idx++;
    }

    const groups = new Map<Element | null, typeof rawNodes>();
    for (const rn of rawNodes) {
      if (!groups.has(rn.block)) groups.set(rn.block, []);
      groups.get(rn.block)!.push(rn);
    }

    let groupIdx = 0;
    for (const [, groupNodes] of groups) {
      const editNode = textEditNodes[groupIdx];
      groupIdx++;
      if (!editNode || editNode.edited === editNode.original) continue;
      const editedParts = editNode.edited.split(" ");
      let partIdx = 0;
      for (const gn of groupNodes) {
        const wordsInOriginal = gn.text.split(/\s+/).length;
        const replacement = editedParts.slice(partIdx, partIdx + wordsInOriginal).join(" ") || editedParts.slice(partIdx).join(" ");
        if (replacement) {
          gn.node.textContent = (gn.node.textContent || "").replace(gn.text, replacement);
        }
        partIdx += wordsInOriginal;
      }
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
  const newHtmlUnsupported = newHtml.trim() ? detectUnsupportedPlaceholders(newHtml) : [];
  const manualHtmlUnsupported = manualHtml.trim() ? detectUnsupportedPlaceholders(manualHtml) : [];

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
                        data-testid={`button-delete-template-${template.id}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(template.id)}
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

        {draftTemplates.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-muted-foreground">Versiones en proceso</h3>
              <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">{draftTemplates.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {draftTemplates.map((template, i) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="bg-card rounded-2xl border-2 border-orange-200 dark:border-orange-800 overflow-hidden shadow-sm group"
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
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 shadow-sm">
                        <GitBranch className="w-3 h-3" />
                        Borrador
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-semibold truncate">{template.name}</p>
                    <div className="flex items-center gap-2">
                      {getVersionCount(template) > 1 && (
                        <Button
                          data-testid={`button-view-versions-draft-${template.id}`}
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
                        data-testid={`button-confirm-draft-${template.id}`}
                        variant="default"
                        size="sm"
                        className="rounded-xl gap-1 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => confirmMutation.mutate(template.id)}
                        disabled={confirmMutation.isPending}
                      >
                        <Check className="w-3 h-3" />
                        Confirmar
                      </Button>
                      <Button
                        data-testid={`button-delete-draft-${template.id}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(template.id)}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

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

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open && adaptAiPending) return; setShowDialog(open); if (!open) { setUploadLockedFields([]); setAiAdapted(false); } }}>
        <DialogContent className="max-w-[95vw] w-[1200px] rounded-2xl h-[95vh] overflow-hidden p-0" onInteractOutside={(e) => { if (adaptAiPending) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (adaptAiPending) e.preventDefault(); }}>
          <div className="flex flex-col h-full">
            <DialogHeader className="px-6 pt-5 pb-3 border-b border-border flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" />
                Cargar Plantilla HTML
              </DialogTitle>
              <DialogDescription className="sr-only">Cargue su plantilla HTML y adáptela con inteligencia artificial</DialogDescription>
            </DialogHeader>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 border-r border-border overflow-y-auto p-5 space-y-4">
                <div data-testid="panel-upload-warning" className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      Tu plantilla será analizada y adaptada automáticamente para funcionar con nuestra plataforma. Los elementos que ya contenga (imágenes, botones, pie de página) se mantendrán intactos.
                    </p>
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
                    onChange={e => { setNewHtml(e.target.value); setAiAdapted(false); setUploadLockedFields([]); }}
                    className="rounded-xl min-h-[180px] font-mono text-sm"
                  />
                </div>
                {newHtml.trim() && (
                  <Button
                    data-testid="button-adapt-ai-upload"
                    variant="outline"
                    className="rounded-xl gap-2 w-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
                    onClick={async () => {
                      setAdaptAiPending(true);
                      try {
                        const res = await apiRequest("POST", "/api/templates/analyze-html", { html: newHtml });
                        const data = await res.json();
                        if (data.html) {
                          setNewHtml(data.html);
                          setAiAdapted(true);
                          if (data.lockedFields && Array.isArray(data.lockedFields)) {
                            setUploadLockedFields(data.lockedFields);
                          }
                          toast({ title: "Plantilla adaptada", description: "La IA ha analizado y adaptado tu plantilla exitosamente." });
                        }
                      } catch (err: any) {
                        toast({ title: "Error", description: err.message || "No se pudo adaptar la plantilla.", variant: "destructive" });
                      } finally {
                        setAdaptAiPending(false);
                      }
                    }}
                    disabled={adaptAiPending || aiAdapted}
                  >
                    {adaptAiPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analizando plantilla...
                      </>
                    ) : aiAdapted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Plantilla adaptada
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Adaptar con Inteligencia Artificial
                      </>
                    )}
                  </Button>
                )}
                {aiAdapted && uploadLockedFields.length > 0 && (
                  <div data-testid="panel-locked-fields-info" className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Elementos detectados en tu plantilla:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {uploadLockedFields.includes("imagen") && (
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 rounded-full px-2 py-0.5">Imagen</span>
                          )}
                          {(uploadLockedFields.includes("cta") || uploadLockedFields.includes("cta_url")) && (
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 rounded-full px-2 py-0.5">Botón</span>
                          )}
                          {uploadLockedFields.includes("footer") && (
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 rounded-full px-2 py-0.5">Pie de página</span>
                          )}
                        </div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Estos elementos se mantendrán fijos al crear campañas con esta plantilla.</p>
                      </div>
                    </div>
                  </div>
                )}
                {newHtmlUnsupported.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-2">
                      <X className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-red-800 dark:text-red-300">Placeholders no soportados ({newHtmlUnsupported.length}):</p>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">Estos no serán reemplazados al enviar el correo — quedarán visibles como texto sin procesar.</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {newHtmlUnsupported.map(p => (
                            <code key={p} className="text-[10px] font-mono bg-red-100 dark:bg-red-900/50 text-red-700 rounded px-1 py-0.5">{p}</code>
                          ))}
                        </div>
                        <p className="text-[10px] text-red-600 mt-1.5">Solo se admiten: {ALL_PLACEHOLDER_KEYS.join(", ")}</p>
                      </div>
                    </div>
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
              <div className="w-1/2 flex flex-col bg-muted/30">
                <div className="text-xs font-semibold text-muted-foreground px-4 py-2.5 bg-muted border-b border-border flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  Vista Previa
                </div>
                <div className="flex-1 overflow-hidden p-3">
                  {newHtml.trim() ? (
                    <iframe
                      data-testid="iframe-upload-preview"
                      srcDoc={newHtml}
                      sandbox=""
                      className="w-full h-full bg-white rounded-lg border border-border"
                      title="Vista previa de plantilla"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center space-y-2">
                        <Code className="w-10 h-10 mx-auto opacity-30" />
                        <p className="text-sm">Pegue su código HTML para ver la vista previa</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
              Describa la plantilla que necesita y la IA la generará automáticamente con los 7 placeholders estándar integrados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">Estructura estándar del correo</p>
              <p className="text-xs leading-relaxed">Todas las plantillas siguen este orden fijo: <strong>Banner (logo + asunto)</strong> → <strong>Imagen</strong> → <strong>Contenido</strong> → <strong>Botón</strong> → <strong>Footer</strong>. Los colores y el logo se toman de tu Identidad de Marca. Puedes personalizar colores de texto, estilos de fuente, formato del contenido y dimensiones de la imagen a través de tu indicación.</p>
            </div>
            <div className="space-y-2">
              <Label>Descripción de la plantilla</Label>
              <Textarea
                data-testid="input-ai-template-prompt"
                placeholder="Ej: Quiero que el contenido tenga estilo moderno con texto en negrita para los títulos, la imagen centrada con bordes redondeados, y el botón en color rojo..."
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
              Describa los cambios cosméticos que desea aplicar. La estructura de bloques se mantendrá intacta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground">
              Plantilla: <span className="font-semibold text-foreground">{editingTemplate?.name}</span>
              <span className="text-xs ml-2">({editingTemplate?.aiEditCount || 0}/3 ediciones usadas)</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <p className="text-xs leading-relaxed">Puedes modificar: colores, fuentes, estilos de texto, formato del contenido, dimensiones de la imagen. La estructura (Banner → Imagen → Contenido → Botón → Footer) no se puede alterar.</p>
            </div>
            <div className="space-y-2">
              <Label>Instrucciones de edición</Label>
              <Textarea
                data-testid="input-edit-ai-instructions"
                placeholder="Ej: Cambia los colores principales a tonos verdes, pon el texto del contenido en negrita, centra la imagen con bordes redondeados..."
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
            {manualHtmlUnsupported.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <X className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-800 dark:text-red-300">Placeholders no soportados ({manualHtmlUnsupported.length}):</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">Estos no serán reemplazados al enviar el correo — quedarán visibles como texto sin procesar.</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {manualHtmlUnsupported.map(p => (
                        <code key={p} className="text-[10px] font-mono bg-red-100 dark:bg-red-900/50 text-red-700 rounded px-1 py-0.5">{p}</code>
                      ))}
                    </div>
                    <p className="text-[10px] text-red-600 mt-1.5">Solo se admiten: {ALL_PLACEHOLDER_KEYS.join(", ")}</p>
                  </div>
                </div>
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
        <DialogContent data-testid="dialog-preview-template" className="max-w-[95vw] w-[900px] rounded-2xl p-0 overflow-hidden h-[95vh] flex flex-col">
          <DialogHeader className="p-4 border-b border-border flex-shrink-0">
            <DialogTitle>{templates.find(t => t.id === previewId)?.name}</DialogTitle>
            <DialogDescription className="sr-only">Vista previa de la plantilla</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-white">
            <iframe
              srcDoc={templates.find(t => t.id === previewId)?.html || ""}
              sandbox=""
              className="w-full h-full"
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
                  <Label className="text-xs text-muted-foreground">{node.label}</Label>
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

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La plantilla será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              className="rounded-xl bg-red-600 hover:bg-red-700"
              onClick={confirmDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
