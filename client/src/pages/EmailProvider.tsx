import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Link2,
  Check,
  Loader2,
  Plug,
  ExternalLink,
  Eye,
  EyeOff,
  Unplug,
  Mail,
  Crown,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProviderStatus {
  provider: string;
  isActive: boolean;
  senderEmail: string | null;
  senderName: string | null;
  accountEmail: string | null;
  accountPlan: string | null;
  maskedKey: string;
}

interface BrevoSender {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

export default function EmailProvider() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const { data: providerStatus, isLoading } = useQuery<ProviderStatus | null>({
    queryKey: ["/api/email-provider/status"],
    queryFn: async () => {
      const res = await fetch("/api/email-provider/status", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Error cargando estado del proveedor");
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        const active = data.find((p: any) => p.provider === "brevo" && p.isActive);
        return active || null;
      }
      if (!data || !data.provider) return null;
      return data;
    },
  });

  const isConnected = !!providerStatus?.isActive;

  const { data: sendersData, isLoading: sendersLoading } = useQuery<{ senders: BrevoSender[] }>({
    queryKey: ["/api/email-provider/brevo/senders"],
    enabled: isConnected,
  });

  const senders = sendersData?.senders || [];

  const connectMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", "/api/email-provider/connect", {
        provider: "brevo",
        apiKey: key,
      });
      return res.json();
    },
    onSuccess: () => {
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/brevo/senders"] });
      toast({ title: "Proveedor conectado", description: "Su cuenta de Brevo ha sido vinculada exitosamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error de conexión", description: err.message || "No se pudo conectar. Verifique su API key.", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/email-provider/brevo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/brevo/senders"] });
      toast({ title: "Proveedor desconectado", description: "Su cuenta de Brevo ha sido desvinculada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "No se pudo desconectar.", variant: "destructive" });
    },
  });

  const updateSenderMutation = useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      const res = await apiRequest("PATCH", "/api/email-provider/brevo/sender", {
        senderEmail: email,
        senderName: name,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/status"] });
      toast({ title: "Remitente actualizado", description: "El remitente por defecto ha sido actualizado." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleConnect() {
    if (!apiKey.trim()) {
      toast({ title: "API Key requerida", description: "Ingrese su API key de Brevo.", variant: "destructive" });
      return;
    }
    connectMutation.mutate(apiKey.trim());
  }

  function handleSelectSender(sender: BrevoSender) {
    updateSenderMutation.mutate({ email: sender.email, name: sender.name });
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-10 w-72 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl md:text-4xl font-extrabold">Proveedor de Email</h1>
          <p className="text-muted-foreground mt-1">Conecte su servicio de envío de correos para enviar campañas directamente.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div data-testid="card-brevo" className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0B996E]/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#0B996E]" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Brevo</h3>
                  <p className="text-xs text-muted-foreground">Servicio de email transaccional</p>
                </div>
              </div>
              {isConnected && (
                <span data-testid="badge-brevo-connected" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  <Check className="w-3 h-3" />
                  Conectado
                </span>
              )}
            </div>

            <div className="p-5 space-y-4">
              {!isConnected ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="brevo-api-key">API Key de Brevo</Label>
                    <div className="relative">
                      <Input
                        data-testid="input-brevo-api-key"
                        id="brevo-api-key"
                        type={showKey ? "text" : "password"}
                        placeholder="xkeysib-..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="rounded-xl pr-10"
                      />
                      <button
                        data-testid="button-toggle-key-visibility"
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    data-testid="button-connect-brevo"
                    onClick={handleConnect}
                    disabled={connectMutation.isPending || !apiKey.trim()}
                    className="w-full rounded-xl gap-2"
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plug className="w-4 h-4" />
                    )}
                    {connectMutation.isPending ? "Conectando..." : "Conectar"}
                  </Button>

                  <div className="pt-2">
                    <button
                      data-testid="button-toggle-instructions"
                      onClick={() => setShowInstructions(!showInstructions)}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      ¿Cómo obtener mi API key?
                    </button>
                    {showInstructions && (
                      <div data-testid="instructions-panel" className="mt-3 p-4 bg-muted/50 rounded-xl text-sm space-y-2">
                        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                          <li>Ingrese a su cuenta de <strong>Brevo</strong></li>
                          <li>Vaya a <strong>SMTP & API</strong> en el menú de configuración</li>
                          <li>Haga clic en <strong>"Generate a new API key"</strong></li>
                          <li>Copie la key y péguela aquí</li>
                        </ol>
                        <a
                          data-testid="link-brevo-api-keys"
                          href="https://app.brevo.com/settings/keys/api"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium mt-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ir a Brevo API Keys
                        </a>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    {providerStatus?.accountEmail && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cuenta:</span>
                        <span data-testid="text-account-email" className="font-medium">{providerStatus.accountEmail}</span>
                      </div>
                    )}
                    {providerStatus?.accountPlan && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Plan:</span>
                        <span data-testid="text-account-plan" className="font-medium flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          {providerStatus.accountPlan}
                        </span>
                      </div>
                    )}
                    {providerStatus?.maskedKey && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">API Key:</span>
                        <span data-testid="text-masked-key" className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          ••••••••{providerStatus.maskedKey}
                        </span>
                      </div>
                    )}
                    {providerStatus?.senderEmail && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Remitente:</span>
                        <span data-testid="text-current-sender" className="font-medium">
                          {providerStatus.senderName ? `${providerStatus.senderName} <${providerStatus.senderEmail}>` : providerStatus.senderEmail}
                        </span>
                      </div>
                    )}
                  </div>

                  {sendersLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : senders.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Remitentes verificados
                      </Label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {senders.filter(s => s.active).map((sender) => {
                          const isSelected = providerStatus?.senderEmail === sender.email;
                          return (
                            <button
                              key={sender.id}
                              data-testid={`button-sender-${sender.id}`}
                              onClick={() => handleSelectSender(sender)}
                              disabled={updateSenderMutation.isPending}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-all ${
                                isSelected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                  : "border-border hover:border-primary/30 hover:bg-muted/50"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate">{sender.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{sender.email}</div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      No se encontraron remitentes verificados en su cuenta de Brevo.
                    </div>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        data-testid="button-disconnect-brevo"
                        variant="outline"
                        className="w-full rounded-xl gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <Unplug className="w-4 h-4" />
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Desconectar Brevo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará la configuración de Brevo. No podrá enviar campañas hasta volver a conectar un proveedor.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-disconnect">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          data-testid="button-confirm-disconnect"
                          onClick={() => disconnectMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {disconnectMutation.isPending ? "Desconectando..." : "Desconectar"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>

          <div data-testid="card-mailchimp" className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden opacity-60">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFE01B]/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#FFE01B]" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Mailchimp</h3>
                  <p className="text-xs text-muted-foreground">Plataforma de email marketing</p>
                </div>
              </div>
              <span data-testid="badge-mailchimp-coming-soon" className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                Próximamente
              </span>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">
                La integración con Mailchimp estará disponible pronto. Por ahora, puede usar Brevo como su proveedor de envío.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
