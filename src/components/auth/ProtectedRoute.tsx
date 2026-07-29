import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { RoleId, PermissionId } from "@/types/auth";
import { LoadingScreen } from "@/components/ui/loading-screen";

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Verifying security credentials..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export interface RoleGuardProps {
  children: React.ReactNode;
  roles?: RoleId[];
  permission?: PermissionId;
}

export function RoleGuard({ children, roles, permission }: RoleGuardProps) {
  const { hasRole, hasPermission } = useAuth();

  if (roles && !hasRole(roles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
