import AuthShell from "@/components/auth/AuthShell";
import OtpForm from "@/components/auth/OtpForm";

export const metadata = { title: "Verify email — BidX" };

export default function VerifyOtpPage() {
  return (
    <AuthShell eyebrow="Email verification" title="Enter your code" description="Use the six-digit code sent to your email. Codes are rate-limited by the backend.">
      <OtpForm />
    </AuthShell>
  );
}

