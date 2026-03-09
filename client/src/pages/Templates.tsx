import { useState } from "react";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Star, StarOff, Trash2, Code, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Template {
  id: number;
  name: string;
  html: string;
  favorite: boolean;
  createdAt: Date;
}

const SAMPLE_TEMPLATES: Template[] = [
  {
    id: 1,
    name: "Promoción Simple",
    html: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb"><div style="background:linear-gradient(135deg,#002073,#003099);padding:40px 30px;text-align:center"><h1 style="color:#ffffff;font-size:28px;margin:0">Oferta Especial</h1><p style="color:#b3c5e6;margin-top:10px;font-size:16px">Solo por tiempo limitado</p></div><div style="padding:30px"><p style="color:#374151;font-size:16px;line-height:1.6">Estimado cliente, le traemos una oferta que no puede dejar pasar. Aproveche nuestros descuentos exclusivos.</p><div style="text-align:center;margin:30px 0"><a href="#" style="background:#e3001b;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">Ver Ofertas</a></div></div><div style="background:#f9fafb;padding:20px 30px;text-align:center;font-size:12px;color:#9ca3af">© 2026 Mi Empresa. Todos los derechos reservados.</div></div>`,
    favorite: true,
    createdAt: new Date(Date.now() - 86400000 * 5)
  },
  {
    id: 2,
    name: "Newsletter Corporativo",
    html: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#ffffff;border:1px solid #e5e7eb"><div style="padding:30px;border-bottom:3px solid #002073"><h1 style="color:#1f2937;font-size:24px;margin:0">Newsletter Semanal</h1><p style="color:#6b7280;margin-top:5px;font-size:14px">Las últimas novedades de su industria</p></div><div style="padding:30px"><h2 style="color:#1f2937;font-size:18px">Artículo Destacado</h2><p style="color:#374151;font-size:15px;line-height:1.6">Descubra las tendencias que están transformando el mercado este 2026. Lea nuestro análisis completo.</p><div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:20px 0"><p style="color:#4b5563;font-size:14px;margin:0;font-style:italic">"La innovación no es solo tecnología, es una forma de pensar."</p></div></div><div style="padding:20px 30px;text-align:center;font-size:12px;color:#9ca3af">Darse de baja | Preferencias</div></div>`,
    favorite: false,
    createdAt: new Date(Date.now() - 86400000 * 3)
  },
  {
    id: 3,
    name: "Bienvenida al Cliente",
    html: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb"><div style="background:#1f2937;padding:40px 30px;text-align:center"><h1 style="color:#ffffff;font-size:32px;margin:0">¡Bienvenido!</h1></div><div style="padding:30px"><p style="color:#374151;font-size:16px;line-height:1.6">Nos alegra mucho que se haya unido a nuestra comunidad. Estamos aquí para ayudarle a crecer.</p><div style="display:flex;gap:15px;margin:25px 0"><div style="flex:1;background:#f0fdf4;border-radius:8px;padding:20px;text-align:center"><p style="color:#16a34a;font-weight:bold;margin:0">Paso 1</p><p style="color:#4b5563;font-size:13px;margin-top:5px">Configure su perfil</p></div><div style="flex:1;background:#eff6ff;border-radius:8px;padding:20px;text-align:center"><p style="color:#2563eb;font-weight:bold;margin:0">Paso 2</p><p style="color:#4b5563;font-size:13px;margin-top:5px">Explore funciones</p></div></div></div></div>`,
    favorite: false,
    createdAt: new Date(Date.now() - 86400000)
  }
];

export default function Templates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>(SAMPLE_TEMPLATES);
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHtml, setNewHtml] = useState("");
  const [previewId, setPreviewId] = useState<number | null>(null);

  function handleSaveTemplate() {
    if (!newName.trim() || !newHtml.trim()) return;
    const template: Template = {
      id: Date.now(),
      name: newName,
      html: newHtml,
      favorite: false,
      createdAt: new Date()
    };
    setTemplates(prev => [template, ...prev]);
    setShowDialog(false);
    setNewName("");
    setNewHtml("");
    toast({ title: "Plantilla guardada", description: "Su plantilla ha sido añadida a la galería." });
  }

  function toggleFavorite(id: number) {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, favorite: !t.favorite } : t));
  }

  function deleteTemplate(id: number) {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast({ title: "Plantilla eliminada" });
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Plantillas</h1>
            <p className="text-muted-foreground mt-1">Administre sus plantillas HTML de correo electrónico.</p>
          </div>
          <Button
            data-testid="button-add-template"
            onClick={() => setShowDialog(true)}
            className="rounded-xl gap-2"
          >
            <Plus className="w-4 h-4" />
            Cargar Plantilla
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((template, i) => (
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
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold truncate">{template.name}</h3>
                  <div className="flex items-center gap-1">
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
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              Cargar Plantilla HTML
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre de la Plantilla</Label>
              <Input
                data-testid="input-template-name"
                placeholder="Ej: Mi plantilla promocional"
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
            {newHtml && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="text-xs font-semibold text-muted-foreground px-3 py-1.5 bg-muted">Vista Previa</div>
                <iframe srcDoc={newHtml} className="w-full h-48 bg-white" title="preview" />
              </div>
            )}
            <Button
              data-testid="button-save-new-template"
              onClick={handleSaveTemplate}
              className="w-full rounded-xl"
              disabled={!newName.trim() || !newHtml.trim()}
            >
              Guardar Plantilla
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewId !== null} onOpenChange={() => setPreviewId(null)}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-border">
            <DialogTitle>{templates.find(t => t.id === previewId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="bg-white">
            <iframe
              srcDoc={templates.find(t => t.id === previewId)?.html || ""}
              className="w-full h-[500px]"
              title="preview-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
