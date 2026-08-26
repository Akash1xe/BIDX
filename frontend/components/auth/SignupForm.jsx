"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthStatus from "@/components/auth/AuthStatus";
import FormField from "@/components/auth/FormField";
import { signupSchema } from "@/features/auth/schemas";
import { useBeginSignup } from "@/features/auth/hooks";

export default function SignupForm() {
  const router = useRouter();
  const signup = useBeginSignup();
  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function submit(values) {
    try {
      const result = await signup.mutateAsync(values);
      const params = new URLSearchParams({ email: values.email });
      if (result?.devOtp) params.set("devOtp", result.devOtp);
      router.push(`/verify-otp?${params.toString()}`);
    } catch {
      // The mutation exposes the normalized API error in the form below.
    }
  }

  return (
    <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
      <FormField id="signup-name" label="Full name" error={form.formState.errors.name?.message}>
        <Input id="signup-name" autoComplete="name" placeholder="Akash Kumar" {...form.register("name")} />
      </FormField>
      <FormField id="signup-email" label="Email address" error={form.formState.errors.email?.message}>
        <Input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} />
      </FormField>
      <FormField id="signup-password" label="Password" error={form.formState.errors.password?.message}>
        <Input id="signup-password" type="password" autoComplete="new-password" placeholder="At least 8 characters" {...form.register("password")} />
      </FormField>

      <AuthStatus>{signup.error?.message}</AuthStatus>
      <Button type="submit" className="primary-button auth-submit" disabled={signup.isPending}>
        {signup.isPending ? <><LoaderCircle className="spin" /> Sending code…</> : <>Send verification code <ArrowRight /></>}
      </Button>

      <p className="auth-privacy">Your password stays in memory only while you complete verification.</p>
      <p className="auth-alternative">Already have an account? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
