import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export const metadata = { title: "Create account — BidX" };

export default function SignupPage() {
  return (
    <AuthShell eyebrow="Join BidX" title="Create your account" description="We verify your email before creating the account, exactly as the BidX API requires.">
      <SignupForm />
    </AuthShell>
  );
}

