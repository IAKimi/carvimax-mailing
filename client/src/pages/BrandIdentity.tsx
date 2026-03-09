import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  Target,
  ShoppingBag,
  BookOpen,
  PenTool,
  Palette,
  Upload,
  Save,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
];

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

export default function BrandIdentity() {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [brand, setBrand] = useState({
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
  });

  function updateField(field: string, value: string) {
    setBrand(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem("postIAlo_brand", JSON.stringify(brand));
    setSaved(true);
    toast({
      title: "Identidad guardada",
      description: "Los datos de su marca han sido guardados correctamente.",
    });
  }

  const completionPct = useMemo(() => {
    const fieldsToCheck = BRAND_FIELDS.filter(f => f.key !== "tone" && f.key !== "headingFont" && f.key !== "bodyFont");
    const defaults = Object.fromEntries(BRAND_FIELDS.map(f => [f.key, f.default]));
    let filled = 0;
    for (const f of fieldsToCheck) {
      const val = (brand as any)[f.key] || "";
      if (val.trim() !== "" && val !== defaults[f.key]) {
        filled++;
      }
    }
    const toneChanged = brand.tone !== "profesional" ? 1 : 0;
    const headingChanged = brand.headingFont !== "Inter" ? 1 : 0;
    const bodyChanged = brand.bodyFont !== "Inter" ? 1 : 0;
    const total = fieldsToCheck.length + 3;
    const totalFilled = filled + toneChanged + headingChanged + bodyChanged;
    return Math.round((totalFilled / total) * 100);
  }, [brand]);

  const progressColor = getProgressColor(completionPct);

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
            className="rounded-xl gap-2"
            size="lg"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Guardado" : "Guardar"}
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

        <Accordion type="multiple" defaultValue={["general", "identity"]} className="space-y-3">
          <AccordionItem value="general" className="bg-card rounded-2xl border border-border px-6 shadow-sm">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold text-base">Información General</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre de la Empresa</Label>
                  <Input data-testid="input-company-name" placeholder="Ej: Mi Empresa S.A." value={brand.companyName} onChange={e => updateField("companyName", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Industria / Rubro</Label>
                  <Input data-testid="input-industry" placeholder="Ej: Tecnología, Salud, Retail" value={brand.industry} onChange={e => updateField("industry", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Sitio Web</Label>
                  <Input data-testid="input-website" placeholder="https://www.miempresa.com" value={brand.website} onChange={e => updateField("website", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input data-testid="input-whatsapp" placeholder="+506 8888-8888" value={brand.whatsapp} onChange={e => updateField("whatsapp", e.target.value)} className="rounded-xl" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="identity" className="bg-card rounded-2xl border border-border px-6 shadow-sm">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold text-base">Misión y Visión</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Misión</Label>
                  <Textarea data-testid="input-mission" placeholder="¿Cuál es la misión de su empresa?" value={brand.mission} onChange={e => updateField("mission", e.target.value)} className="rounded-xl min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label>Visión</Label>
                  <Textarea data-testid="input-vision" placeholder="¿Cuál es la visión de su empresa?" value={brand.vision} onChange={e => updateField("vision", e.target.value)} className="rounded-xl min-h-[100px]" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="products" className="bg-card rounded-2xl border border-border px-6 shadow-sm">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold text-base">Productos y Servicios</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-2">
                <Label>Describa sus productos y servicios principales</Label>
                <Textarea data-testid="input-products" placeholder="Liste y describa los productos o servicios que ofrece..." value={brand.products} onChange={e => updateField("products", e.target.value)} className="rounded-xl min-h-[120px]" />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="history" className="bg-card rounded-2xl border border-border px-6 shadow-sm">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold text-base">Historia de la Compañía</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-2">
                <Label>Cuéntenos sobre la historia y trayectoria</Label>
                <Textarea data-testid="input-history" placeholder="¿Cómo surgió la empresa? ¿Cuáles son sus logros más importantes?" value={brand.history} onChange={e => updateField("history", e.target.value)} className="rounded-xl min-h-[120px]" />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="writing" className="bg-card rounded-2xl border border-border px-6 shadow-sm">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PenTool className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold text-base">Lineamientos de Redacción</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Guías y Estilos de Contenido</Label>
                  <Textarea data-testid="input-style-guide" placeholder="¿Qué tipo de lenguaje prefiere? ¿Formal o informal? ¿Frases cortas o largas?" value={brand.styleGuide} onChange={e => updateField("styleGuide", e.target.value)} className="rounded-xl min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label>Público Objetivo</Label>
                  <Textarea data-testid="input-target-audience" placeholder="Describa a su público: rango de edad, intereses, necesidades..." value={brand.targetAudience} onChange={e => updateField("targetAudience", e.target.value)} className="rounded-xl min-h-[80px]" />
                </div>
                <div className="space-y-2">
                  <Label>Tono de Comunicación</Label>
                  <Select value={brand.tone} onValueChange={(v) => updateField("tone", v)}>
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
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="visual" className="bg-card rounded-2xl border border-border px-6 shadow-sm">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold text-base">Identidad Visual</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-6">
                <div>
                  <Label className="mb-3 block">Colores de Marca</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                <div>
                  <Label className="mb-3 block">Tipografías</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div>
                  <Label className="mb-3 block">Logo de la Empresa</Label>
                  <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer">
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Arrastre su logo aquí o haga clic para seleccionar</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG o SVG (máx. 2MB)</p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Layout>
  );
}
