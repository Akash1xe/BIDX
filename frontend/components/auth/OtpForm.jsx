"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthStatus from "@/components/auth/AuthStatus";
import { otpSchema } from "@/features/auth/schemas";
import { roleHome } from "@/features/auth/navigation";
import { useCompleteSignup } from "@/features/auth/hooks";
import useAuth from "@/hooks/useAuth";

export default function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signupDraft, resendOtp } = useAuth();
  const complete = useCompleteSignup();
  const [resendState, setResendState] = useState({ busy: false, message: "", error: "" });
  const form = useForm({ resolver: zodResolver(otpSchema), defaultValues: { otp: "" } });
  const email = signupDraft?.email || searchParams.get("email") || "your email";
  const devOtp = searchParams.get("devOtp");

  async function submit(values) {
    try {
      const session = await complete.mutateAsync(values.otp);
      router.replace(roleHome(session.user.role));
    } catch {
      // The mutation exposes the normalized API error in the form below.
    }
  }

  async function resend() {
    setResendState({ busy: true, message: "", error: "" });
    try {
      const data = await resendOtp();
      setResendState({ busy: false, message: data?.devOtp ? `Development code: ${data.devOtp}` : "A new code was sent.", error: "" });
    } catch (error) {
      setResendState({ busy: false, message: "", error: error.message });
    }
  }

  if (!signupDraft) {
    return (
      <div className="auth-form">
        <AuthStatus>Your signup details are no longer available. This happens after a page refresh because BidX never stores your password.</AuthStatus>
        <Button asChild className="primary-button auth-submit"><Link href="/signup">Restart signup</Link></Button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
      <div className="otp-context">Code sent to <strong>{email}</strong></div>
      {devOtp && <AuthStatus type="success">Development code: {devOtp}</AuthStatus>}
      <InputOTP
        maxLength={6}
        inputMode="numeric"
        value={form.watch("otp")}
        onChange={(value) => form.setValue("otp", value, { shouldValidate: true })}
        containerClassName="otp-input"
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="otp-slot" />)}
        </InputOTPGroup>
      </InputOTP>
      {form.formState.errors.otp && <p className="field-error" role="alert">{form.formState.errors.otp.message}</p>}

      <AuthStatus>{complete.error?.message || resendState.error}</AuthStatus>
      <AuthStatus type="success">{resendState.message}</AuthStatus>
      <Button type="submit" className="primary-button auth-submit" disabled={complete.isPending}>
        {complete.isPending ? <><LoaderCircle className="spin" /> Creating account…</> : <><Check /> Verify and create account</>}
      </Button>
      <Button type="button" variant="outline" className="auth-submit" disabled={resendState.busy} onClick={resend}>
        <RotateCcw /> {resendState.busy ? "Sending…" : "Resend code"}
      </Button>
      <p className="auth-alternative"><Link href="/signup">Change account details</Link></p>
    </form>
  );
}
