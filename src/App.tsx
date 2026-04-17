import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/auth/AuthPage.tsx";
import PassengerSignup from "./pages/auth/PassengerSignup.tsx";
import DriverSignup from "./pages/auth/DriverSignup.tsx";
import ResetPassword from "./pages/auth/ResetPassword.tsx";
import PassengerHome from "./pages/passenger/PassengerHome.tsx";
import PassengerHistory from "./pages/passenger/PassengerHistory.tsx";
import PassengerProfile from "./pages/passenger/PassengerProfile.tsx";
import PassengerChats from "./pages/passenger/PassengerChats.tsx";
import BecomeDriver from "./pages/passenger/BecomeDriver.tsx";
import DriverHome from "./pages/driver/DriverHome.tsx";
import DriverStatusPage from "./pages/driver/DriverStatusPage.tsx";
import DriverWallet from "./pages/driver/DriverWallet.tsx";
import DriverRides from "./pages/driver/DriverRides.tsx";
import DriverProfile from "./pages/driver/DriverProfile.tsx";
import DriverChats from "./pages/driver/DriverChats.tsx";
import AdminChats from "./pages/admin/AdminChats.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminDrivers from "./pages/admin/AdminDrivers.tsx";
import AdminPassengers from "./pages/admin/AdminPassengers.tsx";
import AdminRides from "./pages/admin/AdminRides.tsx";
import AdminFinance from "./pages/admin/AdminFinance.tsx";
import AdminTariffs from "./pages/admin/AdminTariffs.tsx";
import AdminFraud from "./pages/admin/AdminFraud.tsx";
import AdminLive from "./pages/admin/AdminLive.tsx";
import AdminSupport from "./pages/admin/AdminSupport.tsx";
import AdminCampaigns from "./pages/admin/AdminCampaigns.tsx";
import AdminCoupons from "./pages/admin/AdminCoupons.tsx";
import AdminReports from "./pages/admin/AdminReports.tsx";
import AdminAudit from "./pages/admin/AdminAudit.tsx";
import AdminStaff from "./pages/admin/AdminStaff.tsx";
import TestAutocomplete from "./pages/TestAutocomplete.tsx";

const queryClient = new QueryClient();

const AuthLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const ProtectedAdminRoute = ({ children }: { children: JSX.Element }) => {
  const { user, roles, loading } = useAuth();
  if (loading || (user && roles.length === 0)) return <AuthLoading />;
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes("admin") && !roles.includes("master")) return <Navigate to="/" replace />;
  return children;
};

const ProtectedPassengerRoute = ({ children }: { children: JSX.Element }) => {
  const { user, roles, loading } = useAuth();
  if (loading || (user && roles.length === 0)) return <AuthLoading />;
  if (!user) return <Navigate to="/auth" replace />;
  // Admin/master também podem acessar para suporte; senão precisa ser passenger ou driver (driver-passageiro também usa o app)
  if (!roles.includes("passenger") && !roles.includes("driver") && !roles.includes("admin") && !roles.includes("master")) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

const ProtectedDriverRoute = ({ children }: { children: JSX.Element }) => {
  const { user, roles, loading } = useAuth();
  if (loading || (user && roles.length === 0)) return <AuthLoading />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!roles.includes("driver") && !roles.includes("admin") && !roles.includes("master")) {
    return <Navigate to="/passenger" replace />;
  }
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AdminLogin />} />
            <Route path="/landing" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/passenger" element={<PassengerSignup />} />
            <Route path="/auth/driver" element={<DriverSignup />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/passenger" element={<ProtectedPassengerRoute><PassengerHome /></ProtectedPassengerRoute>} />
            <Route path="/passenger/history" element={<ProtectedPassengerRoute><PassengerHistory /></ProtectedPassengerRoute>} />
            <Route path="/passenger/profile" element={<ProtectedPassengerRoute><PassengerProfile /></ProtectedPassengerRoute>} />
            <Route path="/passenger/chats" element={<ProtectedPassengerRoute><PassengerChats /></ProtectedPassengerRoute>} />
            <Route path="/passenger/become-driver" element={<ProtectedPassengerRoute><BecomeDriver /></ProtectedPassengerRoute>} />
            <Route path="/driver" element={<ProtectedDriverRoute><DriverHome /></ProtectedDriverRoute>} />
            <Route path="/driver/status" element={<ProtectedDriverRoute><DriverStatusPage /></ProtectedDriverRoute>} />
            <Route path="/driver/wallet" element={<ProtectedDriverRoute><DriverWallet /></ProtectedDriverRoute>} />
            <Route path="/driver/rides" element={<ProtectedDriverRoute><DriverRides /></ProtectedDriverRoute>} />
            <Route path="/driver/profile" element={<ProtectedDriverRoute><DriverProfile /></ProtectedDriverRoute>} />
            <Route path="/driver/chats" element={<ProtectedDriverRoute><DriverChats /></ProtectedDriverRoute>} />
            <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
            <Route path="/admin/chats" element={<ProtectedAdminRoute><AdminChats /></ProtectedAdminRoute>} />
            <Route path="/admin/drivers" element={<ProtectedAdminRoute><AdminDrivers /></ProtectedAdminRoute>} />
            <Route path="/admin/passengers" element={<ProtectedAdminRoute><AdminPassengers /></ProtectedAdminRoute>} />
            <Route path="/admin/rides" element={<ProtectedAdminRoute><AdminRides /></ProtectedAdminRoute>} />
            <Route path="/admin/finance" element={<ProtectedAdminRoute><AdminFinance /></ProtectedAdminRoute>} />
            <Route path="/admin/tariffs" element={<ProtectedAdminRoute><AdminTariffs /></ProtectedAdminRoute>} />
            <Route path="/admin/fraud" element={<ProtectedAdminRoute><AdminFraud /></ProtectedAdminRoute>} />
            <Route path="/admin/live" element={<ProtectedAdminRoute><AdminLive /></ProtectedAdminRoute>} />
            <Route path="/admin/support" element={<ProtectedAdminRoute><AdminSupport /></ProtectedAdminRoute>} />
            <Route path="/admin/campaigns" element={<ProtectedAdminRoute><AdminCampaigns /></ProtectedAdminRoute>} />
            <Route path="/admin/coupons" element={<ProtectedAdminRoute><AdminCoupons /></ProtectedAdminRoute>} />
            <Route path="/admin/reports" element={<ProtectedAdminRoute><AdminReports /></ProtectedAdminRoute>} />
            <Route path="/admin/audit" element={<ProtectedAdminRoute><AdminAudit /></ProtectedAdminRoute>} />
            <Route path="/admin/staff" element={<ProtectedAdminRoute><AdminStaff /></ProtectedAdminRoute>} />
            <Route path="/test-autocomplete" element={<TestAutocomplete />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
