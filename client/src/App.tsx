import { useState, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import BrandIdentity from "@/pages/BrandIdentity";
import CalendarView from "@/pages/CalendarView";
import Templates from "@/pages/Templates";
import MyEmails from "@/pages/MyEmails";
import Contacts from "@/pages/Contacts";
import CampaignEditor from "@/pages/CampaignEditor";

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          setStatus("ok");
        } else {
          localStorage.removeItem("postIAlo_auth");
          localStorage.removeItem("postIAlo_user");
          localStorage.removeItem("postIAlo_userId");
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
      <Route path="/">{() => <ProtectedRoute component={Home} />}</Route>
      <Route path="/brand">{() => <ProtectedRoute component={BrandIdentity} />}</Route>
      <Route path="/calendar">{() => <ProtectedRoute component={CalendarView} />}</Route>
      <Route path="/templates">{() => <ProtectedRoute component={Templates} />}</Route>
      <Route path="/emails">{() => <ProtectedRoute component={MyEmails} />}</Route>
      <Route path="/contacts">{() => <ProtectedRoute component={Contacts} />}</Route>
      <Route path="/campaigns/:id">{() => <ProtectedRoute component={CampaignEditor} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
