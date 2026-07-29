import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { forgotPasswordSchema, ForgotPasswordInput } from "@/lib/schemas/auth";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export function ForgotPasswordView() {
  const { forgotPassword } = useAuth();
  const { addToast } = useToast();
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      await forgotPassword(data.email);
      setSubmitted(true);
      addToast({ title: "Reset Link Sent", type: "info", description: "Check your email inbox for password recovery instructions." });
    } catch (err: any) {
      addToast({ title: "Request Failed", type: "error", description: err.message || "Failed to send reset link" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white">
      <div className="w-full max-w-md">
        <Card className="bg-zinc-900 border-zinc-800 text-white shadow-2xl">
          {submitted ? (
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-pulseGreen-500/20 text-pulseGreen-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Check Your Inbox</h2>
              <p className="text-sm text-zinc-400">
                We've sent a password reset link to your email address. Follow the link to create a new password.
              </p>
              <Button asChild variant="outline" className="w-full border-zinc-700 text-zinc-200">
                <Link to="/login">Back to Sign In</Link>
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle className="text-white text-lg font-bold">Reset Password</CardTitle>
                <CardDescription className="text-zinc-400">
                  Enter your email address to receive password recovery instructions.
                </CardDescription>
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
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" variant="primary" className="w-full h-11 text-base font-bold">
                  Send Recovery Link
                </Button>
                <Link to="/login" className="inline-flex items-center justify-center text-xs text-zinc-400 hover:text-white">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Sign In
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
