import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import {
  Sparkles, Image, CalendarDays, Send, Palette, PenTool,
  LayoutTemplate, Rocket, ArrowRight, Mail, Users, BarChart3,
  Clock, CheckCircle2, Zap, TrendingUp
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programado",
  sending: "Enviando",
  sent: "Enviado",
  partial: "Parcial",
  failed: "Fallido",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
  partial: "bg-orange-100 text-orange-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const quickActions = [
  {
    icon: CalendarDays,
    title: "Crear Campaña",
    description: "Crea un nuevo correo con IA",
    href: "/calendar",
    color: "bg-blue-500",
    testId: "action-create-campaign",
  },
  {
    icon: Palette,
    title: "Mi Marca",
    description: "Configura tu identidad visual",
    href: "/brand",
    color: "bg-violet-500",
    testId: "action-brand",
  },
  {
    icon: LayoutTemplate,
    title: "Plantillas",
    description: "Gestiona tus diseños de correo",
    href: "/templates",
    color: "bg-emerald-500",
    testId: "action-templates",
  },
  {
    icon: Users,
    title: "Contactos",
    description: "Administra tus bases de datos",
    href: "/contacts",
    color: "bg-amber-500",
    testId: "action-contacts",
  },
];

const steps = [
  { icon: Palette, title: "Defina su marca", description: "Logotipo, colores y datos de contacto" },
  { icon: PenTool, title: "Cree su correo", description: "Tema, objetivo y contenido con IA" },
  { icon: LayoutTemplate, title: "Escoja plantilla", description: "Seleccione un diseño profesional" },
  { icon: Rocket, title: "Programe y envíe", description: "Revise, apruebe y despache" },
];

