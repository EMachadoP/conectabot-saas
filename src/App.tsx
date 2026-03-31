import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { PlatformAdminRoute } from "@/components/auth/PlatformAdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Inbox from "./pages/Inbox";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import AdminAI from "./pages/AdminAI";
import AdminKnowledge from "./pages/AdminKnowledge";
import AdminZAPI from "./pages/AdminZAPI";
import AdminContacts from "./pages/AdminContacts";
import AdminDuplicates from "./pages/AdminDuplicates";
import AdminIntegrations from "./pages/AdminIntegrations";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import SAC from "./pages/SAC";
import SACTicketDetail from "./pages/SACTicketDetail";
import Status from "./pages/Status";
import TeamSettings from "./pages/TeamSettings";
import BillingSettings from "./pages/BillingSettings";
import SuperAdminClients from "./pages/SuperAdminClients";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
          </BrowserRouter>
        </TooltipProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
