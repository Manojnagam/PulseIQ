import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, ProfileInput } from "@/lib/schemas/auth";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/headers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Phone, ShieldCheck, Mail } from "lucide-react";

export function ProfileView() {
  const { user, activeMembership, permissions, updateProfile } = useAuth();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      avatarUrl: user?.avatarUrl || "",
    },
  });

  const onSubmit = async (data: ProfileInput) => {
    try {
      await updateProfile(data.fullName, data.phone, data.avatarUrl);
      addToast({ title: "Profile Updated", type: "success", description: "Your account details have been saved." });
    } catch (err: any) {
      addToast({ title: "Update Failed", type: "error", description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Profile & Security"
        description="Manage your personal profile, contact information, and view assigned permissions."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info Card */}
        <Card className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
              <CardDescription>Update your display name and contact numbers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.avatarUrl} />
                  <AvatarFallback className="text-xl font-bold bg-pulseGreen-500 text-white">
                    {user?.fullName.slice(0, 2).toUpperCase() || "MN"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-base font-bold text-foreground">{user?.fullName}</h3>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <Badge variant="default" className="mt-1">
                    {activeMembership?.roleName || "Supervisor"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input {...register("fullName")} icon={<User className="h-4 w-4" />} error={errors.fullName?.message} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address (Read Only)</label>
                <Input value={user?.email || ""} readOnly icon={<Mail className="h-4 w-4" />} className="bg-muted opacity-80 cursor-not-allowed" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Phone Number</label>
                <Input {...register("phone")} placeholder="+91 98765 43210" icon={<Phone className="h-4 w-4" />} error={errors.phone?.message} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="primary">
                Save Profile Changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Roles & Permissions Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-pulseGreen-500" /> Active Role & Access
              </CardTitle>
              <CardDescription>Role-based access control policies assigned to your membership.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-xl bg-muted/60 text-xs space-y-1">
                <span className="font-semibold text-foreground">Organisation:</span>
                <p className="text-muted-foreground">{activeMembership?.organisationName}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/60 text-xs space-y-1">
                <span className="font-semibold text-foreground">Branch:</span>
                <p className="text-muted-foreground">{activeMembership?.branchName || "All Center Branches"}</p>
              </div>

              <div className="pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Granted Permissions</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {permissions.map((perm) => (
                    <Badge key={perm} variant="secondary" className="text-[10px]">
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
