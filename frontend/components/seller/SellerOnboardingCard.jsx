"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import useAuth from "@/hooks/useAuth";

export default function SellerOnboardingCard() {
  const router = useRouter();
  const { user, becomeSeller } = useAuth();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (user?.role !== "USER") return null;

  async function activate() {
    setPending(true);
    setError("");
    try {
      await becomeSeller();
      router.replace("/seller");
    } catch (cause) {
      setError(cause?.message || "Seller activation failed. Please try again.");
      setPending(false);
    }
  }

  return <section className="seller-onboarding-card"><Store /><div><p className="eyebrow">Sell on BidX</p><h2>Turn your verified account into a seller account</h2><p>Activation keeps your buyer access and unlocks owned product inventory and auction creation. Every seller remains isolated by backend ownership checks.</p>{error && <p className="seller-form-error">{error}</p>}</div><Button className="primary-button" onClick={activate} disabled={pending}>{pending ? <><LoaderCircle className="spin" /> Activating…</> : <>Become a seller <ArrowRight /></>}</Button></section>;
}
