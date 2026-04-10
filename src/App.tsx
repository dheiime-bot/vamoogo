import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/auth/AuthPage.tsx";
import PassengerHome from "./pages/passenger/PassengerHome.tsx";
import PassengerHistory from "./pages/passenger/PassengerHistory.tsx";
import PassengerProfile from "./pages/passenger/PassengerProfile.tsx";
import DriverHome from "./pages/driver/DriverHome.tsx";
import DriverWallet from "./pages/driver/DriverWallet.tsx";
import DriverRides from "./pages/driver/DriverRides.tsx";
import DriverProfile from "./pages/driver/DriverProfile.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminDrivers from "./pages/admin/AdminDrivers.tsx";
import AdminPassengers from "./pages/admin/AdminPassengers.tsx";
import AdminRides from "./pages/admin/AdminRides.tsx";
import AdminFinance from "./pages/admin/AdminFinance.tsx";
import AdminTariffs from "./pages/admin/AdminTariffs.tsx";
import AdminFraud from "./pages/admin/AdminFraud.tsx";
import AdminLive from "./pages/admin/AdminLive.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          {/* Passenger */}
          <Route path="/passenger" element={<PassengerHome />} />
          <Route path="/passenger/history" element={<PassengerHistory />} />
          <Route path="/passenger/profile" element={<PassengerProfile />} />
          {/* Driver */}
          <Route path="/driver" element={<DriverHome />} />
          <Route path="/driver/wallet" element={<DriverWallet />} />
          <Route path="/driver/rides" element={<DriverRides />} />
          <Route path="/driver/profile" element={<DriverProfile />} />
          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/drivers" element={<AdminDrivers />} />
          <Route path="/admin/passengers" element={<AdminPassengers />} />
          <Route path="/admin/rides" element={<AdminRides />} />
          <Route path="/admin/finance" element={<AdminFinance />} />
          <Route path="/admin/tariffs" element={<AdminTariffs />} />
          <Route path="/admin/fraud" element={<AdminFraud />} />
          <Route path="/admin/live" element={<AdminLive />} />
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
