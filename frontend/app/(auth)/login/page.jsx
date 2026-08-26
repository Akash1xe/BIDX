import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — BidX" };

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to BidX" description="Continue bidding, selling, and tracking your auction activity.">
      <LoginForm />
    </AuthShell>
  );
}

