import { Layout } from "@/components/Layout";
import { AnimatedCard } from "@/components/AnimatedCard";
import { useCampaigns } from "@/hooks/use-campaigns";
import { Link } from "wouter";
import { Plus, Search, Calendar, FileText, Send, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function CampaignsList() {
  const { data: campaigns, isLoading } = useCampaigns();

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">Campaigns</h1>
            <p className="text-lg text-muted-foreground">Manage and track your email automations.</p>
          </div>
          <Link href="/campaigns/new" className="
            inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
            bg-primary text-primary-foreground font-semibold
            shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 hover:bg-primary/90
            transition-all duration-300 whitespace-nowrap
          ">
            <Plus className="w-5 h-5" />
            Create Campaign
          </Link>
        </div>

        {/* Filters / Search Bar placeholder */}
        <div className="flex items-center bg-card border border-border rounded-2xl p-2 shadow-sm">
          <div className="pl-4 pr-2 text-muted-foreground">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            placeholder="Search campaigns..." 
            className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-2 text-foreground placeholder:text-muted-foreground outline-none"
          />
          <select className="bg-secondary border-none rounded-xl px-4 py-2 font-medium text-foreground outline-none focus:ring-2 focus:ring-accent cursor-pointer">
            <option>All Status</option>
            <option>Draft</option>
            <option>Review</option>
            <option>Scheduled</option>
            <option>Sent</option>
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />)}
          </div>
        ) : !campaigns?.length ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">Create your first AI-powered email campaign to start engaging with your audience.</p>
            <Link href="/campaigns/new" className="px-6 py-3 rounded-xl bg-accent text-white font-semibold shadow-lg shadow-accent/30 hover:bg-accent/90 transition-all">
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {campaigns.map((camp, idx) => (
              <AnimatedCard key={camp.id} delay={idx * 0.05} className="!p-0 overflow-hidden flex flex-col sm:flex-row">
                <div className="p-6 flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={camp.status} />
                    <span className="text-sm text-muted-foreground flex items-center gap-1 font-medium">
                      <Calendar className="w-4 h-4" /> 
                      {format(new Date(camp.createdAt || Date.now()), "MMM d, yyyy")}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-1">{camp.name}</h3>
                  <p className="text-muted-foreground line-clamp-1">{camp.objective}</p>
                </div>
                
                <div className="bg-slate-50 dark:bg-white/5 border-t sm:border-t-0 sm:border-l border-border p-6 flex sm:flex-col items-center justify-end gap-3 sm:w-48">
                  <Link href={`/campaigns/${camp.id}`} className="
                    w-full py-2.5 px-4 text-center rounded-xl font-semibold transition-colors
                    bg-white dark:bg-slate-800 border border-border shadow-sm hover:border-accent hover:text-accent
                  ">
                    {camp.status === 'draft' || camp.status === 'review' ? 'Continue Edit' : 'View Report'}
                  </Link>
                </div>
              </AnimatedCard>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    draft: { color: "bg-slate-100 text-slate-600", icon: FileText, label: "Draft" },
    generating: { color: "bg-purple-100 text-purple-600", icon: Sparkles, label: "AI Generating" },
    review: { color: "bg-amber-100 text-amber-700", icon: AlertCircle, label: "Needs Review" },
    scheduled: { color: "bg-blue-100 text-blue-700", icon: Calendar, label: "Scheduled" },
    sent: { color: "bg-emerald-100 text-emerald-700", icon: Send, label: "Sent" },
  }[status] || { color: "bg-slate-100 text-slate-600", icon: FileText, label: status };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

// Ensure Mail import is available for empty state
import { Mail, Sparkles } from "lucide-react";
