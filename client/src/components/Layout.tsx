import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Mail, 
  Users, 
  Settings, 
  Plus,
  Sparkles
} from "lucide-react";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Mail, label: "Campaigns", href: "/campaigns" },
  { icon: Users, label: "Contacts", href: "/contacts" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-b md:border-r border-border flex flex-col justify-between sticky top-0 md:h-screen z-20">
        <div>
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent to-purple-400 flex items-center justify-center shadow-lg shadow-accent/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold tracking-tight text-xl text-foreground">PostIAlo<span className="text-accent">.mail</span></span>
          </div>

          <nav className="px-4 py-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const Icon = item.icon;
              
              return (
                <Link key={item.href} href={item.href} className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                  ${isActive 
                    ? "bg-accent/10 text-accent font-semibold" 
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/5"
                  }
                `}>
                  <Icon className={`w-5 h-5 ${isActive ? "text-accent" : ""}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4">
          <Link href="/campaigns/new" className="
            flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl
            bg-primary text-primary-foreground font-medium
            shadow-lg shadow-primary/20
            hover:shadow-xl hover:-translate-y-0.5 hover:bg-primary/90
            transition-all duration-300
          ">
            <Plus className="w-5 h-5" />
            New Campaign
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden p-6 md:p-8 lg:p-12 relative">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-6xl mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
