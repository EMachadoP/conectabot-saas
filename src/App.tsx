import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { PlatformAdminRoute } from "@/components/auth/PlatformAdminRoute";
import { useAppVersionRefresh } from "@/hooks/useAppVersionRefresh";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminAI = lazy(() => import("./pages/AdminAI"));
const AdminKnowledge = lazy(() => import("./pages/AdminKnowledge"));
const AdminZAPI = lazy(() => import("./pages/AdminZAPI"));
const AdminContacts = lazy(() => import("./pages/AdminContacts"));
const AdminDuplicates = lazy(() => import("./pages/AdminDuplicates"));
const AdminIntegrations = lazy(() => import("./pages/AdminIntegrations"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Tasks = lazy(() => import("./pages/Tasks"));
const SAC = lazy(() => import("./pages/SAC"));
const SACTicketDetail = lazy(() => import("./pages/SACTicketDetail"));
const Status = lazy(() => import("./pages/Status"));
const TeamSettings = lazy(() => import("./pages/TeamSettings"));
const BillingSettings = lazy(() => import("./pages/BillingSettings"));
const SuperAdminClients = lazy(() => import("./pages/SuperAdminClients"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Configure QueryClient for better performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const AppShell = () => {
  useAppVersionRefresh();

  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminRoute><Admin /></AdminRoute></ProtectedRoute>} />
                <Route path="/admin/ai" element={<ProtectedRoute><AdminRoute><AdminAI /></AdminRoute></ProtectedRoute>} />
                <Route path="/admin/knowledge" element={<ProtectedRoute><AdminRoute><AdminKnowledge /></AdminRoute></ProtectedRoute>} />
                <Route path="/admin/zapi" element={<ProtectedRoute><AdminRoute><AdminZAPI /></AdminRoute></ProtectedRoute>} />
                <Route path="/admin/contacts" element={<ProtectedRoute><AdminRoute><AdminContacts /></AdminRoute></ProtectedRoute>} />
                <Route path="/admin/duplicates" element={<ProtectedRoute><AdminRoute><AdminDuplicates /></AdminRoute></ProtectedRoute>} />
                <Route path="/admin/integrations" element={<ProtectedRoute><AdminRoute><AdminIntegrations /></AdminRoute></ProtectedRoute>} />
                <Route path="/settings/team" element={<ProtectedRoute><AdminRoute><TeamSettings /></AdminRoute></ProtectedRoute>} />
                <Route path="/settings/billing" element={<ProtectedRoute><AdminRoute><BillingSettings /></AdminRoute></ProtectedRoute>} />
                <Route path="/super-admin/clients" element={<ProtectedRoute><PlatformAdminRoute><SuperAdminClients /></PlatformAdminRoute></ProtectedRoute>} />
                <Route path="/inbox/:id" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                <Route path="/sac" element={<ProtectedRoute><SAC /></ProtectedRoute>} />
                <Route path="/sac/:id" element={<ProtectedRoute><SACTicketDetail /></ProtectedRoute>} />
                <Route path="/status" element={<ProtectedRoute><Status /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
};

const App = () => <AppShell />;

export default App;
