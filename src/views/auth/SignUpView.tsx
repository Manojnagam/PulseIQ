import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { signUpSchema, SignUpInput } from "@/lib/schemas/auth";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { User, Mail, Building2, Lock, ArrowRight } from "lucide-react";

export function SignUpView() {
  const { signUp, isLoading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpInput) => {
    try {
      await signUp(data.fullName, data.email, data.organisationName, data.password);
      addToast({ title: "Organisation Registered!", type: "success", description: "Your wellness center workspace has been created." });
      navigate("/dashboard");
    } catch (err: any) {
      addToast({ title: "Registration Failed", type: "error", description: err.message || "Could not register account" });
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white overflow-hidden py-12">
      <Spotlight fill="#2563EB" className="-top-40 left-0 md:left-60 md:-top-20" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pulseBlue-500 text-white font-extrabold text-2xl shadow-xl">
            P
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Register Organisation</h1>
          <p className="text-sm text-zinc-400">Set up your multi-tenant wellness center system</p>
        </div>

        <Card className="bg-zinc-900/90 border-zinc-800 shadow-2xl backdrop-blur-md text-white">
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="text-white text-lg font-bold">Organisation & Owner Setup</CardTitle>
              <CardDescription className="text-zinc-400">Owner account gets full administrative permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Full Name</label>
                <Input
                  {...register("fullName")}
                  placeholder="Manoj Nagam"
                  icon={<User className="h-4 w-4" />}
                  error={errors.fullName?.message}
                  className="bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Work Email Address</label>
                <Input
                  {...register("email")}
                  placeholder="owner@wellnesscenter.com"
                  icon={<Mail className="h-4 w-4" />}
                  error={errors.email?.message}
                  className="bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Organisation / Center Name</label>
                <Input
                  {...register("organisationName")}
                  placeholder="PulseZen Wellness Club"
                  icon={<Building2 className="h-4 w-4" />}
                  error={errors.organisationName?.message}
                  className="bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Password</label>
                <Input
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock className="h-4 w-4" />}
                  error={errors.password?.message}
                  className="bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Confirm Password</label>
                <Input
                  {...register("confirmPassword")}
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock className="h-4 w-4" />}
                  error={errors.confirmPassword?.message}
                  className="bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" variant="primary" className="w-full h-11 text-base font-bold bg-pulseBlue-500 hover:bg-pulseBlue-600" isLoading={isLoading}>
                Create Workspace <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-zinc-400">
                Already registered?{" "}
                <Link to="/login" className="text-pulseBlue-400 font-semibold hover:underline">
                  Sign In
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
