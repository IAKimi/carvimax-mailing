import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Home,
  Palette,
  CalendarDays,
  LayoutTemplate,
  Mail,
  Users,
  Sparkles,
  Sun,
  Moon,
  Menu,
  X,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { icon: Home, label: "Inicio", href: "/" },
  { icon: Palette, label: "Identidad de Marca", href: "/brand" },
  { icon: CalendarDays, label: "Calendario", href: "/calendar" },
  { icon: LayoutTemplate, label: "Plantillas", href: "/templates" },
  { icon: Mail, label: "Mis Correos", href: "/emails" },
  { icon: Users, label: "Contactos", href: "/contacts" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [mobileOpen, setMobileOpen] = useState(false);
  const userName = localStorage.getItem("postIAlo_user") || "Usuario";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  function handleLogout() {
    localStorage.removeItem("postIAlo_auth");
    localStorage.removeItem("postIAlo_user");
    setLocation("/login");
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col
        transform transition-transform duration-300 md:relative md:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-5 flex items-center gap-3 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold tracking-tight text-lg text-foreground">
            PostIAlo<span className="text-primary">.mail</span>
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.href.replace("/", "") || "home"}`}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className="px-4 py-2 text-sm text-muted-foreground truncate">
            {userName}
          </div>
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 w-full"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-6 h-14 flex items-center justify-between gap-2">
          <Button
            data-testid="button-mobile-menu"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <Button
            data-testid="button-theme-toggle"
            variant="ghost"
            size="icon"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
