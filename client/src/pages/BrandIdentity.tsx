import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Palette,
  Upload,
  Save,
  Check,
  ChevronDown,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BrandIdentity as BrandIdentityType } from "@shared/schema";
import { useTutorial, TUTORIAL_SECTIONS } from "@/contexts/TutorialContext";
import { TutorialHighlight } from "@/components/TutorialHighlight";
import { TutorialTip } from "@/components/TutorialTip";

const FONTS = [
  "Inter", "Roboto", "Open Sans", "Montserrat", "Poppins",
  "Lora", "Playfair Display", "Merriweather", "DM Sans", "Plus Jakarta Sans"
];

const BRAND_FIELDS: { key: string; default: string }[] = [
  { key: "companyName", default: "" },
  { key: "industry", default: "" },
  { key: "website", default: "" },
  { key: "whatsapp", default: "" },
  { key: "mission", default: "" },
  { key: "vision", default: "" },
  { key: "products", default: "" },
  { key: "history", default: "" },
  { key: "styleGuide", default: "" },
  { key: "targetAudience", default: "" },
  { key: "tone", default: "profesional" },
  { key: "primaryColor", default: "#002073" },
  { key: "secondaryColor", default: "#e3001b" },
  { key: "accentColor", default: "#F59E0B" },
  { key: "headingFont", default: "Inter" },
  { key: "bodyFont", default: "Inter" },
  { key: "logoUrl", default: "" },
  { key: "visualStyle", default: "moderno" },
  { key: "senderName", default: "" },
  { key: "senderEmail", default: "" },
];

const DEFAULT_BRAND = {
  companyName: "",
  industry: "",
  website: "",
  whatsapp: "",
  mission: "",
  vision: "",
  products: "",
  history: "",
  styleGuide: "",
  targetAudience: "",
  tone: "profesional",
  primaryColor: "#002073",
  secondaryColor: "#e3001b",
  accentColor: "#F59E0B",
  headingFont: "Inter",
  bodyFont: "Inter",
  logoUrl: "",
  visualStyle: "moderno",
  senderName: "",
  senderEmail: "",
};

function getProgressColor(pct: number): string {
  if (pct <= 25) return "#e3001b";
  if (pct <= 50) return "#f59e0b";
  if (pct <= 75) return "#f97316";
  return "#16a34a";
}

function getProgressLabel(pct: number): string {
  if (pct === 0) return "Sin completar";
  if (pct <= 25) return "Apenas comenzando";
  if (pct <= 50) return "En progreso";
  if (pct <= 75) return "Casi listo";
  if (pct < 100) return "Últimos detalles";
  return "¡Completo!";
}

function getGradientStyle(pct: number): string {
  const clamp = Math.max(0, Math.min(100, pct));
  if (clamp <= 25) {
    return `linear-gradient(90deg, #dc2626, #ef4444)`;
  }
  if (clamp <= 50) {
    return `linear-gradient(90deg, #dc2626, #f59e0b)`;
  }
  if (clamp <= 75) {
    return `linear-gradient(90deg, #dc2626, #f59e0b, #f97316)`;
  }
  return `linear-gradient(90deg, #dc2626, #f59e0b, #22c55e)`;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-2">
      <Separator className="flex-1" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{label}</span>
      <Separator className="flex-1" />
    </div>
  );
}

const LEFT_SECTION_FIELDS = new Set(["companyName", "industry", "website", "whatsapp", "mission", "vision", "products", "history"]);
const RIGHT_SECTION_FIELDS = new Set(["styleGuide", "targetAudience", "tone", "colors", "fonts", "logo", "visualStyle"]);

function getFieldValue(brand: typeof DEFAULT_BRAND, fieldId: string): string {
  const map: Record<string, string> = {
    companyName: brand.companyName,
    industry: brand.industry,
    website: brand.website,
    whatsapp: brand.whatsapp,
    mission: brand.mission,
    vision: brand.vision,
    products: brand.products,
    history: brand.history,
    styleGuide: brand.styleGuide,
    targetAudience: brand.targetAudience,
    tone: brand.tone,
    colors: brand.primaryColor,
    fonts: brand.headingFont,
    logo: brand.logoUrl,
    visualStyle: brand.visualStyle,
  };
  return map[fieldId] || "";
}

