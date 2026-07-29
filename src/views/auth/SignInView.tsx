import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { signInSchema, SignInInput } from "@/lib/schemas/auth";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { Mail, Lock, KeyRound, ArrowRight } from "lucide-react";

export function SignInView() {
  const { signIn, isLoading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInInput) => {
    try {
      await signIn(data.email, data.password);
      addToast({ title: "Welcome back!", type: "success", description: "Successfully authenticated session." });
      navigate("/dashboard");
    } catch (err: any) {
      addToast({ title: "Authentication Failed", type: "error", description: err.message || "Invalid credentials" });
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white overflow-hidden">
      <Spotlight fill="#27AE60" className="-top-40 left-0 md:left-60 md:-top-20" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pulseGreen-500 text-white font-extrabold text-2xl shadow-xl">
            P
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Sign in to PulseIQ</h1>
          <p className="text-sm text-zinc-400">Enterprise Wellness Center Management System</p>
        </div>

        <Card className="bg-zinc-900/90 border-zinc-800 shadow-2xl backdrop-blur-md text-white">
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="text-white text-lg font-bold">Welcome Back</CardTitle>
              <CardDescription className="text-zinc-400">Enter your supervisor or staff credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Email Address</label>
                <Input
                  {...register("email")}
                  placeholder="supervisor@pulsezen.in"
                  icon={<Mail className="h-4 w-4" />}
                  error={errors.email?.message}
                  className="bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-zinc-300">Password</label>
                  <Link to="/forgot-password" className="text-pulseGreen-400 hover:underline">Forgot password?</Link>
                </div>
                <Input
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock className="h-4 w-4" />}
                  error={errors.password?.message}
                  className="bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" variant="primary" className="w-full h-11 text-base font-bold" isLoading={isLoading}>
                Sign In <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-zinc-400">
                Don't have an organisation account yet?{" "}
                <Link to="/signup" className="text-pulseGreen-400 font-semibold hover:underline">
                  Create Organisation
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