const features = [
  { icon: PenTool, title: "Textos con IA", description: "Copys adaptados a su marca" },
  { icon: Image, title: "Imágenes con IA", description: "Visuales generados automáticamente" },
  { icon: CalendarDays, title: "Programación", description: "Calendario con vista mensual" },
  { icon: Send, title: "Envío automático", description: "Despacho integrado con Make.com" },
];

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const { data: user } = useQuery<{ id: number; name: string; email: string } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: stats } = useQuery<{
    totalSent: number;
    recentCampaigns: (Campaign & { subject?: string })[];
    campaignsThisMonth: number;
    contactsReached: number;
    monthlyLimit: number;
    planName: string;
  }>({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!user,
  });

  const { data: allCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!user,
  });

  const { data: onboardingStatus } = useQuery<{ hasBrand: boolean; hasTemplates: boolean; hasContactDatabases: boolean }>({
    queryKey: ["/api/onboarding-status"],
    enabled: !!user,
  });

  const userName = user?.name?.split(" ")[0] || "Usuario";
  const totalSent = stats?.totalSent || 0;
  const totalCampaigns = allCampaigns?.length || 0;
  const scheduledCampaigns = allCampaigns?.filter(c => c.status === "scheduled").length || 0;
  const recentCampaigns = (stats?.recentCampaigns || []).slice(0, 4);
  const hasBrand = onboardingStatus?.hasBrand || false;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <Layout>
      <div className="space-y-8">
        <FadeIn>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">{greeting}</p>
              <h1 data-testid="text-home-title" className="text-3xl md:text-4xl font-extrabold">
                {userName} <span className="text-primary">👋</span>
              </h1>
              <p className="text-muted-foreground mt-1">Tu centro de email marketing inteligente</p>
            </div>
            <Link href="/calendar">
              <Button data-testid="button-new-campaign" size="lg" className="rounded-xl gap-2 shadow-md">
                <Zap className="w-4 h-4" />
                Nueva Campaña
              </Button>
            </Link>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <FadeIn delay={0.05}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickActions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <Link key={action.testId} href={action.href}>
                      <Card
                        data-testid={action.testId}
                        className="p-4 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group"
                      >
                        <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-3`}>
                          <ActionIcon className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold text-sm mb-0.5">{action.title}</h3>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5" data-testid="section-how-it-works">
                  <h2 className="font-bold mb-4 flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-primary" />
                    ¿Cómo funciona?
                  </h2>
                  <div className="space-y-4">
                    {steps.map((step, i) => {
                      const StepIcon = step.icon;
                      return (
                        <div key={i} className="flex items-start gap-3" data-testid={`step-item-${i}`}>
                          <div className="relative flex flex-col items-center">
                            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                              <StepIcon className="w-4 h-4 text-primary-foreground" />
                            </div>
                            {i < steps.length - 1 && (
                              <div className="w-0.5 h-4 bg-primary/20 mt-1" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold">{step.title}</h4>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card className="p-5" data-testid="section-features">
                  <h2 className="font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Funcionalidades
                  </h2>
                  <div className="space-y-4">
                    {features.map((feature, i) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <div key={i} className="flex items-start gap-3" data-testid={`feature-item-${i}`}>
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FeatureIcon className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold">{feature.title}</h4>
                            <p className="text-xs text-muted-foreground">{feature.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </FadeIn>

            {!hasBrand && (
              <FadeIn delay={0.15}>
                <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-primary/10 text-center">
                  <Sparkles className="w-7 h-7 text-accent mx-auto mb-2" />
                  <h3 className="text-lg font-bold mb-1">¿Listo para empezar?</h3>
                  <p className="text-sm text-muted-foreground mb-4">Comience definiendo su identidad de marca para que la IA cree contenido a su medida.</p>
                  <Link href="/brand">
                    <Button data-testid="button-cta-brand" className="rounded-xl gap-2">
                      <Palette className="w-4 h-4" />
                      Ir a Identidad de Marca
                    </Button>
                  </Link>
                </Card>
              </FadeIn>
            )}
          </div>

          <div className="space-y-6">
            {user && (
              <FadeIn delay={0.05}>
                <div className="space-y-3">
                  <Card className="p-4 flex items-center gap-3" data-testid="stat-total-campaigns">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold">{totalCampaigns}</p>
                      <p className="text-xs text-muted-foreground">Campañas</p>
                    </div>
                  </Card>
                  <Card className="p-4 flex items-center gap-3" data-testid="stat-total-sent">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold">{totalSent}</p>
                      <p className="text-xs text-muted-foreground">Enviadas</p>
                    </div>
                  </Card>
                  <Card className="p-4 flex items-center gap-3" data-testid="stat-scheduled">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold">{scheduledCampaigns}</p>
                      <p className="text-xs text-muted-foreground">Programadas</p>
                    </div>
                  </Card>
                </div>
              </FadeIn>
            )}

            {user && stats && (
              <FadeIn delay={0.1}>
                <Card className="p-5" data-testid="widget-monthly-activity">
                  <h2 className="font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Actividad del mes
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-end justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Campañas enviadas</span>
                        <span className="text-xs font-bold" data-testid="text-campaigns-this-month">
                          {stats.campaignsThisMonth}
                          <span className="text-muted-foreground font-normal"> / {stats.monthlyLimit}</span>
                        </span>
                      </div>
                      <Progress
                        value={Math.min((stats.campaignsThisMonth / stats.monthlyLimit) * 100, 100)}
                        className="h-2"
                        data-testid="progress-monthly-campaigns"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <p className="text-xl font-extrabold" data-testid="text-contacts-reached">{(stats.contactsReached ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Contactos alcanzados</p>
                      </div>
                      <div className="rounded-lg bg-primary/5 p-3 text-center">
                        <p className="text-sm font-bold text-primary truncate" data-testid="text-plan-name">{stats.planName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Plan activo</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </FadeIn>
            )}

            {recentCampaigns.length > 0 && (
              <FadeIn delay={0.1}>
                <Card className="p-5" data-testid="section-recent-campaigns">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Actividad Reciente
                    </h2>
                    <Link href="/emails">
                      <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="button-view-all-history">
                        Ver todo <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {recentCampaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        data-testid={`recent-campaign-${campaign.id}`}
                        className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{(campaign as any).subject || campaign.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {campaign.createdAt
                                ? new Date(campaign.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })
                                : "—"}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[campaign.status] || STATUS_COLORS.draft}`}>
                          {STATUS_LABELS[campaign.status] || campaign.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </FadeIn>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
