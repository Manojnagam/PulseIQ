export type RoleId =
  | "platform_admin"
  | "organisation_owner"
  | "centre_manager"
  | "coach"
  | "receptionist"
  | "customer";

export type PermissionId =
  | "org:manage"
  | "branch:manage"
  | "users:invite"
  | "customers:read"
  | "customers:write"
  | "attendance:log"
  | "body:log"
  | "finance:read"
  | "finance:write"
  | "inventory:manage"
  | "ai_diet:generate";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  isPlatformAdmin: boolean;
  createdAt: string;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  status: "active" | "suspended" | "pending";
  createdAt: string;
}

export interface Branch {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  createdAt: string;
}

export interface UserMembership {
  id: string;
  userId: string;
  organisationId: string;
  branchId?: string | null;
  roleId: RoleId;
  status: "active" | "invited" | "disabled";
  organisationName: string;
  branchName?: string;
  roleName: string;
}

export interface AuthState {
  user: UserProfile | null;
  activeMembership: UserMembership | null;
  memberships: UserMembership[];
  organisations: Organisation[];
  branches: Branch[];
  permissions: PermissionId[];
  isLoading: boolean;
  isAuthenticated: boolean;
}
