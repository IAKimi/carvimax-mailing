import { Layout } from "@/components/Layout";
import { AnimatedCard } from "@/components/AnimatedCard";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Mail, MousePointerClick, ArrowUpRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

// Mock data for the chart to make it look beautiful
const mockChartData = [
  { name: 'Mon', sent: 4000, opened: 2400 },
  { name: 'Tue', sent: 3000, opened: 1398 },
  { name: 'Wed', sent: 2000, opened: 9800 },
  { name: 'Thu', sent: 2780, opened: 3908 },
  { name: 'Fri', sent: 1890, opened: 4800 },
  { name: 'Sat', sent: 2390, opened: 3800 },
  { name: 'Sun', sent: 3490, opened: 4300 },
];

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useDashboardStats();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">Overview</h1>
          <p className="text-lg text-muted-foreground">Monitor your AI-powered email campaigns.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <div className="p-6 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20">
            Failed to load dashboard statistics. Note: Backend API is pending implementation.
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <AnimatedCard delay={0.1} className="relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                  <Mail className="w-24 h-24" />
                </div>
                <div className="flex flex-col h-full relative z-10">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Sent</span>
                  <span className="text-4xl font-extrabold text-foreground">{stats?.totalSent?.toLocaleString() || "124,592"}</span>
                  <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-1 rounded-md">
                    <ArrowUpRight className="w-4 h-4 mr-1" /> +14.5% this month
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.2} className="relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                  <MousePointerClick className="w-24 h-24" />
                </div>
                <div className="flex flex-col h-full relative z-10">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Avg. Open Rate</span>
                  <span className="text-4xl font-extrabold text-foreground">42.8%</span>
                  <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-1 rounded-md">
                    <ArrowUpRight className="w-4 h-4 mr-1" /> +2.1% this month
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.3} className="bg-gradient-to-br from-primary to-slate-800 text-primary-foreground border-none">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <span className="text-sm font-semibold text-primary-foreground/70 uppercase tracking-wider mb-2 block">Active Campaigns</span>
                    <span className="text-4xl font-extrabold">12</span>
                  </div>
                  <Link href="/campaigns/new" className="mt-4 inline-flex items-center font-medium text-accent-foreground/90 hover:text-white transition-colors group">
                    Create new <ArrowUpRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </Link>
                </div>
              </AnimatedCard>
            </div>

            {/* Chart Section */}
            <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
              <h3 className="text-xl font-bold mb-6">Performance Trajectory</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="sent" stroke="hsl(var(--accent))" strokeWidth={3} fillOpacity={1} fill="url(#colorSent)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Campaigns */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Recent Campaigns</h3>
                <Link href="/campaigns" className="text-accent font-medium hover:underline">View all</Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(stats?.recentCampaigns || [
                  // Fallback mock data if API is pending
                  { id: 1, name: "Q4 Product Launch", status: "sent", scheduledAt: new Date().toISOString() },
                  { id: 2, name: "Black Friday Teaser", status: "draft", scheduledAt: null },
                  { id: 3, name: "Weekly Newsletter - Tech", status: "review", scheduledAt: null }
                ]).map((camp: any, idx: number) => (
                  <AnimatedCard key={camp.id} delay={0.1 * idx} className="!p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${camp.status === 'sent' ? 'bg-emerald-100 text-emerald-600' : 
                          camp.status === 'review' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}
                      `}>
                        {camp.status === 'sent' ? <Mail className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-lg">{camp.name}</h4>
                        <span className="text-sm text-muted-foreground capitalize flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            camp.status === 'sent' ? 'bg-emerald-500' : camp.status === 'review' ? 'bg-amber-500' : 'bg-slate-300'
                          }`} />
                          {camp.status}
                          {camp.scheduledAt && ` • ${format(new Date(camp.scheduledAt), "MMM d")}`}
                        </span>
                      </div>
                    </div>
                    <Link href={`/campaigns/${camp.id}`} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-slate-200 transition-colors">
                      {camp.status === 'draft' ? 'Edit' : 'View'}
                    </Link>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
