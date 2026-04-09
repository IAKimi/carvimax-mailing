import { useState, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TutorialProvider } from "@/contexts/TutorialContext";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import BrandIdentity from "@/pages/BrandIdentity";
import CalendarView from "@/pages/CalendarView";
import Templates from "@/pages/Templates";
import MyEmails from "@/pages/MyEmails";
import Contacts from "@/pages/Contacts";
import CampaignEditor from "@/pages/CampaignEditor";
import AdminUsers from "@/pages/AdminUsers";
import Dashboard from "@/pages/Dashboard";
import EmailProvider from "@/pages/EmailProvider";
import VerifyEmail from "@/pages/VerifyEmail";
import { getOnboardingLevel, type OnboardingStatus } from "@/components/Layout";

const ROUTE_LEVELS: Record<string, number> = {
  "/": 0,
  "/brand": 0,
  "/email-provider": 1,
  "/templates": 2,
  "/contacts": 3,
  "/calendar": 4,
  "/emails": 4,
  "/dashboard": 4,
  "/campaigns": 4,
  "/admin/users": 0,
  "/admin": 0,
};

function getRequiredLevel(path: string): number {
  if (ROUTE_LEVELS[path] !== undefined) return ROUTE_LEVELS[path];
  if (path.startsWith("/campaigns/")) return 4;
  if (path.startsWith("/admin")) return 0;
  return 0;
}

function getRedirectForLevel(level: number): string {
  if (level < 1) return "/brand";
  if (level < 2) return "/email-provider";
  if (level < 3) return "/templates";
  if (level < 4) return "/contacts";
  return "/";
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType<any>; adminOnly?: boolean }) {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "forbidden">("loading");

  const { data: onboardingStatus, isLoading: onboardingLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding-status"],
    enabled: status === "ok",
  });

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          if (adminOnly) {
            const data = await res.json();
            if (data.role !== "admin") {
              setStatus("forbidden");
              return;
            }
          }
          setStatus("ok");
        } else {
          localStorage.removeItem("postIAlo_auth");
          setStatus("denied");
        }
      })
      .catch(() => {
        setStatus("denied");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }
  if (status === "denied") {
    return <Redirect to="/login" />;
  }
  if (status === "forbidden") {
    return <Redirect to="/" />;
  }

  if (onboardingStatus && !onboardingLoading) {
    const currentLevel = getOnboardingLevel(onboardingStatus);
    const requiredLevel = getRequiredLevel(location);
    if (requiredLevel > currentLevel) {
      return <Redirect to={getRedirectForLevel(currentLevel)} />;
    }
  }

  return <Component />;
}

function LoginRoute() {
  const [status, setStatus] = useState<"loading" | "auth" | "no-auth">("loading");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        setStatus(res.ok ? "auth" : "no-auth");
      })
      .catch(() => setStatus("no-auth"));
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#002073]">
        <div className="animate-pulse text-white/60">Cargando...</div>
      </div>
    );
  }
  if (status === "auth") {
    return <Redirect to="/" />;
  }
  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route path="/verify/error" component={VerifyEmail} />
      <Route path="/">{() => <ProtectedRoute component={Home} />}</Route>
      <Route path="/brand">{() => <ProtectedRoute component={BrandIdentity} />}</Route>
      <Route path="/calendar">{() => <ProtectedRoute component={CalendarView} />}</Route>
      <Route path="/templates">{() => <ProtectedRoute component={Templates} />}</Route>
      <Route path="/email-provider">{() => <ProtectedRoute component={EmailProvider} />}</Route>
      <Route path="/emails">{() => <ProtectedRoute component={MyEmails} />}</Route>
      <Route path="/contacts">{() => <ProtectedRoute component={Contacts} />}</Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/campaigns/:id">{() => <ProtectedRoute component={CampaignEditor} />}</Route>
      <Route path="/admin/users">{() => <ProtectedRoute component={AdminUsers} adminOnly />}</Route>
      <Route path="/admin">{() => <Redirect to="/admin/users" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TutorialProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </TutorialProvider>
    </QueryClientProvider>
  );
}

export default App;
