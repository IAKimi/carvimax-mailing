import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Shield, Loader2, KeyRound, Eye, EyeOff, Sparkles, Image as ImageIcon
} from "lucide-react";
import { Redirect } from "wouter";

type PlatformAiSettings = {
  openaiConfigured: boolean;
  openaiKeyHint: string | null;
  openaiApiKey: string | null;
  geminiConfigured: boolean;
  geminiKeyHint: string | null;
  geminiApiKey: string | null;
  openaiModel: string;
  geminiImageModel: string;
  geminiFallbackModel: string;
  openaiModelOptions: string[];
  geminiImageModelOptions: string[];
  geminiFallbackModelOptions: string[];
  source: {
    openaiKey: "database" | "env" | "none";
    geminiKey: "database" | "env" | "none";
  };
  updatedAt: string | null;
};

function sourceLabel(source: "database" | "env" | "none"): string {
  if (source === "database") return "base de datos";
  if (source === "env") return "variable de entorno";
  return "sin configurar";
}

export default function SuperAdminConfig() {
  const { toast } = useToast();
  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState("");
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [openaiModelDraft, setOpenaiModelDraft] = useState("");
  const [geminiImageModelDraft, setGeminiImageModelDraft] = useState("");
  const [geminiFallbackModelDraft, setGeminiFallbackModelDraft] = useState("");

  const { data: currentUser, isLoading: authLoading } = useQuery<{ id: number; role: string } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const isSuperAdmin = currentUser?.role === "superadmin";

  const { data: platformAi, isLoading: platformAiLoading } = useQuery<PlatformAiSettings>({
    queryKey: ["/api/admin/platform-ai"],
    enabled: isSuperAdmin === true,
  });

  useEffect(() => {
    if (!platformAi) return;
    setOpenaiModelDraft(platformAi.openaiModel);
    setGeminiImageModelDraft(platformAi.geminiImageModel);
    setGeminiFallbackModelDraft(platformAi.geminiFallbackModel);
    setOpenaiApiKeyInput(platformAi.openaiApiKey || "");
    setGeminiApiKeyInput(platformAi.geminiApiKey || "");
    setShowOpenaiKey(false);
    setShowGeminiKey(false);
  }, [platformAi]);

  const savePlatformAiMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("PUT", "/api/admin/platform-ai", payload);
      return res.json() as Promise<PlatformAiSettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/platform-ai"], data);
      setOpenaiApiKeyInput(data.openaiApiKey || "");
      setGeminiApiKeyInput(data.geminiApiKey || "");
      setShowOpenaiKey(false);
      setShowGeminiKey(false);
      toast({
        title: "Configuración de IA actualizada",
        description: "Los cambios aplican a toda la plataforma de inmediato.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!authLoading && !isSuperAdmin) {
    return <Redirect to="/" />;
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl">
        <div>
          <h1 data-testid="heading-superadmin-config" className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#002073]" />
            Config. Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Ajustes exclusivos del dueño de la plataforma. Afectan a todas las cuentas.
          </p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#002073]" />
                Proveedores de inteligencia artificial
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure las API keys y modelos utilizados por toda la plataforma.
              </p>
            </div>
            {platformAiLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {platformAi && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5 space-y-5 border border-[#002073]/15" data-testid="card-openai-config">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#002073]" />
                    OpenAI
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Texto de campañas, plantillas y asistente.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estado: {platformAi.openaiConfigured ? "activa" : "sin configurar"}
                    {" · "}origen: {sourceLabel(platformAi.source.openaiKey)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openai-api-key">API key</Label>
                  <div className="relative">
                    <Input
                      id="openai-api-key"
                      data-testid="input-openai-api-key"
                      type={showOpenaiKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={openaiApiKeyInput}
                      onChange={(e) => setOpenaiApiKeyInput(e.target.value)}
                      className="pr-10 font-mono text-sm"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowOpenaiKey((v) => !v)}
                      aria-label={showOpenaiKey ? "Ocultar API key" : "Mostrar API key"}
                    >
                      {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La key permanece en el campo (oculta). Use el ícono del ojo para mostrarla.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Select value={openaiModelDraft || platformAi.openaiModel} onValueChange={setOpenaiModelDraft}>
                    <SelectTrigger data-testid="select-openai-model">
                      <SelectValue placeholder="Seleccione un modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {platformAi.openaiModelOptions.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    data-testid="button-save-openai"
                    className="bg-[#002073] hover:bg-[#001a5e] text-white flex-1"
                    disabled={savePlatformAiMutation.isPending}
                    onClick={() => {
                      const payload: Record<string, unknown> = {
                        openaiModel: openaiModelDraft || platformAi.openaiModel,
                      };
                      if (openaiApiKeyInput.trim()) payload.openaiApiKey = openaiApiKeyInput.trim();
                      savePlatformAiMutation.mutate(payload);
                    }}
                  >
                    {savePlatformAiMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4 mr-2" />
                    )}
                    Guardar OpenAI
                  </Button>
                  {platformAi.openaiConfigured && platformAi.source.openaiKey === "database" && (
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-clear-openai-key"
                      disabled={savePlatformAiMutation.isPending}
                      onClick={() => {
                        if (confirm("¿Desea eliminar la API key de OpenAI guardada en la plataforma?")) {
                          savePlatformAiMutation.mutate({ clearOpenaiApiKey: true });
                        }
                      }}
                    >
                      Eliminar key
                    </Button>
                  )}
                </div>
              </Card>

              <Card className="p-5 space-y-5 border border-[#e3001b]/15" data-testid="card-gemini-config">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#e3001b]" />
                    Gemini
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Generación y edición de imágenes de campañas.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estado: {platformAi.geminiConfigured ? "activa" : "sin configurar"}
                    {" · "}origen: {sourceLabel(platformAi.source.geminiKey)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gemini-api-key">API key</Label>
                  <div className="relative">
                    <Input
                      id="gemini-api-key"
                      data-testid="input-gemini-api-key"
                      type={showGeminiKey ? "text" : "password"}
                      placeholder="AIza..."
                      value={geminiApiKeyInput}
                      onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                      className="pr-10 font-mono text-sm"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowGeminiKey((v) => !v)}
                      aria-label={showGeminiKey ? "Ocultar API key" : "Mostrar API key"}
                    >
                      {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La key permanece en el campo (oculta). Use el ícono del ojo para mostrarla.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Modelo de imagen</Label>
                  <Select value={geminiImageModelDraft || platformAi.geminiImageModel} onValueChange={setGeminiImageModelDraft}>
                    <SelectTrigger data-testid="select-gemini-image-model">
                      <SelectValue placeholder="Seleccione un modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {platformAi.geminiImageModelOptions.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Modelo de respaldo</Label>
                  <Select value={geminiFallbackModelDraft || platformAi.geminiFallbackModel} onValueChange={setGeminiFallbackModelDraft}>
                    <SelectTrigger data-testid="select-gemini-fallback-model">
                      <SelectValue placeholder="Seleccione un modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {platformAi.geminiFallbackModelOptions.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    data-testid="button-save-gemini"
                    className="bg-[#002073] hover:bg-[#001a5e] text-white flex-1"
                    disabled={savePlatformAiMutation.isPending}
                    onClick={() => {
                      const payload: Record<string, unknown> = {
                        geminiImageModel: geminiImageModelDraft || platformAi.geminiImageModel,
                        geminiFallbackModel: geminiFallbackModelDraft || platformAi.geminiFallbackModel,
                      };
                      if (geminiApiKeyInput.trim()) payload.geminiApiKey = geminiApiKeyInput.trim();
                      savePlatformAiMutation.mutate(payload);
                    }}
                  >
                    {savePlatformAiMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4 mr-2" />
                    )}
                    Guardar Gemini
                  </Button>
                  {platformAi.geminiConfigured && platformAi.source.geminiKey === "database" && (
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-clear-gemini-key"
                      disabled={savePlatformAiMutation.isPending}
                      onClick={() => {
                        if (confirm("¿Desea eliminar la API key de Gemini guardada en la plataforma?")) {
                          savePlatformAiMutation.mutate({ clearGeminiApiKey: true });
                        }
                      }}
                    >
                      Eliminar key
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
