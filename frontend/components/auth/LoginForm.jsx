"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthStatus from "@/components/auth/AuthStatus";
import FormField from "@/components/auth/FormField";
import { loginSchema } from "@/features/auth/schemas";
import { safeReturnTo, roleHome } from "@/features/auth/navigation";
import { useLogin } from "@/features/auth/hooks";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(values) {
    try {
      const session = await login.mutateAsync(values);
      const requested = searchParams.get("next");
      router.replace(safeReturnTo(requested, roleHome(session.user.role)));
    } catch {
      // The mutation exposes the normalized API error in the form below.
    }
  }

  return (
    <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
      <FormField id="login-email" label="Email address" error={form.formState.errors.email?.message}>
        <Input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} />
      </FormField>
      <FormField id="login-password" label="Password" error={form.formState.errors.password?.message}>
        <Input id="login-password" type="password" autoComplete="current-password" placeholder="Your password" {...form.register("password")} />
      </FormField>

      <AuthStatus>{login.error?.message}</AuthStatus>
      <Button type="submit" className="primary-button auth-submit" disabled={login.isPending}>
        {login.isPending ? <><LoaderCircle className="spin" /> Signing in…</> : <>Sign in <ArrowRight /></>}
      </Button>

      <p className="auth-alternative">New to BidX? <Link href="/signup">Create your account</Link></p>
    </form>
  );
}
