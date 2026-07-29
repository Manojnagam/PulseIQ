import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, ChangePasswordInput } from "@/lib/schemas/auth";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/headers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Shield, KeyRound, LogOut } from "lucide-react";

export function AccountSettingsView() {
  const { changePassword, signOut } = useAuth();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordInput) => {
    try {
      await changePassword(data.currentPassword, data.newPassword);
      addToast({ title: "Password Changed", type: "success", description: "Your password has been updated securely." });
      reset();
    } catch (err: any) {
      addToast({ title: "Change Failed", type: "error", description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Settings & Security"
        description="Configure account password, security sessions, and authentication security."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-pulseGreen-500" /> Change Password
              </CardTitle>
              <CardDescription>Ensure your password is at least 8 characters long.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Current Password</label>
                <Input {...register("currentPassword")} type="password" placeholder="••••••••" icon={<KeyRound className="h-4 w-4" />} error={errors.currentPassword?.message} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">New Password</label>
                <Input {...register("newPassword")} type="password" placeholder="••••••••" icon={<Lock className="h-4 w-4" />} error={errors.newPassword?.message} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                <Input {...register("confirmNewPassword")} type="password" placeholder="••••••••" icon={<Lock className="h-4 w-4" />} error={errors.confirmNewPassword?.message} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="primary">
                Update Password
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <LogOut className="h-5 w-5" /> Session Actions
              </CardTitle>
              <CardDescription>Sign out of your active supervisor session across devices.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="danger" className="w-full" onClick={() => signOut()}>
                Sign Out of Workspace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
