import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { FloatingChat } from "@/components/FloatingChat";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Home,
  Palette,
  CalendarDays,
  LayoutTemplate,
  Mail,
  Database,
  Menu,
  LogOut,
  Shield,
  ArrowLeft,
  Eye,
  BarChart3,
  Lightbulb,
  Lock,
  Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useTutorial } from "@/contexts/TutorialContext";
import { useGenerating } from "@/contexts/GeneratingContext";
import { useToast } from "@/hooks/use-toast";

interface OnboardingStatus {
  hasBrand: boolean;
  hasProvider: boolean;
  hasTemplates: boolean;
  hasContactDatabases: boolean;
}

const NAV_ITEMS = [
  { icon: Home, label: "Inicio", href: "/", requiresLevel: 0 },
  { icon: Palette, label: "Identidad de Marca", href: "/brand", requiresLevel: 0 },
  { icon: Link2, label: "Proveedor de Email", href: "/email-provider", requiresLevel: 1 },
  { icon: LayoutTemplate, label: "Plantillas", href: "/templates", requiresLevel: 2 },
  { icon: Database, label: "Base de Datos", href: "/contacts", requiresLevel: 3 },
  { icon: CalendarDays, label: "Calendario", href: "/calendar", requiresLevel: 4 },
  { icon: Mail, label: "Historial", href: "/emails", requiresLevel: 4 },
  { icon: BarChart3, label: "Dashboard", href: "/dashboard", requiresLevel: 4 },
];

function getOnboardingLevel(status: OnboardingStatus | undefined): number {
  if (!status) return 0;
  if (!status.hasBrand) return 0;
  if (!status.hasProvider) return 1;
  if (!status.hasTemplates) return 2;
  if (!status.hasContactDatabases) return 3;
  return 4;
}

function getLockedMessage(requiredLevel: number, currentLevel: number): string {
  if (currentLevel < 1 && requiredLevel >= 1) {
    return "Primero completa tu Identidad de Marca para desbloquear esta sección.";
  }
  if (currentLevel < 2 && requiredLevel >= 2) {
    return "Primero conecta un proveedor de email (Brevo o Mailchimp) para desbloquear esta sección.";
  }
  if (currentLevel < 3 && requiredLevel >= 3) {
    return "Primero crea al menos una plantilla para desbloquear esta sección.";
  }
  if (currentLevel < 4 && requiredLevel >= 4) {
    return "Necesitas tener al menos una plantilla y una base de datos para acceder aquí.";
  }
  return "Sección bloqueada.";
}

let _sidebarMouseInside = false;

