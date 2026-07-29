import { createClient } from "@supabase/supabase-js";
import { UserProfile, UserMembership, Organisation, Branch, PermissionId, RoleId } from "@/types/auth";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mock-pulseiq.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "mock-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Role Permission Map for Client-Side RBAC Verification
export const ROLE_PERMISSIONS: Record<RoleId, PermissionId[]> = {
  platform_admin: [
    "org:manage", "branch:manage", "users:invite",
    "customers:read", "customers:write",
    "attendance:log", "body:log",
    "finance:read", "finance:write",
    "inventory:manage", "ai_diet:generate"
  ],
  organisation_owner: [
    "org:manage", "branch:manage", "users:invite",
    "customers:read", "customers:write",
    "attendance:log", "body:log",
    "finance:read", "finance:write",
    "ai_diet:generate"
  ],
  centre_manager: [
    "branch:manage", "users:invite",
    "customers:read", "customers:write",
    "attendance:log", "body:log",
    "finance:read", "inventory:manage",
    "ai_diet:generate"
  ],
  coach: [
    "customers:read", "customers:write",
    "attendance:log", "body:log",
    "ai_diet:generate"
  ],
  receptionist: [
    "customers:read", "attendance:log",
    "finance:write"
  ],
  customer: [
    "customers:read"
  ]
};

// Default Mock Data for Verification & Local Testing
export const MOCK_USER: UserProfile = {
  id: "usr-001",
  email: "supervisor@pulsezen.in",
  fullName: "Manoj Nagam",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  phone: "+91 98765 43210",
  isPlatformAdmin: true,
  createdAt: new Date().toISOString(),
};

export const MOCK_ORGANISATIONS: Organisation[] = [
  { id: "org-001", name: "PulseZen Wellness Org", slug: "pulsezen-main", status: "active", createdAt: new Date().toISOString() },
  { id: "org-002", name: "Apex Health Club", slug: "apex-health", status: "active", createdAt: new Date().toISOString() },
];

export const MOCK_BRANCHES: Branch[] = [
  { id: "br-001", organisationId: "org-001", name: "Main Flagship Center", code: "MAIN-01", address: "Banjara Hills, Hyderabad", phone: "+91 40 12345678", createdAt: new Date().toISOString() },
  { id: "br-002", organisationId: "org-001", name: "Gachibowli Branch", code: "GCB-02", address: "Gachibowli, Hyderabad", phone: "+91 40 87654321", createdAt: new Date().toISOString() },
];

export const MOCK_MEMBERSHIPS: UserMembership[] = [
  {
    id: "mem-001",
    userId: "usr-001",
    organisationId: "org-001",
    branchId: "br-001",
    roleId: "organisation_owner",
    status: "active",
    organisationName: "PulseZen Wellness Org",
    branchName: "Main Flagship Center",
    roleName: "Organisation Owner",
  },
  {
    id: "mem-002",
    userId: "usr-001",
    organisationId: "org-001",
    branchId: "br-002",
    roleId: "centre_manager",
    status: "active",
    organisationName: "PulseZen Wellness Org",
    branchName: "Gachibowli Branch",
    roleName: "Centre Manager",
  },
];
