import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema, createOrganisationSchema } from "../lib/schemas/auth";
import { ROLE_PERMISSIONS } from "../lib/supabase";
import { PermissionId, RoleId } from "../types/auth";

describe("Phase 1: Zod Authentication Schema Validation", () => {
  it("should validate valid sign-in inputs", () => {
    const valid = signInSchema.safeParse({
      email: "supervisor@pulsezen.in",
      password: "password123",
    });
    expect(valid.success).toBe(true);
  });

  it("should reject invalid email formats", () => {
    const invalid = signInSchema.safeParse({
      email: "invalid-email-string",
      password: "password123",
    });
    expect(invalid.success).toBe(false);
  });

  it("should enforce password match on sign up", () => {
    const mismatch = signUpSchema.safeParse({
      fullName: "Manoj Nagam",
      email: "owner@pulsezen.in",
      organisationName: "PulseZen Org",
      password: "password123",
      confirmPassword: "differentPassword",
    });
    expect(mismatch.success).toBe(false);
  });
});

describe("Phase 1: Role-Based Access Control (RBAC) Verification", () => {
  const checkPermission = (role: RoleId, permission: PermissionId): boolean => {
    return ROLE_PERMISSIONS[role].includes(permission);
  };

  it("should grant Platform Admin and Org Owner organisation management permissions", () => {
    expect(checkPermission("platform_admin", "org:manage")).toBe(true);
    expect(checkPermission("organisation_owner", "org:manage")).toBe(true);
    expect(checkPermission("coach", "org:manage")).toBe(false);
    expect(checkPermission("receptionist", "org:manage")).toBe(false);
  });

  it("should grant Coach and Centre Manager body composition logging permissions", () => {
    expect(checkPermission("centre_manager", "body:log")).toBe(true);
    expect(checkPermission("coach", "body:log")).toBe(true);
    expect(checkPermission("receptionist", "body:log")).toBe(false);
  });

  it("should restrict financial write access to receptionists, managers, and owners", () => {
    expect(checkPermission("organisation_owner", "finance:write")).toBe(true);
    expect(checkPermission("receptionist", "finance:write")).toBe(true);
    expect(checkPermission("coach", "finance:write")).toBe(false);
  });
});
