import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialTip } from "@/components/TutorialTip";
import { TutorialHighlight } from "@/components/TutorialHighlight";
import {
  BarChart as RechartsBarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Mail, Users, Database, Layers, TrendingUp, Clock, BarChart3, Filter, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DashboardMetrics {
  totalCampaigns: Record<string, number>;
  campaignTimeline: Array<{ date: string; count: number }>;
  topDatabases: Array<{ name: string; count: number }>;
  totalContactsReached: number;
  averageVersionsPerCampaign: number;
  topTemplates: Array<{ name: string; count: number }>;
  campaignsByMonth: Array<{ month: string; count: number }>;
  recentCampaigns: Array<{ id: number; name: string; status: string; date: string | null }>;
  totalDatabases: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programado",
  sent: "Enviado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatMonth(m: string) {
  const parts = m.split("-");
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${MONTH_NAMES[monthIdx]} ${parts[0].slice(2)}`;
}

function formatDate(d: string) {
  const parts = d.split("-");
  return `${parseInt(parts[2], 10)} ${MONTH_NAMES[parseInt(parts[1], 10) - 1]}`;
}

function formatFullDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Dashboard() {
  const { setCurrentSection, tutorialActive } = useTutorial();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setCurrentSection("dashboard");
  }, [setCurrentSection]);

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  const qs = queryParams.toString();
  const metricsUrl = `/api/dashboard/metrics${qs ? `?${qs}` : ""}`;

  const { data: metrics, isLoading, isError, refetch } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(metricsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar métricas");
      return res.json();
    },
  });

  const totalAll = metrics ? Object.values(metrics.totalCampaigns).reduce((s, n) => s + n, 0) : 0;
  const hasFilters = dateFrom || dateTo;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Resumen de su actividad de email marketing</p>
          </div>
          <Button
            data-testid="button-toggle-filters"
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
            Filtrar por Fecha
            {hasFilters && <span className="w-2 h-2 rounded-full bg-[#e3001b]" />}
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dateFrom" className="text-xs font-medium">Desde</Label>
                  <Input
                    id="dateFrom"
                    data-testid="input-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-44 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dateTo" className="text-xs font-medium">Hasta</Label>
                  <Input
                    id="dateTo"
                    data-testid="input-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-44 h-9 text-sm"
                  />
                </div>
                {hasFilters && (
                  <Button
                    data-testid="button-clear-filters"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpiar
                  </Button>
                )}
              </div>
              {hasFilters && (
                <p className="text-xs text-muted-foreground mt-2">
                  Mostrando métricas {dateFrom ? `desde ${dateFrom}` : ""}{dateFrom && dateTo ? " " : ""}{dateTo ? `hasta ${dateTo}` : ""}
                </p>
              )}
            </CardContent>
          </Card>
        )}


        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-2/3 mb-3" />
                  <div className="h-8 bg-muted rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No se pudieron cargar las métricas del dashboard.</p>
              <button
                data-testid="button-retry-dashboard"
                onClick={() => refetch()}
                className="text-sm font-medium text-[#002073] hover:underline"
              >
                Reintentar
              </button>
            </CardContent>
          </Card>
        ) : metrics ? (
          <>
            <TutorialHighlight fieldId="dashboard-overview">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-total-campaigns">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">Total Correos</span>
                      <Mail className="w-4 h-4 text-[#002073]" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">{totalAll}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(metrics.totalCampaigns).filter(([, v]) => v > 0).map(([status, count]) => (
                        <span key={status} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}>
                          {count} {STATUS_LABELS[status] || status}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-contacts-reached">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">Contactos Alcanzados</span>
                      <Users className="w-4 h-4 text-[#002073]" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">{metrics.totalContactsReached.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">En campañas enviadas</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-total-databases">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">Bases de Datos</span>
                      <Database className="w-4 h-4 text-[#002073]" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">{metrics.totalDatabases}</div>
                    <p className="text-xs text-muted-foreground mt-1">Listas de contactos</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-avg-versions">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">Promedio Versiones IA</span>
                      <Layers className="w-4 h-4 text-[#002073]" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">{metrics.averageVersionsPerCampaign}</div>
                    <p className="text-xs text-muted-foreground mt-1">Iteraciones por campaña</p>
                  </CardContent>
                </Card>
              </div>
            </TutorialHighlight>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-campaign-timeline">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#002073]" />
                    Actividad del Mes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.campaignTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={metrics.campaignTimeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDate} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip labelFormatter={formatDate} formatter={(value: number) => [value, "Correos"]} />
                        <Line type="monotone" dataKey="count" stroke="#002073" strokeWidth={2} dot={{ fill: "#002073", r: 4 }} activeDot={{ r: 6, fill: "#e3001b" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                      Sin actividad este mes
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-campaigns-by-month">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#002073]" />
                    Correos por Mes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <RechartsBarChart data={metrics.campaignsByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={formatMonth} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip labelFormatter={formatMonth} formatter={(value: number) => [value, "Correos"]} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {metrics.campaignsByMonth.map((_, index) => (
                          <Cell key={index} fill={index === metrics.campaignsByMonth.length - 1 ? "#e3001b" : "#002073"} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card data-testid="card-top-databases">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#002073]" />
                    Bases de Datos Más Usadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.topDatabases.length > 0 ? (
                    <div className="space-y-3">
                      {metrics.topDatabases.map((db, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                            <span className="text-sm truncate">{db.name}</span>
                          </div>
                          <span className="text-xs font-semibold bg-[#002073]/10 text-[#002073] px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                            {db.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin datos disponibles</p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-top-templates">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#002073]" />
                    Plantillas Más Usadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.topTemplates.length > 0 ? (
                    <div className="space-y-3">
                      {metrics.topTemplates.map((tpl, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                            <span className="text-sm truncate">{tpl.name}</span>
                          </div>
                          <span className="text-xs font-semibold bg-[#e3001b]/10 text-[#e3001b] px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                            {tpl.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin datos disponibles</p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-recent-campaigns">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#002073]" />
                    Actividad Reciente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.recentCampaigns.length > 0 ? (
                    <div className="space-y-3">
                      {metrics.recentCampaigns.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFullDate(c.date)}</p>
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-700"}`}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin correos recientes</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {tutorialActive && <TutorialTip />}
      </div>
    </Layout>
  );
}