function isFieldEmpty(brand: typeof DEFAULT_BRAND, fieldId: string): boolean {
  if (fieldId === "tone" || fieldId === "colors" || fieldId === "fonts" || fieldId === "visualStyle") return false;
  const val = getFieldValue(brand, fieldId);
  return val.trim() === "";
}

export default function BrandIdentity() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [brand, setBrand] = useState({ ...DEFAULT_BRAND });
  const [initialized, setInitialized] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { tutorialActive, setCurrentSection, setCurrentStepIndex, currentSection } = useTutorial();

  useEffect(() => {
    setCurrentSection("brand");
  }, [setCurrentSection]);

  useEffect(() => {
    if (tutorialActive && currentSection === "brand") {
      setLeftOpen(true);
      setRightOpen(true);
    }
  }, [tutorialActive, currentSection]);

  useEffect(() => {
    if (tutorialActive && currentSection === "brand" && initialized) {
      const steps = TUTORIAL_SECTIONS["brand"] || [];
      const firstEmptyIndex = steps.findIndex(s => isFieldEmpty(brand, s.fieldId));
      if (firstEmptyIndex >= 0) {
        setCurrentStepIndex(firstEmptyIndex);
      }
    }
  }, [tutorialActive, currentSection, initialized]);

  const handleTutorialBlur = useCallback((fieldId: string) => {
    if (!tutorialActive || currentSection !== "brand") return;
    const val = getFieldValue(brand, fieldId);
    if (val.trim() === "") return;
    const steps = TUTORIAL_SECTIONS["brand"] || [];
    const currentIdx = steps.findIndex(s => s.fieldId === fieldId);
    if (currentIdx < 0) return;
    for (let i = currentIdx + 1; i < steps.length; i++) {
      if (isFieldEmpty(brand, steps[i].fieldId)) {
        setCurrentStepIndex(i);
        if (LEFT_SECTION_FIELDS.has(steps[i].fieldId)) setLeftOpen(true);
        if (RIGHT_SECTION_FIELDS.has(steps[i].fieldId)) setRightOpen(true);
        return;
      }
    }
    for (let i = 0; i < currentIdx; i++) {
      if (isFieldEmpty(brand, steps[i].fieldId)) {
        setCurrentStepIndex(i);
        if (LEFT_SECTION_FIELDS.has(steps[i].fieldId)) setLeftOpen(true);
        if (RIGHT_SECTION_FIELDS.has(steps[i].fieldId)) setRightOpen(true);
        return;
      }
    }
    if (currentIdx < steps.length - 1) {
      setCurrentStepIndex(currentIdx + 1);
    }
  }, [tutorialActive, currentSection, brand, setCurrentStepIndex]);

  const { data: brandData, isLoading } = useQuery<BrandIdentityType | null>({
    queryKey: ["/api/brand-identity"],
  });

  const { data: onboardingStatus } = useQuery<{ hasBrand: boolean; hasTemplates: boolean; hasContactDatabases: boolean }>({
    queryKey: ["/api/onboarding-status"],
  });

  useEffect(() => {
    if (brandData && !initialized) {
      setBrand({
        companyName: brandData.companyName || "",
        industry: brandData.industry || "",
        website: brandData.website || "",
        whatsapp: brandData.whatsapp || "",
        mission: brandData.mission || "",
        vision: brandData.vision || "",
        products: brandData.products || "",
        history: brandData.history || "",
        styleGuide: brandData.styleGuide || "",
        targetAudience: brandData.targetAudience || "",
        tone: brandData.tone || "profesional",
        primaryColor: brandData.primaryColor || "#002073",
        secondaryColor: brandData.secondaryColor || "#e3001b",
        accentColor: brandData.accentColor || "#F59E0B",
        headingFont: brandData.headingFont || "Inter",
        bodyFont: brandData.bodyFont || "Inter",
        logoUrl: brandData.logoUrl || "",
        visualStyle: brandData.visualStyle || "moderno",
        senderName: (brandData as any).senderName || "",
        senderEmail: (brandData as any).senderEmail || "",
      });
      setInitialized(true);
    } else if (brandData === null && !initialized) {
      setInitialized(true);
    }
  }, [brandData, initialized]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof brand) => {
      const res = await apiRequest("PUT", "/api/brand-identity", data);
      return res.json();
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/brand-identity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      toast({
        title: "Identidad guardada",
        description: "Los datos de su marca han sido guardados correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron guardar los datos. Intente de nuevo.",
        variant: "destructive",
      });
    },
  });

  function updateField(field: string, value: string) {
    setBrand(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveMutation.mutate(brand);
  }

  const completionPct = useMemo(() => {
    const colorKeys = new Set(["primaryColor", "secondaryColor", "accentColor"]);
    const alwaysFilledKeys = new Set(["tone", "headingFont", "bodyFont"]);
    const fieldsToCheck = BRAND_FIELDS.filter(f => !alwaysFilledKeys.has(f.key));
    let filled = 0;
    for (const f of fieldsToCheck) {
      const val = (brand as any)[f.key] || "";
      if (colorKeys.has(f.key)) {
        if (val.trim() !== "") filled++;
      } else {
        if (val.trim() !== "") filled++;
      }
    }
    const total = fieldsToCheck.length + 3;
    const totalFilled = filled + 3;
    return Math.round((totalFilled / total) * 100);
  }, [brand]);

  const progressColor = getProgressColor(completionPct);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <Skeleton className="h-10 w-64 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Identidad de Marca</h1>
            <p className="text-muted-foreground mt-1">Define los parámetros que la IA usará como base para generar contenido.</p>
          </div>
          <Button
            data-testid="button-save-brand"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="rounded-xl gap-2"
            size="lg"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveMutation.isPending ? "Guardando..." : saved ? "Guardado" : "Guardar"}
          </Button>
        </div>

        <div data-testid="brand-progress-bar" className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: progressColor }} />
              <span className="text-sm font-semibold">{getProgressLabel(completionPct)}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: progressColor }}>{completionPct}%</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${completionPct}%`,
                background: getGradientStyle(completionPct),
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Complete todos los campos para que la IA genere contenido más preciso y personalizado.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Collapsible open={leftOpen} onOpenChange={setLeftOpen}>
            <div className="bg-card rounded-2xl border border-border shadow-sm" data-testid="collapsible-mi-empresa">
              <CollapsibleTrigger data-testid="dropdown-mi-empresa" className="w-full flex items-center justify-between p-5 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-bold text-base">Mi Empresa</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${leftOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-6 space-y-2">
                  <SectionDivider label="Información General" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TutorialHighlight fieldId="companyName">
                      <div className="space-y-2">
                        <Label>Nombre de la Empresa</Label>
                        <Input data-testid="input-company-name" placeholder="Ej: Mi Empresa S.A." value={brand.companyName} onChange={e => updateField("companyName", e.target.value)} onBlur={() => handleTutorialBlur("companyName")} maxLength={200} className="rounded-xl" />
                      </div>
                    </TutorialHighlight>
                    <TutorialHighlight fieldId="industry">
                      <div className="space-y-2">
                        <Label>Industria / Rubro</Label>
                        <Input data-testid="input-industry" placeholder="Ej: Tecnología, Salud, Retail" value={brand.industry} onChange={e => updateField("industry", e.target.value)} onBlur={() => handleTutorialBlur("industry")} maxLength={200} className="rounded-xl" />
                      </div>
                    </TutorialHighlight>
                    <TutorialHighlight fieldId="website">
                      <div className="space-y-2">
                        <Label>Sitio Web</Label>
                        <Input data-testid="input-website" placeholder="https://www.ejemplo.com" value={brand.website} onChange={e => updateField("website", e.target.value)} onBlur={e => { const v = e.target.value.trim(); if (v && !v.startsWith("http://") && !v.startsWith("https://")) updateField("website", "https://" + v); handleTutorialBlur("website"); }} maxLength={500} className="rounded-xl" />
                      </div>
                    </TutorialHighlight>
                    <TutorialHighlight fieldId="whatsapp">
                      <div className="space-y-2">
                        <Label>WhatsApp</Label>
                        <Input data-testid="input-whatsapp" placeholder="+52 55 1234 5678" value={brand.whatsapp} onChange={e => updateField("whatsapp", e.target.value)} onBlur={() => handleTutorialBlur("whatsapp")} maxLength={30} className="rounded-xl" />
                      </div>
                    </TutorialHighlight>
                  </div>

                  <SectionDivider label="Configuración de Envío" />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nombre del Remitente</Label>
                      <Input data-testid="input-sender-name" placeholder="Ej: Mi Empresa Marketing" value={brand.senderName} onChange={e => updateField("senderName", e.target.value)} maxLength={200} className="rounded-xl" />
                      <p className="text-xs text-muted-foreground">Este nombre aparecerá como remitente en los correos enviados.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Correo del Remitente</Label>
                      <Input data-testid="input-sender-email" type="email" placeholder="Ej: marketing@miempresa.com" value={brand.senderEmail} onChange={e => updateField("senderEmail", e.target.value)} maxLength={200} className="rounded-xl" />
                      <p className="text-xs text-muted-foreground">El correo desde el cual se enviarán las campañas (debe estar verificado en Brevo).</p>
                    </div>
                  </div>

                  <SectionDivider label="Misión y Visión" />
                  <div className="space-y-4">
                    <TutorialHighlight fieldId="mission">
                      <div className="space-y-2">
                        <Label>Misión</Label>
                        <Textarea data-testid="input-mission" placeholder="¿Cuál es la misión de su empresa?" value={brand.mission} onChange={e => updateField("mission", e.target.value)} onBlur={() => handleTutorialBlur("mission")} maxLength={2000} className="rounded-xl min-h-[100px]" />
                      </div>
                    </TutorialHighlight>
                    <TutorialHighlight fieldId="vision">
                      <div className="space-y-2">
                        <Label>Visión</Label>
                        <Textarea data-testid="input-vision" placeholder="¿Cuál es la visión de su empresa?" value={brand.vision} onChange={e => updateField("vision", e.target.value)} onBlur={() => handleTutorialBlur("vision")} maxLength={2000} className="rounded-xl min-h-[100px]" />
                      </div>
                    </TutorialHighlight>
                  </div>

                  <SectionDivider label="Productos y Servicios" />
                  <TutorialHighlight fieldId="products">
                    <div className="space-y-2">
                      <Label>Describa sus productos y servicios principales</Label>
                      <Textarea data-testid="input-products" placeholder="Liste y describa los productos o servicios que ofrece..." value={brand.products} onChange={e => updateField("products", e.target.value)} onBlur={() => handleTutorialBlur("products")} maxLength={2000} className="rounded-xl min-h-[120px]" />
                    </div>
                  </TutorialHighlight>

                  <SectionDivider label="Historia de la Compañía" />
                  <TutorialHighlight fieldId="history">
                    <div className="space-y-2">
                      <Label>Cuéntenos sobre la historia y trayectoria</Label>
                      <Textarea data-testid="input-history" placeholder="¿Cómo surgió la empresa? ¿Cuáles son sus logros más importantes?" value={brand.history} onChange={e => updateField("history", e.target.value)} onBlur={() => handleTutorialBlur("history")} maxLength={2000} className="rounded-xl min-h-[120px]" />
                    </div>
                  </TutorialHighlight>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <Collapsible open={rightOpen} onOpenChange={setRightOpen}>
            <div className="bg-card rounded-2xl border border-border shadow-sm" data-testid="collapsible-lineamientos-branding">
              <CollapsibleTrigger data-testid="dropdown-lineamientos-branding" className="w-full flex items-center justify-between p-5 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Palette className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-bold text-base">Lineamientos y Branding</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${rightOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-6 space-y-2">
                  <SectionDivider label="Lineamientos de Redacción" />
                  <div className="space-y-4">
                    <TutorialHighlight fieldId="styleGuide">
                      <div className="space-y-2">
                        <Label>Guías y Estilos de Contenido</Label>
                        <Textarea data-testid="input-style-guide" placeholder="¿Qué tipo de lenguaje prefiere? ¿Formal o informal? ¿Frases cortas o largas?" value={brand.styleGuide} onChange={e => updateField("styleGuide", e.target.value)} onBlur={() => handleTutorialBlur("styleGuide")} maxLength={2000} className="rounded-xl min-h-[100px]" />
                      </div>
                    </TutorialHighlight>
                    <TutorialHighlight fieldId="targetAudience">
                      <div className="space-y-2">
                        <Label>Público Objetivo</Label>
                        <Textarea data-testid="input-target-audience" placeholder="Describa a su público: rango de edad, intereses, necesidades..." value={brand.targetAudience} onChange={e => updateField("targetAudience", e.target.value)} onBlur={() => handleTutorialBlur("targetAudience")} maxLength={2000} className="rounded-xl min-h-[80px]" />
                      </div>
                    </TutorialHighlight>
                    <TutorialHighlight fieldId="tone">
                      <div className="space-y-2">
                        <Label>Tono de Comunicación</Label>
                        <Select value={brand.tone} onValueChange={(v) => { updateField("tone", v); handleTutorialBlur("tone"); }}>
                          <SelectTrigger data-testid="select-tone" className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="profesional">Profesional</SelectItem>
                            <SelectItem value="amigable">Amigable</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="emocional">Emocional</SelectItem>
                            <SelectItem value="inspirador">Inspirador</SelectItem>
                            <SelectItem value="corporativo">Corporativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TutorialHighlight>
                  </div>

                  <SectionDivider label="Identidad Visual" />
                  <div className="space-y-6">
                    <TutorialHighlight fieldId="colors">
                      <div>
                        <Label className="mb-3 block">Colores de Marca</Label>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Color Primario</Label>
                            <div className="flex items-center gap-3">
                              <input
                                data-testid="input-primary-color"
                                type="color"
                                value={brand.primaryColor}
                                onChange={e => updateField("primaryColor", e.target.value)}
                                className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                              />
                              <Input value={brand.primaryColor} onChange={e => updateField("primaryColor", e.target.value)} className="rounded-xl flex-1 font-mono text-sm" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Color Secundario</Label>
                            <div className="flex items-center gap-3">
                              <input
                                data-testid="input-secondary-color"
                                type="color"
                                value={brand.secondaryColor}
                                onChange={e => updateField("secondaryColor", e.target.value)}
                                className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                              />
                              <Input value={brand.secondaryColor} onChange={e => updateField("secondaryColor", e.target.value)} className="rounded-xl flex-1 font-mono text-sm" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Color de Acento</Label>
                            <div className="flex items-center gap-3">
                              <input
                                data-testid="input-accent-color"
                                type="color"
                                value={brand.accentColor}
                                onChange={e => updateField("accentColor", e.target.value)}
                                className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                              />
                              <Input value={brand.accentColor} onChange={e => updateField("accentColor", e.target.value)} className="rounded-xl flex-1 font-mono text-sm" />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: brand.primaryColor }} />
                          <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: brand.secondaryColor }} />
                          <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: brand.accentColor }} />
                        </div>
                      </div>
                    </TutorialHighlight>

                    <TutorialHighlight fieldId="fonts">
                      <div>
                        <Label className="mb-3 block">Tipografías</Label>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Fuente para Títulos</Label>
                            <Select value={brand.headingFont} onValueChange={(v) => updateField("headingFont", v)}>
                              <SelectTrigger data-testid="select-heading-font" className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FONTS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <p className="text-lg font-bold" style={{ fontFamily: brand.headingFont }}>Vista previa del título</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Fuente para Cuerpo</Label>
                            <Select value={brand.bodyFont} onValueChange={(v) => updateField("bodyFont", v)}>
                              <SelectTrigger data-testid="select-body-font" className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FONTS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <p className="text-sm" style={{ fontFamily: brand.bodyFont }}>Vista previa del cuerpo de texto regular</p>
                          </div>
                        </div>
                      </div>
                    </TutorialHighlight>

                    <TutorialHighlight fieldId="logo">
                      <div>
                        <Label className="mb-3 block">Logo de la Empresa</Label>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        data-testid="input-logo-file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            toast({ title: "El archivo excede 2MB", variant: "destructive" });
                            return;
                          }
                          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                            toast({ title: "Formato no soportado. Use PNG, JPG o WebP", variant: "destructive" });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const base64 = reader.result as string;
                            try {
                              const res = await apiRequest("POST", "/api/brand/logo-upload", { base64 });
                              const data = await res.json();
                              setBrand(b => ({ ...b, logoUrl: data.logoUrl }));
                              if (data.converted) {
                                toast({ title: "Logo convertido a PNG", description: "Se convirtió automáticamente para mejor compatibilidad con plantillas de email." });
                              } else {
                                toast({ title: "Logo subido correctamente" });
                              }
                            } catch (err: any) {
                              setBrand(b => ({ ...b, logoUrl: base64 }));
                              toast({ title: "Logo guardado localmente", description: "Se usará al guardar.", variant: "default" });
                            }
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                      />
                      {brand.logoUrl ? (
                        <div className="relative border-2 border-border rounded-2xl p-4 text-center">
                          <img
                            data-testid="img-brand-logo"
                            src={brand.logoUrl}
                            alt="Logo de la empresa"
                            className="max-h-32 mx-auto object-contain"
                          />
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <Button
                              data-testid="button-change-logo"
                              variant="outline"
                              size="sm"
                              className="rounded-xl gap-1.5 text-xs"
                              onClick={() => logoInputRef.current?.click()}
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Cambiar
                            </Button>
                            <Button
                              data-testid="button-remove-logo"
                              variant="outline"
                              size="sm"
                              className="rounded-xl gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => setBrand(b => ({ ...b, logoUrl: "" }))}
                            >
                              <X className="w-3.5 h-3.5" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          data-testid="dropzone-logo"
                          onClick={() => logoInputRef.current?.click()}
                          className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer"
                        >
                          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">Arrastre su logo aquí o haga clic para seleccionar</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG o SVG (máx. 2MB)</p>
                        </div>
                      )}
                      </div>
                    </TutorialHighlight>

                    <TutorialHighlight fieldId="visualStyle">
                      <div>
                        <Label className="mb-3 block">Estilo Visual de Plantillas</Label>
                        <p className="text-xs text-muted-foreground mb-3">Define el estilo de diseño que la IA aplicará al generar plantillas de email.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { value: "minimalista", label: "Minimalista", desc: "Limpio, espacioso, pocos colores" },
                            { value: "corporativo", label: "Corporativo", desc: "Formal, estructurado, profesional" },
                            { value: "moderno", label: "Moderno", desc: "Bordes redondeados, sombras, gradientes" },
                            { value: "creativo", label: "Creativo", desc: "Audaz, colorido, expresivo" },
                            { value: "elegante", label: "Elegante", desc: "Sofisticado, refinado, oscuro" },
                          ].map(style => (
                            <button
                              key={style.value}
                              data-testid={`button-style-${style.value}`}
                              type="button"
                              onClick={() => setBrand(b => ({ ...b, visualStyle: style.value }))}
                              className={`p-3 rounded-xl border-2 text-left transition-all ${
                                brand.visualStyle === style.value
                                  ? "border-[#002073] bg-[#002073]/5 ring-1 ring-[#002073]/20"
                                  : "border-border hover:border-[#002073]/30"
                              }`}
                            >
                              <span className="text-sm font-medium block">{style.label}</span>
                              <span className="text-xs text-muted-foreground">{style.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </TutorialHighlight>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      </div>
      {saved && brand.companyName?.trim() && brand.industry?.trim() && !onboardingStatus?.hasTemplates && (
        <div className="flex justify-end mt-6">
          <Button
            data-testid="button-next-to-templates"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
              setLocation("/templates");
            }}
            className="rounded-xl gap-2 bg-[#002073] hover:bg-[#001a5e] text-white px-6"
          >
            Siguiente: Plantillas
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
      <TutorialTip />
    </Layout>
  );
}
