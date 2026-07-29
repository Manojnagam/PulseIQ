import * as React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute, RoleGuard } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { DynamicSidebar } from "@/components/layout/DynamicSidebar";
import { ToastProvider } from "@/components/ui/toast";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { SignInView } from "@/views/auth/SignInView";
import { SignUpView } from "@/views/auth/SignUpView";
import { ForgotPasswordView } from "@/views/auth/ForgotPasswordView";

// Lazy-loaded Authenticated Routes (Optimizes bundle splitting)
const ProfileView = React.lazy(() => import("@/views/user/ProfileView").then(m => ({ default: m.ProfileView })));
const AccountSettingsView = React.lazy(() => import("@/views/user/AccountSettingsView").then(m => ({ default: m.AccountSettingsView })));
const TenantsView = React.lazy(() => import("@/views/user/TenantsView").then(m => ({ default: m.TenantsView })));
const UnauthorizedView = React.lazy(() => import("@/views/user/UnauthorizedView").then(m => ({ default: m.UnauthorizedView })));

// Authenticated Shell Component
function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeMembership } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <DynamicSidebar
        activeTab={location.pathname}
        onTabChange={(path) => navigate(path)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full">
        <React.Suspense fallback={<LoadingScreen message="Loading workspace view..." />}>
          {children}
        </React.Suspense>
      </main>
    </div>
  );
}

// Overview Landing View
function OverviewDashboard() {
  const { user, activeMembership } = useAuth();
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-zinc-950 p-8 text-white border border-zinc-800 shadow-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Welcome, {user?.fullName}!</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Active Organisation: <span className="text-pulseGreen-400 font-semibold">{activeMembership?.organisationName}</span> ({activeMembership?.roleName})
        </p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Unauthenticated Routes */}
            <Route path="/login" element={<SignInView />} />
            <Route path="/signup" element={<SignUpView />} />
            <Route path="/forgot-password" element={<ForgotPasswordView />} />

            {/* Protected Authenticated Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AuthenticatedShell>
                    <OverviewDashboard />
                  </AuthenticatedShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AuthenticatedShell>
                    <ProfileView />
                  </AuthenticatedShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings/account"
              element={
                <ProtectedRoute>
                  <AuthenticatedShell>
                    <AccountSettingsView />
                  </AuthenticatedShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings/organization"
              element={
                <ProtectedRoute>
                  <RoleGuard permission="org:manage">
                    <AuthenticatedShell>
                      <TenantsView />
                    </AuthenticatedShell>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/unauthorized"
              element={
                <ProtectedRoute>
                  <AuthenticatedShell>
                    <UnauthorizedView />
                  </AuthenticatedShell>
                </ProtectedRoute>
              }
            />

            {/* Fallback Redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
