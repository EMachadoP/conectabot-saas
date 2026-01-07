import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
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
import SAC from "./pages/SAC";
import SACTicketDetail from "./pages/SACTicketDetail";
import Status from "./pages/Status";
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
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/ai" element={<AdminAI />} />
              <Route path="/admin/knowledge" element={<AdminKnowledge />} />
              <Route path="/admin/zapi" element={<AdminZAPI />} />
              <Route path="/admin/contacts" element={<AdminContacts />} />
              <Route path="/admin/duplicates" element={<AdminDuplicates />} />
              <Route path="/admin/integrations" element={<AdminIntegrations />} />
              <Route path="/inbox/:id" element={<Inbox />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/sac" element={<SAC />} />
              <Route path="/sac/:id" element={<SACTicketDetail />} />
              <Route path="/status" element={<Status />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;