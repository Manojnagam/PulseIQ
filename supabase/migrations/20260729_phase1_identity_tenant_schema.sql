-- PulseIQ Phase 1: Identity, Authentication, and Multi-Tenant Foundation Schema
-- PostgreSQL + Supabase Row Level Security (RLS)

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Roles
INSERT INTO public.roles (id, name, description, is_system) VALUES
('platform_admin', 'Platform Administrator', 'Full system-wide administrative access', true),
('organisation_owner', 'Organisation Owner', 'Full control over wellness organization and all branches', true),
('centre_manager', 'Centre Manager', 'Manages specific wellness center branch operations', true),
('coach', 'Health Coach', 'Manages assigned clients, diet plans, and check-ins', true),
('receptionist', 'Receptionist', 'Logs daily customer check-ins and payments', true),
('customer', 'Customer Client', 'Self-service access to own progress and diet plans', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Permissions Table
CREATE TABLE IF NOT EXISTS public.permissions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Granular Permissions
INSERT INTO public.permissions (id, name, category) VALUES
('org:manage', 'Manage Organisation Settings', 'organisation'),
('branch:manage', 'Manage Branches', 'branch'),
('users:invite', 'Invite & Manage Staff', 'users'),
('customers:read', 'View Customer Directory', 'customers'),
('customers:write', 'Create & Edit Customers', 'customers'),
('attendance:log', 'Log Customer Check-ins', 'attendance'),
('body:log', 'Log Body Composition', 'health'),
('finance:read', 'View Financial Dashboards', 'finance'),
('finance:write', 'Log Payments & Expenses', 'finance'),
('inventory:manage', 'Manage Inventory Stock', 'inventory'),
('ai_diet:generate', 'Generate AI Diet Plans', 'ai')
ON CONFLICT (id) DO NOTHING;

-- 3. Create Role Permissions Mapping Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id TEXT REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Seed Default Role-Permission Mappings
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
('organisation_owner', 'org:manage'), ('organisation_owner', 'branch:manage'), ('organisation_owner', 'users:invite'),
('organisation_owner', 'customers:read'), ('organisation_owner', 'customers:write'), ('organisation_owner', 'finance:read'), ('organisation_owner', 'finance:write'), ('organisation_owner', 'ai_diet:generate'),
('centre_manager', 'branch:manage'), ('centre_manager', 'users:invite'), ('centre_manager', 'customers:read'), ('centre_manager', 'customers:write'), ('centre_manager', 'attendance:log'), ('centre_manager', 'body:log'), ('centre_manager', 'finance:read'), ('centre_manager', 'inventory:manage'), ('centre_manager', 'ai_diet:generate'),
('coach', 'customers:read'), ('coach', 'customers:write'), ('coach', 'attendance:log'), ('coach', 'body:log'), ('coach', 'ai_diet:generate'),
('receptionist', 'customers:read'), ('receptionist', 'attendance:log'), ('receptionist', 'finance:write')
ON CONFLICT DO NOTHING;

-- 4. Create Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    is_platform_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Organisations Table (Wellness Centers)
CREATE TABLE IF NOT EXISTS public.organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create Branches Table (Specific Locations / Centers)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    pin_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (organisation_id, code)
);

-- 7. Create User Memberships Table (User -> Organisation -> Branch -> Role)
CREATE TABLE IF NOT EXISTS public.user_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE, -- NULL means Organisation-wide access
    role_id TEXT REFERENCES public.roles(id) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, organisation_id, branch_id, role_id)
);

-- 8. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Members of same organisation can view co-member profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_memberships m1
            JOIN public.user_memberships m2 ON m1.organisation_id = m2.organisation_id
            WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
        )
    );

-- Organisations Policies
CREATE POLICY "Users can view organisations they belong to"
    ON public.organisations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_memberships
            WHERE user_memberships.organisation_id = public.organisations.id
            AND user_memberships.user_id = auth.uid()
            AND user_memberships.status = 'active'
        )
    );

CREATE POLICY "Organisation owners can update organisation info"
    ON public.organisations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_memberships
            WHERE user_memberships.organisation_id = public.organisations.id
            AND user_memberships.user_id = auth.uid()
            AND user_memberships.role_id IN ('organisation_owner', 'platform_admin')
        )
    );

-- Branches Policies
CREATE POLICY "Users can view branches in their organisation"
    ON public.branches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_memberships
            WHERE user_memberships.organisation_id = public.branches.organisation_id
            AND user_memberships.user_id = auth.uid()
            AND (user_memberships.branch_id IS NULL OR user_memberships.branch_id = public.branches.id)
        )
    );

-- User Memberships Policies
CREATE POLICY "Users can view their own memberships"
    ON public.user_memberships FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Organisation owners and managers can manage memberships"
    ON public.user_memberships FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_memberships m
            WHERE m.organisation_id = public.user_memberships.organisation_id
            AND m.user_id = auth.uid()
            AND m.role_id IN ('organisation_owner', 'centre_manager', 'platform_admin')
        )
    );

-- Audit Logs Policies
CREATE POLICY "Organisation owners can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_memberships
            WHERE user_memberships.organisation_id = public.audit_logs.organisation_id
            AND user_memberships.user_id = auth.uid()
            AND user_memberships.role_id IN ('organisation_owner', 'platform_admin')
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
