import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RequireRole from "@/components/RequireRole";

import AuthGate from "./pages/AuthGate";

// Client pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CheckIn from "./pages/CheckIn";
import HealingSheets from "./pages/HealingSheets";
import Protocol from "./pages/Protocol";
import Message from "./pages/Message";
import Guidance from "./pages/Guidance";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetails from "@/pages/admin/AdminUserDetails";
import AdminContent from "./pages/admin/AdminContent";
import AdminCheckIns from "./pages/admin/AdminCheckIns";
import AdminCheckInDetail from "./pages/admin/AdminCheckInDetail";
import AdminMessages from "./pages/admin/AdminMessages";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth */}
          <Route path="/" element={<AuthGate />} />
          <Route path="/login" element={<Login />} />

          {/* Client routes */}
          <Route
            path="/dashboard"
            element={
              <RequireRole allow={["client", "admin"]}>
                <Dashboard />
              </RequireRole>
            }
          />

          <Route
            path="/checkin"
            element={
              <RequireRole allow={["client", "admin"]}>
                <CheckIn />
              </RequireRole>
            }
          />

          <Route
            path="/sheets"
            element={
              <RequireRole allow={["client", "admin"]}>
                <HealingSheets />
              </RequireRole>
            }
          />

          <Route
            path="/protocol"
            element={
              <RequireRole allow={["client", "admin"]}>
                <Protocol />
              </RequireRole>
            }
          />

          <Route
            path="/message"
            element={
              <RequireRole allow={["client", "admin"]}>
                <Message />
              </RequireRole>
            }
          />

          <Route
            path="/guidance/today"
            element={
              <RequireRole allow={["client", "admin"]}>
                <Guidance />
              </RequireRole>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <RequireRole allow={["admin"]}>
                <AdminDashboard />
              </RequireRole>
            }
          />

          <Route
            path="/admin/users"
            element={
              <RequireRole allow={["admin"]}>
                <AdminUsers />
              </RequireRole>
            }
          />

          {/* NEW: Admin User Details */}
          <Route
            path="/admin/users/:id"
            element={
              <RequireRole allow={["admin"]}>
                <AdminUserDetails />
              </RequireRole>
            }
          />

          <Route
            path="/admin/content"
            element={
              <RequireRole allow={["admin"]}>
                <AdminContent />
              </RequireRole>
            }
          />

          <Route
            path="/admin/checkins"
            element={
              <RequireRole allow={["admin"]}>
                <AdminCheckIns />
              </RequireRole>
            }
          />

          {/* Check-in details */}
          <Route
            path="/admin/checkins/:id"
            element={
              <RequireRole allow={["admin"]}>
                <AdminCheckInDetail />
              </RequireRole>
            }
          />

          <Route
            path="/admin/messages"
            element={
              <RequireRole allow={["admin"]}>
                <AdminMessages />
              </RequireRole>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
