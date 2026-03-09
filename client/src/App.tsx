import { Switch, Route, Redirect } from "wouter";
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
  const isAuth = localStorage.getItem("postIAlo_auth") === "true";
  if (!isAuth) {
    return <Redirect to="/login" />;
  }
  return <Component />;
}

function LoginRoute() {
  const isAuth = localStorage.getItem("postIAlo_auth") === "true";
  if (isAuth) {
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
