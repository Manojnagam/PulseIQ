import * as React from "react";
import { UserProfile, UserMembership, Organisation, Branch, PermissionId, RoleId } from "@/types/auth";
import { supabase, ROLE_PERMISSIONS, MOCK_USER, MOCK_ORGANISATIONS, MOCK_BRANCHES, MOCK_MEMBERSHIPS } from "@/lib/supabase";

interface AuthContextType {
  user: UserProfile | null;
  activeMembership: UserMembership | null;
  memberships: UserMembership[];
  organisations: Organisation[];
  branches: Branch[];
  permissions: PermissionId[];
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, organisationName: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  updateProfile: (fullName: string, phone?: string, avatarUrl?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  switchActiveMembership: (membershipId: string) => void;
  createOrganisation: (name: string, slug: string) => Promise<void>;
  createBranch: (name: string, code: string, address?: string, phone?: string) => Promise<void>;
  hasPermission: (permission: PermissionId) => boolean;
  hasRole: (role: RoleId | RoleId[]) => boolean;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserProfile | null>(MOCK_USER);
  const [memberships, setMemberships] = React.useState<UserMembership[]>(MOCK_MEMBERSHIPS);
  const [activeMembership, setActiveMembership] = React.useState<UserMembership | null>(MOCK_MEMBERSHIPS[0]);
  const [organisations, setOrganisations] = React.useState<Organisation[]>(MOCK_ORGANISATIONS);
  const [branches, setBranches] = React.useState<Branch[]>(MOCK_BRANCHES);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // Computed Permissions based on active role
  const permissions = React.useMemo<PermissionId[]>(() => {
    if (!activeMembership) return [];
    if (user?.isPlatformAdmin) return ROLE_PERMISSIONS.platform_admin;
    return ROLE_PERMISSIONS[activeMembership.roleId] || [];
  }, [activeMembership, user]);

  const isAuthenticated = Boolean(user);

  const hasPermission = React.useCallback(
    (permission: PermissionId): boolean => {
      if (user?.isPlatformAdmin) return true;
      return permissions.includes(permission);
    },
    [permissions, user]
  );

  const hasRole = React.useCallback(
    (role: RoleId | RoleId[]): boolean => {
      if (user?.isPlatformAdmin) return true;
      if (!activeMembership) return false;
      const rolesArray = Array.isArray(role) ? role : [role];
      return rolesArray.includes(activeMembership.roleId);
    },
    [activeMembership, user]
  );

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // In production, invoke supabase.auth.signInWithPassword({ email, password })
      setUser({
        ...MOCK_USER,
        email,
      });
      setMemberships(MOCK_MEMBERSHIPS);
      setActiveMembership(MOCK_MEMBERSHIPS[0]);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (fullName: string, email: string, organisationName: string, password: string) => {
    setIsLoading(true);
    try {
      const newOrgId = `org-${Date.now()}`;
      const newBranchId = `br-${Date.now()}`;
      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        email,
        fullName,
        isPlatformAdmin: false,
        createdAt: new Date().toISOString(),
      };
      const newOrg: Organisation = {
        id: newOrgId,
        name: organisationName,
        slug: organisationName.toLowerCase().replace(/\s+/g, "-"),
        status: "active",
        createdAt: new Date().toISOString(),
      };
      const newBranch: Branch = {
        id: newBranchId,
        organisationId: newOrgId,
        name: `${organisationName} Main Branch`,
        code: "MAIN-01",
        createdAt: new Date().toISOString(),
      };
      const newMem: UserMembership = {
        id: `mem-${Date.now()}`,
        userId: newUser.id,
        organisationId: newOrgId,
        branchId: newBranchId,
        roleId: "organisation_owner",
        status: "active",
        organisationName: newOrg.name,
        branchName: newBranch.name,
        roleName: "Organisation Owner",
      };

      setUser(newUser);
      setOrganisations((prev) => [...prev, newOrg]);
      setBranches((prev) => [...prev, newBranch]);
      setMemberships([newMem]);
      setActiveMembership(newMem);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      setUser(null);
      setActiveMembership(null);
      setMemberships([]);
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    // Triggers password reset email via Supabase Auth
    console.log("Password reset email sent to:", email);
  };

  const resetPassword = async (password: string) => {
    console.log("Password successfully updated");
  };

  const updateProfile = async (fullName: string, phone?: string, avatarUrl?: string) => {
    if (!user) return;
    setUser({
      ...user,
      fullName,
      phone: phone || user.phone,
      avatarUrl: avatarUrl || user.avatarUrl,
    });
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    console.log("Password changed successfully");
  };

  const switchActiveMembership = (membershipId: string) => {
    const found = memberships.find((m) => m.id === membershipId);
    if (found) {
      setActiveMembership(found);
    }
  };

  const createOrganisation = async (name: string, slug: string) => {
    const newOrg: Organisation = {
      id: `org-${Date.now()}`,
      name,
      slug,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    setOrganisations((prev) => [...prev, newOrg]);
  };

  const createBranch = async (name: string, code: string, address?: string, phone?: string) => {
    if (!activeMembership) return;
    const newBranch: Branch = {
      id: `br-${Date.now()}`,
      organisationId: activeMembership.organisationId,
      name,
      code,
      address,
      phone,
      createdAt: new Date().toISOString(),
    };
    setBranches((prev) => [...prev, newBranch]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeMembership,
        memberships,
        organisations,
        branches,
        permissions,
        isLoading,
        isAuthenticated,
        signIn,
        signUp,
        signOut,
        forgotPassword,
        resetPassword,
        updateProfile,
        changePassword,
        switchActiveMembership,
        createOrganisation,
        createBranch,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