export { getOnboardingLevel };
export type { OnboardingStatus };

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { tutorialActive, toggleTutorial } = useTutorial();
  const { isGenerating } = useGenerating();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(_sidebarMouseInside);
  const sidebarRef = useRef<HTMLElement>(null);
  const { toast } = useToast();
  const { data: currentUser } = useQuery<{ id: number; name: string; email: string; role: string; impersonating?: boolean; impersonatingUserName?: string; originalAdminId?: number } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  const { data: onboardingStatus, isLoading: onboardingLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding-status"],
    enabled: !!currentUser,
  });
  const userName = currentUser?.name || "Usuario";
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const isImpersonating = !!currentUser?.impersonating;

  const onboardingLevel = onboardingLoading ? 99 : getOnboardingLevel(onboardingStatus);

  const stopImpersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/stop-impersonate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.href = "/admin/users";
    },
  });

  const navItems = [
    ...NAV_ITEMS,
    ...(isAdmin && !isImpersonating ? [{ icon: Shield, label: "Usuarios", href: "/admin/users", requiresLevel: 0 }] : []),
  ];

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    setSidebarExpanded(_sidebarMouseInside);
  }, [location]);

  const handleMouseEnter = useCallback(() => {
    _sidebarMouseInside = true;
    setSidebarExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    _sidebarMouseInside = false;
    setSidebarExpanded(false);
  }, []);

  function handleLogout() {
    if (isGenerating) {
      toast({ title: "Generación en curso", description: "Espera a que termine para cerrar sesión." });
      return;
    }
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      localStorage.removeItem("postIAlo_auth");
      setLocation("/login");
    });
  }

  function handleLockedClick(item: typeof navItems[0]) {
    toast({
      title: "Sección bloqueada",
      description: getLockedMessage(item.requiresLevel, onboardingLevel),
      variant: "destructive",
    });
  }

  function renderNavItem(item: typeof navItems[0], isMobile: boolean) {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    const Icon = item.icon;
    const isLocked = item.requiresLevel > onboardingLevel;

    if (isGenerating) {
      return (
        <button
          key={item.href}
          data-testid={`nav-${isMobile ? "mobile-" : ""}${item.href.replace(/\//g, "") || "home"}`}
          onClick={() => toast({ title: "Generación en curso", description: "Espera a que termine para navegar." })}
          className={`
            flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden w-full
            ${isMobile ? "px-4" : sidebarExpanded ? "justify-start px-4" : "justify-center px-0"}
            text-white/40 cursor-not-allowed
          `}
        >
          <Icon className="w-5 h-5 flex-shrink-0 opacity-40" />
          {(isMobile || sidebarExpanded) && (
            <span className="opacity-40">{item.label}</span>
          )}
        </button>
      );
    }

    if (isLocked) {
      return (
        <button
          key={item.href}
          data-testid={`nav-${isMobile ? "mobile-" : ""}${item.href.replace(/\//g, "") || "home"}`}
          onClick={() => handleLockedClick(item)}
          className={`
            flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden w-full
            ${isMobile ? "px-4" : sidebarExpanded ? "justify-start px-4" : "justify-center px-0"}
            text-white/30 cursor-not-allowed
          `}
        >
          <div className="relative flex-shrink-0">
            <Icon className="w-5 h-5 opacity-40" />
            <Lock className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-white/50" />
          </div>
          {(isMobile || sidebarExpanded) && (
            <span className="opacity-40">{item.label}</span>
          )}
        </button>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        data-testid={`nav-${isMobile ? "mobile-" : ""}${item.href.replace(/\//g, "") || "home"}`}
        onClick={isMobile ? () => setMobileOpen(false) : undefined}
        className={`
          flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden
          ${isMobile ? "px-4" : sidebarExpanded ? "justify-start px-4" : "justify-center px-0"}
          ${isActive
            ? "bg-white/20 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
          }
        `}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {(isMobile || sidebarExpanded) && (
          <span>{item.label}</span>
        )}
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        ref={sidebarRef}
        className="hidden md:flex fixed inset-y-0 left-0 z-40 flex-col bg-[#002073] text-white transition-all duration-300 ease-in-out"
        style={{ width: sidebarExpanded ? "16rem" : "4.5rem" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-testid="desktop-sidebar"
      >
        <div className="p-5 flex items-center gap-3 border-b border-white/10 overflow-hidden whitespace-nowrap">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          {sidebarExpanded && (
            <span className="font-extrabold tracking-tight text-lg text-white">
              Post<span className="text-[#e3001b]">IA</span>lo <span className="text-white">Mailing</span>
            </span>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => renderNavItem(item, false))}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2 overflow-hidden">
          {sidebarExpanded && (
            <div className="px-4 py-2 text-sm text-white/60 truncate">
              {userName}
            </div>
          )}
          {location !== "/" && (
            <button
              data-testid="button-tutorial-toggle"
              onClick={toggleTutorial}
              title="Modo Tutorial"
              className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full whitespace-nowrap overflow-hidden ${sidebarExpanded ? "justify-start px-4" : "justify-center px-0"} ${
                tutorialActive
                  ? "text-yellow-400 bg-yellow-400/15 hover:bg-yellow-400/25"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Lightbulb className={`w-5 h-5 flex-shrink-0 transition-all ${tutorialActive ? "drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]" : ""}`} />
              {sidebarExpanded && (
                <span>Tutorial</span>
              )}
            </button>
          )}
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-[#e3001b]/20 hover:text-[#e3001b] transition-all duration-200 w-full whitespace-nowrap overflow-hidden ${sidebarExpanded ? "justify-start px-4" : "justify-center px-0"}`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarExpanded && (
              <span>Cerrar Sesión</span>
            )}
          </button>
        </div>
      </aside>

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 flex flex-col md:hidden
        transform transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        bg-[#002073] text-white
      `}>
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold tracking-tight text-lg text-white">
            Post<span className="text-[#e3001b]">IA</span>lo <span className="text-white">Mailing</span>
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => renderNavItem(item, true))}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <div className="px-4 py-2 text-sm text-white/60 truncate">
            {userName}
          </div>
          {location !== "/" && (
            <button
              data-testid="button-tutorial-toggle-mobile"
              onClick={toggleTutorial}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full ${
                tutorialActive
                  ? "text-yellow-400 bg-yellow-400/15 hover:bg-yellow-400/25"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Lightbulb className={`w-5 h-5 flex-shrink-0 ${tutorialActive ? "drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]" : ""}`} />
              Tutorial
            </button>
          )}
          <button
            data-testid="button-logout-mobile"
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-[#e3001b]/20 hover:text-[#e3001b] transition-all duration-200 w-full"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div data-testid="overlay-mobile-sidebar" className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out md:ml-[4.5rem]">
        {isImpersonating && (
          <div data-testid="banner-impersonation" className="sticky top-0 z-30 bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-2 text-sm font-medium shadow-md">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span>Viendo como: <strong>{currentUser?.impersonatingUserName || userName}</strong></span>
            </div>
            <Button
              data-testid="button-stop-impersonate"
              size="sm"
              variant="secondary"
              className="gap-1.5 h-7 text-xs bg-white text-amber-700 hover:bg-amber-50"
              onClick={() => stopImpersonateMutation.mutate()}
              disabled={stopImpersonateMutation.isPending}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al Panel
            </Button>
          </div>
        )}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-6 h-14 flex items-center justify-between gap-2" style={isImpersonating ? { top: "36px" } : undefined}>
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
        </header>

        <main className="flex-1 overflow-x-hidden">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="p-4 md:p-8 lg:p-10 w-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
      <FloatingChat />
    </div>
  );
}
