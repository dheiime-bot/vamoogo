import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useKeyboardAwareScroll } from "@/hooks/useKeyboardAwareScroll";
import { useRealtimeReconnect } from "@/hooks/useRealtimeReconnect";
import { useDevicePermissions } from "@/hooks/useDevicePermissions";
import GpsPermissionGate from "@/components/driver/GpsPermissionGate";
import RouteErrorBoundary from "@/components/shared/RouteErrorBoundary";

// Eager: rota inicial — precisa pintar o mais rápido possível
import AdminLogin from "./pages/AdminLogin.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy: tudo o que não é a tela de entrada. Quebra o bundle em ~30 chunks
// pequenos e reduz drasticamente o JS baixado no primeiro carregamento.
const Index = lazy(() => import("./pages/Index.tsx"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage.tsx"));
const PassengerLogin = lazy(() => import("./pages/auth/PassengerLogin.tsx"));
const DriverLogin = lazy(() => import("./pages/auth/DriverLogin.tsx"));
const PassengerSignup = lazy(() => import("./pages/auth/PassengerSignup.tsx"));
const DriverSignup = lazy(() => import("./pages/auth/DriverSignup.tsx"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword.tsx"));

const PassengerHome = lazy(() => import("./pages/passenger/PassengerHome.tsx"));
const PassengerHistory = lazy(() => import("./pages/passenger/PassengerHistory.tsx"));
const PassengerProfile = lazy(() => import("./pages/passenger/PassengerProfile.tsx"));
const PassengerChats = lazy(() => import("./pages/passenger/PassengerChats.tsx"));
const PassengerCoupons = lazy(() => import("./pages/passenger/PassengerCoupons.tsx"));
const PassengerFavoriteDrivers = lazy(() => import("./pages/passenger/PassengerFavoriteDrivers.tsx"));
const PassengerChangePassword = lazy(() => import("./pages/passenger/PassengerChangePassword.tsx"));
const PassengerSettings = lazy(() => import("./pages/passenger/PassengerSettings.tsx"));
const BecomeDriver = lazy(() => import("./pages/passenger/BecomeDriver.tsx"));

const DriverHome = lazy(() => import("./pages/driver/DriverHome.tsx"));
const DriverStatusPage = lazy(() => import("./pages/driver/DriverStatusPage.tsx"));
const DriverWallet = lazy(() => import("./pages/driver/DriverWallet.tsx"));
const DriverRides = lazy(() => import("./pages/driver/DriverRides.tsx"));
const DriverOffers = lazy(() => import("./pages/driver/DriverOffers.tsx"));
const DriverProfile = lazy(() => import("./pages/driver/DriverProfile.tsx"));
const DriverChats = lazy(() => import("./pages/driver/DriverChats.tsx"));
const DriverVehicles = lazy(() => import("./pages/driver/DriverVehicles.tsx"));
const DriverVehicleChangeRequest = lazy(() => import("./pages/driver/DriverVehicleChangeRequest.tsx"));

const AdminChats = lazy(() => import("./pages/admin/AdminChats.tsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers.tsx"));
const AdminPassengers = lazy(() => import("./pages/admin/AdminPassengers.tsx"));
const AdminRides = lazy(() => import("./pages/admin/AdminRides.tsx"));
const AdminAppeals = lazy(() => import("./pages/admin/AdminAppeals.tsx"));
const AdminCancellations = lazy(() => import("./pages/admin/AdminCancellations.tsx"));
const AdminCancellationRules = lazy(() => import("./pages/admin/AdminCancellationRules.tsx"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance.tsx"));
const AdminTariffs = lazy(() => import("./pages/admin/AdminTariffs.tsx"));
const AdminFraud = lazy(() => import("./pages/admin/AdminFraud.tsx"));
const AdminLive = lazy(() => import("./pages/admin/AdminLive.tsx"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport.tsx"));
const AdminCampaigns = lazy(() => import("./pages/admin/AdminCampaigns.tsx"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons.tsx"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports.tsx"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit.tsx"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff.tsx"));
const AdminVehicleRequests = lazy(() => import("./pages/admin/AdminVehicleRequests.tsx"));
const AdminVehicles = lazy(() => import("./pages/admin/AdminVehicles.tsx"));
const AdminWalletTopup = lazy(() => import("./pages/admin/AdminWalletTopup.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduz refetch desnecessário: 30s de fresh, 5min cache
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
  if (!user) return <Navigate to="/auth/passenger/login" replace />;
  if (!roles.includes("passenger") && !roles.includes("driver") && !roles.includes("admin") && !roles.includes("master")) {
    return <Navigate to="/auth/passenger/login" replace />;
  }
  return children;
};

const ProtectedDriverRoute = ({ children }: { children: JSX.Element }) => {
  const { user, roles, loading } = useAuth();
  if (loading || (user && roles.length === 0)) return <AuthLoading />;
  if (!user) return <Navigate to="/auth/driver/login" replace />;
  if (!roles.includes("driver") && !roles.includes("admin") && !roles.includes("master")) {
    return <Navigate to="/auth/driver/login" replace />;
  }
  // Bloqueia toda a área do motorista até a permissão de GPS ser concedida.
  return <GpsPermissionGate>{children}</GpsPermissionGate>;
};

/**
 * Hook global: empurra inputs/textareas focados para acima do teclado virtual no mobile,
 * evitando que o teclado cubra o campo que está sendo preenchido.
 */
const KeyboardAwareScroll = () => {
  useKeyboardAwareScroll();
  return null;
};

/**
 * Garante que o realtime se reconecte automaticamente quando a aba volta a ficar
 * visível, ganha foco ou a internet retorna — assim nenhuma ação do admin/banco
 * fica "presa" no servidor sem chegar ao app.
 */
const RealtimeReconnect = () => {
  useRealtimeReconnect();
  return null;
};

/**
 * Solicita permissões do dispositivo (localização + câmera) na primeira
 * carga da sessão para evitar bloqueios em fluxos de motorista/passageiro.
 */
const DevicePermissionsBootstrap = () => {
  useDevicePermissions();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <KeyboardAwareScroll />
          <RealtimeReconnect />
          <DevicePermissionsBootstrap />
          <RouteErrorBoundary>
            <Suspense fallback={<AuthLoading />}>
              <Routes>
                <Route path="/" element={<AdminLogin />} />
                <Route path="/landing" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/passenger/login" element={<PassengerLogin />} />
                <Route path="/auth/driver/login" element={<DriverLogin />} />
                <Route path="/auth/passenger" element={<PassengerSignup />} />
                <Route path="/auth/driver" element={<DriverSignup />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route path="/passenger" element={<ProtectedPassengerRoute><PassengerHome /></ProtectedPassengerRoute>} />
                <Route path="/passenger/history" element={<ProtectedPassengerRoute><PassengerHistory /></ProtectedPassengerRoute>} />
                <Route path="/passenger/profile" element={<ProtectedPassengerRoute><PassengerProfile /></ProtectedPassengerRoute>} />
                <Route path="/passenger/chats" element={<ProtectedPassengerRoute><PassengerChats /></ProtectedPassengerRoute>} />
                <Route path="/passenger/coupons" element={<ProtectedPassengerRoute><PassengerCoupons /></ProtectedPassengerRoute>} />
                <Route path="/passenger/favorites" element={<ProtectedPassengerRoute><PassengerFavoriteDrivers /></ProtectedPassengerRoute>} />
                <Route path="/passenger/change-password" element={<ProtectedPassengerRoute><PassengerChangePassword /></ProtectedPassengerRoute>} />
                <Route path="/passenger/settings" element={<ProtectedPassengerRoute><PassengerSettings /></ProtectedPassengerRoute>} />
                <Route path="/passenger/become-driver" element={<ProtectedPassengerRoute><BecomeDriver /></ProtectedPassengerRoute>} />
                <Route path="/driver" element={<ProtectedDriverRoute><DriverHome /></ProtectedDriverRoute>} />
                <Route path="/driver/status" element={<ProtectedDriverRoute><DriverStatusPage /></ProtectedDriverRoute>} />
                <Route path="/driver/wallet" element={<ProtectedDriverRoute><DriverWallet /></ProtectedDriverRoute>} />
                <Route path="/driver/rides" element={<ProtectedDriverRoute><DriverRides /></ProtectedDriverRoute>} />
                <Route path="/driver/ratings" element={<Navigate to="/driver/profile" replace />} />
                <Route path="/driver/offers" element={<ProtectedDriverRoute><DriverOffers /></ProtectedDriverRoute>} />
                <Route path="/driver/profile" element={<ProtectedDriverRoute><DriverProfile /></ProtectedDriverRoute>} />
                <Route path="/driver/chats" element={<ProtectedDriverRoute><DriverChats /></ProtectedDriverRoute>} />
                <Route path="/driver/vehicles" element={<ProtectedDriverRoute><DriverVehicles /></ProtectedDriverRoute>} />
                <Route path="/driver/vehicles/request" element={<ProtectedDriverRoute><DriverVehicleChangeRequest /></ProtectedDriverRoute>} />
                <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
                <Route path="/admin/chats" element={<ProtectedAdminRoute><AdminChats /></ProtectedAdminRoute>} />
                <Route path="/admin/drivers" element={<ProtectedAdminRoute><AdminDrivers /></ProtectedAdminRoute>} />
                <Route path="/admin/passengers" element={<ProtectedAdminRoute><AdminPassengers /></ProtectedAdminRoute>} />
                <Route path="/admin/rides" element={<ProtectedAdminRoute><AdminRides /></ProtectedAdminRoute>} />
                <Route path="/admin/appeals" element={<ProtectedAdminRoute><AdminAppeals /></ProtectedAdminRoute>} />
                <Route path="/admin/cancellations" element={<ProtectedAdminRoute><AdminCancellations /></ProtectedAdminRoute>} />
                <Route path="/admin/settings/cancellations" element={<ProtectedAdminRoute><AdminCancellationRules /></ProtectedAdminRoute>} />
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
                <Route path="/admin/vehicle-requests" element={<ProtectedAdminRoute><AdminVehicleRequests /></ProtectedAdminRoute>} />
                <Route path="/admin/vehicles" element={<ProtectedAdminRoute><AdminVehicles /></ProtectedAdminRoute>} />
                <Route path="/admin/wallet-topup" element={<ProtectedAdminRoute><AdminWalletTopup /></ProtectedAdminRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
