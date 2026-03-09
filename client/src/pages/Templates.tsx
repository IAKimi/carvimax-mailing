import { useState } from "react";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Star, StarOff, Trash2, Code, Eye, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import type { Template } from "@shared/schema";

export default function Templates() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHtml, setNewHtml] = useState("");
  const [previewId, setPreviewId] = useState<number | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; html: string }) => {
      const res = await apiRequest("POST", "/api/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setShowDialog(false);
      setNewName("");
      setNewHtml("");
      toast({ title: "Plantilla guardada", description: "Su plantilla ha sido añadida a la galería." });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, favorite }: { id: number; favorite: boolean }) => {
      const res = await apiRequest("PATCH", `/api/templates/${id}`, { favorite });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Plantilla eliminada" });
    },
  });

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
    deleteMutation.mutate(id);
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
            <p className="text-sm mt-1">Haga clic en "Cargar Plantilla" para añadir su primera plantilla HTML.</p>
          </div>
        ) : (
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
                  <div className="flex items-center justify-between gap-1">
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
        )}
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
