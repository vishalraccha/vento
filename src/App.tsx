import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Auth
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AuthCallback from '@/pages/AuthCallback';

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import NewInvoice from "./pages/NewInvoice";
import InvoiceDetail from "./pages/InvoiceDetail";
import Clients from "./pages/Clients";
import NewClient from "./pages/NewClient";
import Inventory from "./pages/Inventory";
import NewInventoryItem from "./pages/NewInventoryItem";
import More from "./pages/More";
import BusinessSetup from "./pages/BusinessSetup";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Quotations from "./pages/Quotations";
import NewQuotation from "./pages/NewQuotation";
import DailyWork from "./pages/DailyWork";
import Documents from "./pages/Documents";
import Reports from "./pages/Reports";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth Route */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><NewInvoice /></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/clients/new" element={<ProtectedRoute><NewClient /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/inventory/new" element={<ProtectedRoute><NewInventoryItem /></ProtectedRoute>} />
            <Route path="/inventory/:id" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
            <Route path="/more" element={<ProtectedRoute><More /></ProtectedRoute>} />
            
            {/* Secondary Pages */}
            <Route path="/business-setup" element={<ProtectedRoute><BusinessSetup /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            
            {/* Phase 4 routes */}
            <Route path="/quotations" element={<ProtectedRoute><Quotations /></ProtectedRoute>} />
            <Route path="/quotations/new" element={<ProtectedRoute><NewQuotation /></ProtectedRoute>} />
            <Route path="/daily-work" element={<ProtectedRoute><DailyWork /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
            
            {/* Legacy auth routes */}
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
