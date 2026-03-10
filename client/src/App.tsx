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
import AdminUsers from "@/pages/AdminUsers";

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType<any>; adminOnly?: boolean }) {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "forbidden">("loading");

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
      <Route path="/admin/users">{() => <ProtectedRoute component={AdminUsers} adminOnly />}</Route>
      <Route path="/admin">{() => <Redirect to="/admin/users" />}</Route>
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
