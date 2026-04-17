import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/auth/AuthPage.tsx";
import PassengerHome from "./pages/passenger/PassengerHome.tsx";
import PassengerHistory from "./pages/passenger/PassengerHistory.tsx";
import PassengerProfile from "./pages/passenger/PassengerProfile.tsx";
import PassengerChats from "./pages/passenger/PassengerChats.tsx";
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
import TestAutocomplete from "./pages/TestAutocomplete.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/passenger" element={<PassengerHome />} />
            <Route path="/passenger/history" element={<PassengerHistory />} />
            <Route path="/passenger/profile" element={<PassengerProfile />} />
            <Route path="/passenger/chats" element={<PassengerChats />} />
            <Route path="/driver" element={<DriverHome />} />
            <Route path="/driver/status" element={<DriverStatusPage />} />
            <Route path="/driver/wallet" element={<DriverWallet />} />
            <Route path="/driver/rides" element={<DriverRides />} />
            <Route path="/driver/profile" element={<DriverProfile />} />
            <Route path="/driver/chats" element={<DriverChats />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/chats" element={<AdminChats />} />
            <Route path="/admin/drivers" element={<AdminDrivers />} />
            <Route path="/admin/passengers" element={<AdminPassengers />} />
            <Route path="/admin/rides" element={<AdminRides />} />
            <Route path="/admin/finance" element={<AdminFinance />} />
            <Route path="/admin/tariffs" element={<AdminTariffs />} />
            <Route path="/admin/fraud" element={<AdminFraud />} />
            <Route path="/admin/live" element={<AdminLive />} />
            <Route path="/admin/support" element={<AdminSupport />} />
            <Route path="/admin/campaigns" element={<AdminCampaigns />} />
            <Route path="/admin/coupons" element={<AdminCoupons />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/test-autocomplete" element={<TestAutocomplete />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
