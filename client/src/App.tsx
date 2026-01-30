import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/login";
import DashboardHome from "@/pages/dashboard-home";
import ProductsPage from "@/pages/products-page";
import OrdersPage from "@/pages/orders-page";
import DeliveriesPage from "@/pages/deliveries-page";
import NotFound from "@/pages/not-found";
import { DashboardLayout } from "@/components/layout-sidebar";

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      
      {/* Protected Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardHome} />}
      </Route>
      <Route path="/dashboard/products">
        {() => <ProtectedRoute component={ProductsPage} />}
      </Route>
      <Route path="/dashboard/orders">
        {() => <ProtectedRoute component={OrdersPage} />}
      </Route>
      <Route path="/dashboard/deliveries">
        {() => <ProtectedRoute component={DeliveriesPage} />}
      </Route>

      {/* Default Redirect */}
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      
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
