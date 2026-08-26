import Link from "next/link";
import { ArrowLeft, Gavel, ShieldCheck } from "lucide-react";

export default function AuthShell({ eyebrow, title, description, children }) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About BidX authentication">
        <Link href="/" className="auth-brand">
          <span><Gavel size={18} /></span>
          Bid<span>X</span>
        </Link>
        <div className="auth-story-copy">
          <p className="eyebrow">Verified access</p>
          <h1>One account.<br />Every <em>bid.</em></h1>
          <p>Your identity, bidding history, seller tools, and payments stay connected through the BidX gateway.</p>
        </div>
        <div className="auth-security-note">
          <ShieldCheck size={20} />
          <div>
            <strong>Backend-authoritative security</strong>
            <span>Frontend roles control the experience. Every protected action is still verified by the API.</span>
          </div>
        </div>
      </section>

      <section className="auth-workspace">
        <Link href="/" className="auth-back"><ArrowLeft size={15} /> Back to auctions</Link>
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="auth-card-description">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}

