import Link from "next/link";
import { Gavel } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer>
      <Link href="/" className="brand"><span className="brand-mark"><Gavel size={17} /></span><span>Bid<span>X</span></span></Link>
      <p>Distributed systems. Delightfully simple auctions.</p>
      <div className="footer-links"><Link href="/auctions">Auctions</Link><Link href="/search">Search</Link></div>
      <span>© 2026 BidX</span>
    </footer>
  );
}

