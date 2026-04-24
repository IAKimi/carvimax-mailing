import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialHighlight } from "@/components/TutorialHighlight";
import { TutorialTip } from "@/components/TutorialTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  Loader2,
  Plug,
  ExternalLink,
  Eye,
  EyeOff,
  Unplug,
  Crown,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Star,
  Shield,
  MapPin,
  Users,
  Zap,
  Copy,
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
import brevoLogo from "@assets/brevo_icon_1775749753762.webp";
import mailchimpLogo from "@assets/mailchimp-la-gi_1775749753761.webp";

interface ProviderStatus {
  id: number;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
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

interface MailchimpDomain {
  domain: string;
  verified: boolean;
  authenticationType: string;
}

interface MailchimpAudience {
  id: string;
  name: string;
  memberCount: number;
}

export default function EmailProvider() {
  const { toast } = useToast();
  const { setCurrentSection, tutorialActive } = useTutorial();
  useEffect(() => {
    setCurrentSection("provider");
  }, [setCurrentSection]);
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [mailchimpApiKey, setMailchimpApiKey] = useState("");
  const [showBrevoKey, setShowBrevoKey] = useState(false);
  const [showMailchimpKey, setShowMailchimpKey] = useState(false);
  const [showBrevoInstructions, setShowBrevoInstructions] = useState(false);
  const [showMailchimpInstructions, setShowMailchimpInstructions] = useState(false);
  const [showMailchimpRequirements, setShowMailchimpRequirements] = useState(false);
  const [showBrevoRequirements, setShowBrevoRequirements] = useState(false);
  const [showIpAnalogy, setShowIpAnalogy] = useState(false);

  const { data: outboundIpData } = useQuery<{ ip: string | null }>({
    queryKey: ["/api/system/outbound-ip"],
  });
  const outboundIp = outboundIpData?.ip || null;

  function copyIpToClipboard() {
    if (!outboundIp) return;
    navigator.clipboard.writeText(outboundIp).then(() => {
      toast({ title: "IP copiada", description: "La IP del servidor fue copiada al portapapeles." });
    });
  }

  const mailchimpRequirementsPanel = (testIdSuffix: string) => (
    <div>
      <button
        type="button"
        data-testid={`button-toggle-mailchimp-requirements${testIdSuffix}`}
        onClick={() => setShowMailchimpRequirements(!showMailchimpRequirements)}
        className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 hover:underline"
      >
        <AlertTriangle className="w-4 h-4" />
        {showMailchimpRequirements ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Requisitos importantes
      </button>
      {showMailchimpRequirements && (
        <div data-testid={`mailchimp-requirements-panel${testIdSuffix}`} className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm space-y-3">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Verifique su dominio de correo</p>
              <p className="text-amber-700 mt-0.5">Si no verifica su dominio en Mailchimp, los correos que envíe van a aparecer como enviados desde una dirección genérica (<code className="bg-amber-100 px-1 rounded">@mandrillapp.com</code>) en lugar de su marca. Necesitará acceso al sitio donde compró su dominio web para completar este paso.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Busque "Autenticar dominio" en la configuración de su cuenta de Mailchimp.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Dirección física en los correos</p>
              <p className="text-amber-700 mt-0.5">Por ley, todo correo masivo debe incluir una dirección postal real de su empresa o negocio. Mailchimp la pide cuando usted configura su lista de contactos y la agrega automáticamente al pie de cada correo que envíe.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Ingrese esta dirección en la configuración de su audiencia en Mailchimp.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Límites del plan gratuito</p>
              <p className="text-amber-700 mt-0.5">La cuenta gratuita de Mailchimp solo permite enviar <strong>100 correos en total</strong>. Cuando se acaben, necesita agregar una tarjeta de crédito o cambiar a un plan de pago directamente en Mailchimp.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Puede revisar y actualizar su plan desde su panel de Mailchimp.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Velocidad de envío</p>
              <p className="text-amber-700 mt-0.5">Si envía muchas campañas al mismo tiempo, Mailchimp puede pausar temporalmente sus envíos. Esto es normal y se resuelve solo esperando unos minutos.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Puede revisar el estado de sus envíos desde su panel de Mailchimp.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Users className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Permiso de sus contactos</p>
              <p className="text-amber-700 mt-0.5">Las personas a las que les envíe correos deben haber aceptado recibir información suya previamente. Si envía correos a personas que no lo autorizaron, <strong>Mailchimp puede suspender su cuenta</strong>.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Asegúrese de tener consentimiento antes de importar contactos a Mailchimp.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const brevoRequirementsPanel = (testIdSuffix: string) => (
    <div>
      <button
        type="button"
        data-testid={`button-toggle-brevo-requirements${testIdSuffix}`}
        onClick={() => setShowBrevoRequirements(!showBrevoRequirements)}
        className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 hover:underline"
      >
        <AlertTriangle className="w-4 h-4" />
        {showBrevoRequirements ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Requisitos importantes
      </button>
      {showBrevoRequirements && (
        <div data-testid={`brevo-requirements-panel${testIdSuffix}`} className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Validación de cuenta nueva</p>
              <p className="text-amber-700 mt-0.5">Cuando crea una cuenta nueva en Brevo, esta pasa por una revisión de seguridad. Hasta que Brevo no la apruebe, <strong>no podrá enviar correos</strong> desde PostIAlo. Si le aparece un error de "cuenta en validación", debe completar su perfil en Brevo y esperar la aprobación.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Complete su perfil en el panel de Brevo para agilizar la aprobación.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Verifique su correo y dominio</p>
              <p className="text-amber-700 mt-0.5">Debe verificar al menos la dirección de correo que usará como remitente (Brevo le enviará un enlace de confirmación). Se recomienda también verificar el dominio completo para que sus correos <strong>no caigan en la carpeta de spam</strong> de sus destinatarios.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Busque "Dominios" o "Senders" en la configuración de su cuenta de Brevo.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Límites del plan gratuito</p>
              <p className="text-amber-700 mt-0.5">El plan gratuito de Brevo permite enviar hasta <strong>300 correos por día</strong>. Este límite se renueva automáticamente cada 24 horas. Si su campaña tiene más de 300 destinatarios, el envío se pausará y continuará al día siguiente.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Puede revisar y actualizar su plan desde su panel de Brevo.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Conexiones de seguimiento (webhooks)</p>
              <p className="text-amber-700 mt-0.5">PostIAlo crea automáticamente una conexión con Brevo para rastrear si sus correos fueron entregados y abiertos. Brevo permite máximo <strong>40 de estas conexiones</strong>. Si ya tiene muchas herramientas conectadas, puede que necesite eliminar alguna desde su panel de Brevo.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Revise sus webhooks en la configuración de Brevo si tiene problemas al conectar.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Users className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Permiso de sus contactos</p>
              <p className="text-amber-700 mt-0.5">Las personas a las que envíe correos deben haber dado su consentimiento para recibir información suya. Si envía correos a personas que no lo autorizaron y estos generan quejas, <strong>Brevo puede bloquear su cuenta</strong>.</p>
              <p className="text-amber-600 mt-1 text-xs italic">Asegúrese de tener consentimiento antes de importar contactos a su cuenta.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="w-full space-y-2">
              <p className="font-semibold text-amber-800">⚠️ Autoriza a PostIAlo para conectarse con tu cuenta</p>
              <p className="text-amber-700 text-xs">
                Tu cuenta de Brevo tiene activada una medida de seguridad que funciona como un <strong>"guardaespaldas"</strong>: no solo verifica tu API key (la llave maestra de tu cuenta), sino que también revisa <em>desde qué dirección IP</em> se hace la conexión. Si el sistema no reconoce la IP de PostIAlo, la bloquea automáticamente aunque tengas la llave correcta.
              </p>
              <button
                type="button"
                data-testid="button-toggle-ip-analogy"
                onClick={() => setShowIpAnalogy(!showIpAnalogy)}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 hover:underline transition-colors"
              >
                {showIpAnalogy ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showIpAnalogy ? "Ocultar explicación de IPs" : "¿Qué diferencia hay entre una IP compartida y una dedicada?"}
              </button>
              {showIpAnalogy && (
                <div className="text-xs text-amber-700 bg-amber-100/60 rounded-lg p-3 space-y-1.5">
                  <p><strong>IP compartida (plan gratuito/básico):</strong> Es como viajar en un autobús público — tu empresa comparte el mismo servidor de envío con otras. Es económico, pero si otro pasajero hace spam, Gmail/Outlook puede "detener el autobús" y tus correos podrían ir al spam por culpa de otros.</p>
                  <p><strong>IP dedicada (planes avanzados):</strong> Es como tener tu propio auto privado — solo tú construyes la reputación de esa IP. Si envías correos legítimos, siempre llegás directo a la bandeja de entrada. Recomendado para empresas que envían miles de correos al mes.</p>
                </div>
              )}
              <p className="text-amber-700 text-xs font-medium">Pasos para solucionarlo (menos de 1 minuto):</p>
              <ol className="list-decimal list-inside text-amber-700 text-xs space-y-1.5">
                <li>Inicia sesión en Brevo y ve a <strong>Configuración → Seguridad → IPs autorizadas</strong></li>
                <li>Haz clic en <strong>"Añadir una IP"</strong> y pega exactamente este número:</li>
              </ol>
              <div className="ml-4">
                <span className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 rounded px-2 py-1 font-mono text-amber-900 text-xs">
                  {outboundIp || "cargando…"}
                  {outboundIp && (
                    <button
                      type="button"
                      data-testid="button-copy-outbound-ip"
                      onClick={copyIpToClipboard}
                      className="text-amber-600 hover:text-amber-800 transition-colors"
                      title="Copiar IP"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </span>
              </div>
              <ol className="list-decimal list-inside text-amber-700 text-xs space-y-1.5" start={3}>
                <li>Guarda los cambios en Brevo</li>
                <li>Regresa aquí y vuelve a intentar conectar tu cuenta</li>
              </ol>
              <p className="text-amber-600 text-xs italic">
                Alternativa: si preferís, podés simplemente <strong>desactivar la restricción de IPs</strong> en esa misma pantalla de Brevo y la conexión funcionará de inmediato.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const { data: allProviders, isLoading } = useQuery<ProviderStatus[]>({
    queryKey: ["/api/email-provider/status"],
    queryFn: async () => {
      const res = await fetch("/api/email-provider/status", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const brevoStatus = allProviders?.find(p => p.provider === "brevo" && p.isActive) || null;
  const mailchimpStatus = allProviders?.find(p => p.provider === "mailchimp" && p.isActive) || null;

  const { data: sendersData, isLoading: sendersLoading } = useQuery<{ senders: BrevoSender[] }>({
    queryKey: ["/api/email-provider/brevo/senders"],
    enabled: !!brevoStatus,
  });
  const senders = sendersData?.senders || [];

  const { data: domainsData, isLoading: domainsLoading } = useQuery<{ domains: MailchimpDomain[] }>({
    queryKey: ["/api/email-provider/mailchimp/senders"],
    enabled: !!mailchimpStatus,
  });
  const domains = domainsData?.domains || [];

  const { data: audiencesData, isLoading: audiencesLoading } = useQuery<{ audiences: MailchimpAudience[]; selectedAudienceId: string | null }>({
    queryKey: ["/api/email-provider/mailchimp/audiences"],
    enabled: !!mailchimpStatus,
  });
  const audiences = audiencesData?.audiences || [];
  const selectedAudienceId = audiencesData?.selectedAudienceId || null;

  const updateAudienceMutation = useMutation({
    mutationFn: async ({ providerId, audienceId }: { providerId: number; audienceId: string }) => {
      const res = await apiRequest("PATCH", `/api/email-provider/${providerId}/audience`, { audienceId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/mailchimp/audiences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/status"] });
      toast({ title: "Audiencia actualizada", description: "La audiencia de Mailchimp ha sido seleccionada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const res = await apiRequest("POST", "/api/email-provider/connect", { provider, apiKey });
      return res.json();
    },
    onSuccess: (data, variables) => {
      if (variables.provider === "brevo") setBrevoApiKey("");
      else setMailchimpApiKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      queryClient.invalidateQueries({ queryKey: [`/api/email-provider/${variables.provider}/senders`] });
      if (variables.provider === "mailchimp") {
        queryClient.invalidateQueries({ queryKey: ["/api/email-provider/mailchimp/audiences"] });
      }
      const name = variables.provider === "brevo" ? "Brevo" : "Mailchimp";
      toast({ title: "Proveedor conectado", description: `Su cuenta de ${name} ha sido vinculada exitosamente.`, duration: 8000 });
      if (data?.warning) {
        toast({ title: "Aviso", description: data.warning, variant: "destructive", duration: 8000 });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error de conexión", description: err.message || "No se pudo conectar. Verifique su API key.", variant: "destructive", duration: 8000 });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: string) => {
      await apiRequest("DELETE", `/api/email-provider/${provider}`);
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      queryClient.invalidateQueries({ queryKey: [`/api/email-provider/${provider}/senders`] });
      const name = provider === "brevo" ? "Brevo" : "Mailchimp";
      toast({ title: "Proveedor desconectado", description: `Su cuenta de ${name} ha sido desvinculada.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "No se pudo desconectar.", variant: "destructive", duration: 8000 });
    },
  });

  const updateSenderMutation = useMutation({
    mutationFn: async ({ provider, email, name }: { provider: string; email: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/email-provider/${provider}/sender`, {
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
      toast({ title: "Error", description: err.message, variant: "destructive", duration: 8000 });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async ({ id, remove }: { id: number; remove: boolean }) => {
      if (remove) {
        await apiRequest("DELETE", `/api/email-provider/${id}/default`);
      } else {
        await apiRequest("PATCH", `/api/email-provider/${id}/default`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-provider/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      toast({ title: "Predeterminado actualizado" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive", duration: 8000 });
    },
  });

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
        <TutorialHighlight fieldId="provider-overview">
          <div>
            <h1 data-testid="text-page-title" className="text-3xl md:text-4xl font-extrabold">Proveedor de Email</h1>
            <p className="text-muted-foreground mt-1">Conecte sus servicios de envío de correos para enviar campañas directamente.</p>
          </div>
        </TutorialHighlight>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Brevo Card ── */}
          <div data-testid="card-brevo" className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={brevoLogo} alt="Brevo" className="w-10 h-10 rounded-xl object-cover" />
                <div>
                  <h3 className="font-bold text-base">Brevo</h3>
                  <p className="text-xs text-muted-foreground">Servicio de email transaccional</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {brevoStatus?.isDefault && (
                  <span data-testid="badge-brevo-default" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    Predeterminado
                  </span>
                )}
                {brevoStatus && (
                  <span data-testid="badge-brevo-connected" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    <Check className="w-3 h-3" />
                    Conectado
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {!brevoStatus ? (
                <>
                  <TutorialHighlight fieldId="provider-apikey">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="brevo-api-key">API Key de Brevo</Label>
                        <div className="relative">
                          <Input
                            data-testid="input-brevo-api-key"
                            id="brevo-api-key"
                            type={showBrevoKey ? "text" : "password"}
                            placeholder="xkeysib-..."
                            value={brevoApiKey}
                            onChange={(e) => setBrevoApiKey(e.target.value)}
                            className="rounded-xl pr-10"
                          />
                          <button
                            data-testid="button-toggle-brevo-key"
                            type="button"
                            onClick={() => setShowBrevoKey(!showBrevoKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showBrevoKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <Button
                        data-testid="button-connect-brevo"
                        onClick={() => connectMutation.mutate({ provider: "brevo", apiKey: brevoApiKey.trim() })}
                        disabled={connectMutation.isPending || !brevoApiKey.trim()}
                        className="w-full rounded-xl gap-2"
                      >
                        {connectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                        {connectMutation.isPending ? "Conectando..." : "Conectar"}
                      </Button>
                    </div>
                  </TutorialHighlight>
                  <div className="pt-2">
                    <button
                      data-testid="button-toggle-brevo-instructions"
                      onClick={() => setShowBrevoInstructions(!showBrevoInstructions)}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {showBrevoInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      ¿Cómo obtener mi API key?
                    </button>
                    {showBrevoInstructions && (
                      <div data-testid="brevo-instructions-panel" className="mt-3 p-4 bg-muted/50 rounded-xl text-sm space-y-2">
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
                  <div className="pt-1">
                    {brevoRequirementsPanel("")}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    {brevoStatus.accountEmail && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cuenta:</span>
                        <span data-testid="text-brevo-account-email" className="font-medium">{brevoStatus.accountEmail}</span>
                      </div>
                    )}
                    {brevoStatus.accountPlan && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Plan:</span>
                        <span data-testid="text-brevo-plan" className="font-medium flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          {brevoStatus.accountPlan}
                        </span>
                      </div>
                    )}
                    {brevoStatus.maskedKey && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">API Key:</span>
                        <span data-testid="text-brevo-masked-key" className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          ••••••••{brevoStatus.maskedKey}
                        </span>
                      </div>
                    )}
                    {brevoStatus.senderEmail && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Remitente:</span>
                        <span data-testid="text-brevo-sender" className="font-medium">
                          {brevoStatus.senderName ? `${brevoStatus.senderName} <${brevoStatus.senderEmail}>` : brevoStatus.senderEmail}
                        </span>
                      </div>
                    )}
                  </div>

                  {sendersLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : senders.length > 0 ? (
                    <TutorialHighlight fieldId="provider-sender">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Remitentes verificados
                        </Label>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {senders.filter(s => s.active).map((sender) => {
                            const isSelected = brevoStatus.senderEmail === sender.email;
                            return (
                              <button
                                key={sender.id}
                                data-testid={`button-brevo-sender-${sender.id}`}
                                onClick={() => updateSenderMutation.mutate({ provider: "brevo", email: sender.email, name: sender.name })}
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
                    </TutorialHighlight>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      No se encontraron remitentes verificados en su cuenta de Brevo.
                    </div>
                  )}

                  {brevoRequirementsPanel("-connected")}

                  {brevoStatus && mailchimpStatus ? (
                    <TutorialHighlight fieldId="provider-default">
                      <Button
                        data-testid="button-toggle-brevo-default"
                        variant={brevoStatus.isDefault ? "default" : "outline"}
                        onClick={() => setDefaultMutation.mutate({ id: brevoStatus.id, remove: brevoStatus.isDefault })}
                        disabled={setDefaultMutation.isPending}
                        className={`w-full rounded-xl gap-2 ${brevoStatus.isDefault ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                      >
                        <Star className={`w-4 h-4 ${brevoStatus.isDefault ? "fill-white" : ""}`} />
                        {brevoStatus.isDefault ? "Predeterminado" : "Establecer como predeterminado"}
                      </Button>
                    </TutorialHighlight>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">
                      <Star className="w-4 h-4 fill-amber-500" />
                      <span>Predeterminado</span>
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
                          Se eliminará la configuración de Brevo. No podrá enviar campañas con este proveedor hasta volver a conectarlo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-disconnect-brevo">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          data-testid="button-confirm-disconnect-brevo"
                          onClick={() => disconnectMutation.mutate("brevo")}
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

          {/* ── Mailchimp Card ── */}
          <div data-testid="card-mailchimp" className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={mailchimpLogo} alt="Mailchimp" className="w-10 h-10 rounded-xl object-cover" />
                <div>
                  <h3 className="font-bold text-base">Mailchimp</h3>
                  <p className="text-xs text-muted-foreground">Plataforma de email marketing</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mailchimpStatus?.isDefault && (
                  <span data-testid="badge-mailchimp-default" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    Predeterminado
                  </span>
                )}
                {mailchimpStatus && (
                  <span data-testid="badge-mailchimp-connected" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    <Check className="w-3 h-3" />
                    Conectado
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {!mailchimpStatus ? (
                <>
                  <TutorialHighlight fieldId="provider-apikey">
                    <div className="space-y-2">
                      <Label htmlFor="mailchimp-api-key">API Key de Mailchimp</Label>
                      <div className="relative">
                        <Input
                          data-testid="input-mailchimp-api-key"
                          id="mailchimp-api-key"
                          type={showMailchimpKey ? "text" : "password"}
                          placeholder="xxxxxxxxxxxxxxxx-usXX"
                          value={mailchimpApiKey}
                          onChange={(e) => setMailchimpApiKey(e.target.value)}
                          className="rounded-xl pr-10"
                        />
                        <button
                          data-testid="button-toggle-mailchimp-key"
                          type="button"
                          onClick={() => setShowMailchimpKey(!showMailchimpKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showMailchimpKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </TutorialHighlight>
                  <Button
                    data-testid="button-connect-mailchimp"
                    onClick={() => connectMutation.mutate({ provider: "mailchimp", apiKey: mailchimpApiKey.trim() })}
                    disabled={connectMutation.isPending || !mailchimpApiKey.trim()}
                    className="w-full rounded-xl gap-2"
                  >
                    {connectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                    {connectMutation.isPending ? "Conectando..." : "Conectar"}
                  </Button>
                  <div className="pt-2">
                    <button
                      data-testid="button-toggle-mailchimp-instructions"
                      onClick={() => setShowMailchimpInstructions(!showMailchimpInstructions)}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {showMailchimpInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      ¿Cómo obtener mi API key?
                    </button>
                    {showMailchimpInstructions && (
                      <div data-testid="mailchimp-instructions-panel" className="mt-3 p-4 bg-muted/50 rounded-xl text-sm space-y-2">
                        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                          <li>Ingrese a su cuenta de <strong>Mailchimp</strong></li>
                          <li>Vaya a <strong>Profile → Extras → API keys</strong></li>
                          <li>Haga clic en <strong>"Create A Key"</strong></li>
                          <li>Copie la key completa (incluye el sufijo <code>-usXX</code>)</li>
                        </ol>
                        <a
                          data-testid="link-mailchimp-api-keys"
                          href="https://us1.admin.mailchimp.com/account/api/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium mt-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ir a Mailchimp API Keys
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="pt-1">
                    {mailchimpRequirementsPanel("")}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    {mailchimpStatus.accountEmail && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cuenta:</span>
                        <span data-testid="text-mailchimp-account-email" className="font-medium">{mailchimpStatus.accountEmail}</span>
                      </div>
                    )}
                    {mailchimpStatus.accountPlan && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Info:</span>
                        <span data-testid="text-mailchimp-plan" className="font-medium flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          {mailchimpStatus.accountPlan}
                        </span>
                      </div>
                    )}
                    {mailchimpStatus.maskedKey && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">API Key:</span>
                        <span data-testid="text-mailchimp-masked-key" className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          ••••••••{mailchimpStatus.maskedKey}
                        </span>
                      </div>
                    )}
                    {mailchimpStatus.senderEmail && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Remitente:</span>
                        <span data-testid="text-mailchimp-sender" className="font-medium">
                          {mailchimpStatus.senderName ? `${mailchimpStatus.senderName} <${mailchimpStatus.senderEmail}>` : mailchimpStatus.senderEmail}
                        </span>
                      </div>
                    )}
                  </div>

                  {audiencesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : audiences.length > 0 ? (
                    <TutorialHighlight fieldId="provider-audience">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Audiencia (lista de contactos)
                        </Label>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {audiences.map((audience) => {
                            const isSelected = selectedAudienceId === audience.id;
                            return (
                              <button
                                key={audience.id}
                                data-testid={`button-audience-${audience.id}`}
                                onClick={() => updateAudienceMutation.mutate({ providerId: mailchimpStatus.id, audienceId: audience.id })}
                                disabled={updateAudienceMutation.isPending || isSelected}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                    : "border-border hover:border-primary/30 hover:bg-muted/50"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{audience.name}</div>
                                  <div className="text-xs text-muted-foreground">{audience.memberCount} contactos</div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </TutorialHighlight>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      No se encontraron audiencias en su cuenta de Mailchimp. Cree una audiencia desde su panel de Mailchimp.
                    </div>
                  )}

                  {!selectedAudienceId && audiences.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Seleccione una audiencia para poder enviar campañas con Mailchimp.
                    </div>
                  )}

                  {domainsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : domains.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Dominios verificados
                      </Label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {domains.map((domain) => (
                          <div
                            key={domain.domain}
                            data-testid={`domain-${domain.domain}`}
                            className={`flex items-center justify-between p-3 rounded-xl border text-sm ${
                              domain.verified
                                ? "border-emerald-200 bg-emerald-50/50"
                                : "border-amber-200 bg-amber-50/50"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{domain.domain}</div>
                              <div className="text-xs text-muted-foreground">{domain.authenticationType || "DKIM"}</div>
                            </div>
                            {domain.verified ? (
                              <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Verificado
                              </span>
                            ) : (
                              <span className="text-amber-600 text-xs font-semibold">Pendiente</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {mailchimpRequirementsPanel("-connected")}

                  {brevoStatus && mailchimpStatus ? (
                    <TutorialHighlight fieldId="provider-default">
                      <Button
                        data-testid="button-toggle-mailchimp-default"
                        variant={mailchimpStatus.isDefault ? "default" : "outline"}
                        onClick={() => setDefaultMutation.mutate({ id: mailchimpStatus.id, remove: mailchimpStatus.isDefault })}
                        disabled={setDefaultMutation.isPending}
                        className={`w-full rounded-xl gap-2 ${mailchimpStatus.isDefault ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                      >
                        <Star className={`w-4 h-4 ${mailchimpStatus.isDefault ? "fill-white" : ""}`} />
                        {mailchimpStatus.isDefault ? "Predeterminado" : "Establecer como predeterminado"}
                      </Button>
                    </TutorialHighlight>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">
                      <Star className="w-4 h-4 fill-amber-500" />
                      <span>Predeterminado</span>
                    </div>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        data-testid="button-disconnect-mailchimp"
                        variant="outline"
                        className="w-full rounded-xl gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <Unplug className="w-4 h-4" />
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Desconectar Mailchimp?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará la configuración de Mailchimp. No podrá enviar campañas con este proveedor hasta volver a conectarlo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-disconnect-mailchimp">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          data-testid="button-confirm-disconnect-mailchimp"
                          onClick={() => disconnectMutation.mutate("mailchimp")}
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

        </div>
        {tutorialActive && <TutorialTip />}
      </div>
    </Layout>
  );
}
