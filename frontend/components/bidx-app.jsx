"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Gavel,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { api, API_URL, SOCKET_URL, makeIdempotencyKey, readSession, saveSession } from "@/lib/bidx-api";
import { DEMO_AUCTIONS, DEMO_BIDS } from "@/lib/demo-data";

const CATEGORIES = ["All", "Cameras", "Watches", "Design", "Collectibles"];

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function timeLeft(date) {
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function ProductArt({ auction, large = false }) {
  const image = auction.product?.images?.[0] || auction.images?.[0];
  const label = auction.product?.name || auction.name || "Auction item";
  if (image) {
    return <img src={image} alt={label} className="product-image" />;
  }
  return (
    <div className={`product-art art-${auction.color || "coral"} ${large ? "product-art-large" : ""}`} aria-label={`${label} image placeholder`}>
      <div className="art-orbit" />
      <div className="art-mark">{label.slice(0, 1)}</div>
      <span>{auction.product?.category || auction.category || "curated"}</span>
    </div>
  );
}

function Brand() {
  return (
    <button className="brand" onClick={() => location.assign("#market")} aria-label="BidX home">
      <span className="brand-mark"><Gavel size={17} /></span>
      <span>Bid<span>X</span></span>
    </button>
  );
}

function AuthPanel({ open, onOpenChange, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("details");
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api("/api/v1/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
      saveSession(data);
      onAuthenticated(data);
      onOpenChange(false);
      toast.success(`Welcome back, ${data.user.name}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function startSignup(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api("/api/v1/auth/send-otp", { method: "POST", body: { email: form.email } });
      setStep("otp");
      toast.success(data?.devOtp ? `Development OTP: ${data.devOtp}` : "OTP sent to your email");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function finishSignup(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/v1/auth/verify-otp", { method: "POST", body: { email: form.email, otp } });
      const data = await api("/api/v1/auth/signup", { method: "POST", body: form });
      saveSession(data);
      onAuthenticated(data);
      onOpenChange(false);
      toast.success("Your BidX account is ready");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setStep("details");
    setOtp("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="auth-sheet">
        <SheetHeader className="auth-heading">
          <div className="mini-brand"><Gavel size={16} /> BidX</div>
          <SheetTitle>{mode === "login" ? "Welcome back" : step === "otp" ? "Check your inbox" : "Join the auction"}</SheetTitle>
          <SheetDescription>
            {mode === "login" ? "Sign in to bid, sell, and track your activity." : step === "otp" ? `Enter the 6-digit code sent to ${form.email}.` : "Create a verified account in under a minute."}
          </SheetDescription>
        </SheetHeader>

        {mode === "signup" && step === "otp" ? (
          <form className="auth-form" onSubmit={finishSignup}>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="otp-slot" />)}</InputOTPGroup>
            </InputOTP>
            <Button type="submit" className="primary-button" disabled={busy || otp.length !== 6}>{busy ? "Verifying…" : "Verify & create account"}</Button>
            <button type="button" className="text-button" onClick={() => setStep("details")}>Change account details</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={mode === "login" ? login : startSignup}>
            {mode === "signup" && <div className="field"><Label htmlFor="name">Full name</Label><Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Akash Kumar" required /></div>}
            <div className="field"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required /></div>
            <div className="field"><Label htmlFor="password">Password</Label><Input id="password" type="password" minLength={mode === "signup" ? 8 : undefined} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" required /></div>
            <Button type="submit" className="primary-button" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Send verification code"}</Button>
          </form>
        )}

        <div className="auth-switch">
          {mode === "login" ? "New to BidX?" : "Already have an account?"}
          <button onClick={() => switchMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create account" : "Sign in"}</button>
        </div>
        <div className="api-note"><Zap size={14} /> Connected through {API_URL}</div>
      </SheetContent>
    </Sheet>
  );
}

function AuctionCard({ auction, onOpen }) {
  const product = auction.product || auction;
  const current = auction.currentBid || auction.currentPrice || auction.startingPrice;
  return (
    <article className="auction-card" onClick={() => onOpen(auction)}>
      <div className="auction-media">
        <ProductArt auction={auction} />
        <Badge className={`status-badge status-${auction.status?.toLowerCase()}`}>{auction.status === "LIVE" && <span className="live-dot" />}{auction.status}</Badge>
        <button className="heart-button" aria-label={`Save ${product.name}`} onClick={(event) => { event.stopPropagation(); toast.success("Saved to your watchlist"); }}><Heart size={17} /></button>
      </div>
      <div className="auction-card-body">
        <div><p className="eyebrow">{product.category} · {String(product.condition || "used").replaceAll("_", " ")}</p><h3>{product.name}</h3></div>
        <div className="auction-meta">
          <div><span>{auction.currentBid ? "Current bid" : "Starting at"}</span><strong>{money(current)}</strong></div>
          <div className="time"><Clock3 size={15} /><span>{auction.status === "SCHEDULED" ? "Starts soon" : timeLeft(auction.endTime)}</span></div>
        </div>
      </div>
    </article>
  );
}

function AuctionDialog({ auction, open, onOpenChange, session, onRequireAuth, onBidPlaced }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  if (!auction) return null;
  const product = auction.product || auction;
  const current = auction.currentBid || auction.currentPrice || auction.startingPrice;
  const minimum = auction.currentBid ? Number(auction.currentBid) + Number(auction.minimumIncrement) : Number(auction.startingPrice);

  async function placeBid(event) {
    event.preventDefault();
    if (!session) return onRequireAuth();
    setBusy(true);
    try {
      const data = await api("/api/v1/bids", {
        method: "POST",
        headers: { "idempotency-key": makeIdempotencyKey() },
        body: { auctionId: auction.id || auction.auctionId, amount: Number(amount) },
      });
      onBidPlaced(data);
      setAmount("");
      toast.success(`Bid accepted at ${money(data.auction.currentBid)}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="auction-dialog">
        <div className="detail-art"><ProductArt auction={auction} large /></div>
        <div className="detail-copy">
          <DialogHeader><p className="eyebrow">{product.category} · verified listing</p><DialogTitle>{product.name}</DialogTitle><DialogDescription>{product.description || "A curated listing from a verified BidX seller."}</DialogDescription></DialogHeader>
          <div className="detail-stat-row"><div><span>Current bid</span><strong>{money(current)}</strong></div><div><span>Time left</span><strong>{timeLeft(auction.endTime)}</strong></div><div><span>Min. step</span><strong>{money(auction.minimumIncrement)}</strong></div></div>
          <div className="bid-rule"><ShieldCheck size={18} /><div><strong>Protected bidding</strong><span>Concurrency-safe and idempotent. Your bid is submitted exactly once.</span></div></div>
          {auction.status === "LIVE" ? <form className="bid-form" onSubmit={placeBid}><Label htmlFor="bidAmount">Your maximum bid</Label><div className="bid-input"><span>₹</span><Input id="bidAmount" type="number" min={minimum} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(minimum)} required /><Button type="submit" className="primary-button" disabled={busy}>{busy ? "Placing…" : "Place bid"}<ArrowRight size={16} /></Button></div><small>Minimum bid: {money(minimum)}</small></form> : <div className="scheduled-message"><Clock3 size={18} /> This auction is not accepting bids yet.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateAuctionDialog({ open, onOpenChange }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "collectibles", condition: "USED", image: "", startingPrice: "", minimumIncrement: "", startTime: "", endTime: "" });
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const product = await api("/api/v1/products", { method: "POST", body: { name: form.name, description: form.description, category: form.category, condition: form.condition, images: form.image ? [form.image] : [] } });
      await api("/api/v1/auctions", { method: "POST", body: { productId: product.id, startingPrice: Number(form.startingPrice), minimumIncrement: Number(form.minimumIncrement), startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() } });
      toast.success("Draft auction created");
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message);
    } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Create an auction</DialogTitle><DialogDescription>First we create the product, then its draft auction—matching your two backend resources.</DialogDescription></DialogHeader><form className="create-grid" onSubmit={submit}><div className="field span-2"><Label>Product name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="field span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><div className="field"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></div><div className="field"><Label>Condition</Label><select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option>NEW</option><option>LIKE_NEW</option><option>USED</option><option>REFURBISHED</option></select></div><div className="field"><Label>Starting price</Label><Input type="number" min="1" value={form.startingPrice} onChange={(e) => setForm({ ...form, startingPrice: e.target.value })} required /></div><div className="field"><Label>Minimum increment</Label><Input type="number" min="1" value={form.minimumIncrement} onChange={(e) => setForm({ ...form, minimumIncrement: e.target.value })} required /></div><div className="field"><Label>Start time</Label><Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required /></div><div className="field"><Label>End time</Label><Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required /></div><div className="field span-2"><Label>Image URL (optional)</Label><Input type="url" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div><Button className="primary-button span-2" disabled={busy}>{busy ? "Creating…" : "Create draft auction"}</Button></form></DialogContent></Dialog>;
}

function AccountView({ session, bids, auctions, onCreate }) {
  const [tab, setTab] = useState("bids");
  return <section className="account-section" id="dashboard"><div className="section-heading"><div><p className="eyebrow">Your command center</p><h2>{session ? `Good to see you, ${session.user.name.split(" ")[0]}` : "A cleaner way to manage auctions"}</h2></div>{session?.user?.role === "SELLER" && <Button className="primary-button" onClick={onCreate}><PackagePlus size={16} /> Create auction</Button>}</div><Tabs value={tab} onValueChange={setTab}><TabsList variant="line" className="account-tabs"><TabsTrigger value="bids">My bids</TabsTrigger><TabsTrigger value="selling">Selling</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger></TabsList><TabsContent value="bids"><div className="table-shell"><Table><TableHeader><TableRow><TableHead>Auction</TableHead><TableHead>Bid</TableHead><TableHead>Status</TableHead><TableHead>Placed</TableHead></TableRow></TableHeader><TableBody>{bids.map((bid) => { const item = auctions.find((auction) => (auction.id || auction.auctionId) === bid.auctionId); return <TableRow key={bid.id}><TableCell className="font-medium">{item?.product?.name || `Auction ${bid.auctionId.slice(-6)}`}</TableCell><TableCell>{money(bid.amount)}</TableCell><TableCell><Badge variant="outline">{bid.status}</Badge></TableCell><TableCell>{new Date(bid.createdAt).toLocaleDateString("en-IN")}</TableCell></TableRow>; })}</TableBody></Table>{!bids.length && <div className="empty-row">No bids yet. Your next find is waiting above.</div>}</div></TabsContent><TabsContent value="selling"><div className="empty-panel"><PackagePlus /><h3>Seller studio</h3><p>Create a product listing, schedule its auction, then start or end it from one focused workspace.</p><Button variant="outline" onClick={onCreate}>Create your first auction</Button></div></TabsContent><TabsContent value="payments"><div className="empty-panel"><WalletCards /><h3>Payment history</h3><p>Winning payments and seller receipts from <code>/api/v1/payments/mine</code> appear here.</p></div></TabsContent></Tabs></section>;
}

function AdminView() {
  return <section className="admin-section"><div className="section-heading"><div><p className="eyebrow">Admin only</p><h2>Marketplace pulse</h2></div><Badge className="admin-badge"><ShieldCheck size={14} /> role: ADMIN</Badge></div><div className="stat-grid"><div><span>Users</span><strong>—</strong><small>From /admin/stats</small></div><div><span>Live auctions</span><strong>—</strong><small>Moderation ready</small></div><div><span>Accepted bids</span><strong>—</strong><small>Across all auctions</small></div><div><span>GMV</span><strong>—</strong><small>Paid orders</small></div></div></section>;
}

export default function BidXApp() {
  const socketRef = useRef(null);
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [auctions, setAuctions] = useState(DEMO_AUCTIONS);
  const [bids, setBids] = useState(DEMO_BIDS);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [source, setSource] = useState("loading");

  useEffect(() => {
    setSession(readSession());
    let active = true;
    async function load() {
      try {
        const data = await api("/api/v1/auctions?status=LIVE&limit=20");
        if (active && data?.items?.length) { setAuctions(data.items); setSource("live"); }
        else if (active) setSource("demo");
      } catch { if (active) setSource("demo"); }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    api("/api/v1/bids/mine?limit=20").then((data) => setBids(data.items || [])).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session?.tokens?.accessToken) return;
    let disposed = false;
    import("socket.io-client").then(({ io }) => {
      if (disposed) return;
      const socket = io(SOCKET_URL, {
        path: "/socket.io",
        auth: { token: session.tokens.accessToken },
      });
      socketRef.current = socket;
      socket.on("bid:new", (payload) => {
        setAuctions((items) => items.map((item) =>
          (item.id || item.auctionId) === payload.auctionId
            ? { ...item, currentBid: payload.currentBid, highestBidderId: payload.bidderId }
            : item
        ));
        setSelected((item) => item && (item.id || item.auctionId) === payload.auctionId
          ? { ...item, currentBid: payload.currentBid, highestBidderId: payload.bidderId }
          : item
        );
      });
      socket.on("bid:outbid", (payload) => {
        toast.warning(`You were outbid. The new bid is ${money(payload.amount)}.`);
      });
    }).catch(() => {});
    return () => {
      disposed = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selected) return;
    const auctionId = selected.id || selected.auctionId;
    socket.emit("auction:join", auctionId);
    return () => socket.emit("auction:leave", auctionId);
  }, [selected]);

  const filtered = useMemo(() => auctions.filter((auction) => {
    const product = auction.product || auction;
    return (!query || product.name?.toLowerCase().includes(query.toLowerCase())) && (category === "All" || product.category?.toLowerCase() === category.toLowerCase());
  }), [auctions, query, category]);

  function logout() {
    const refreshToken = session?.tokens?.refreshToken;
    if (refreshToken) api("/api/v1/auth/logout", { method: "POST", body: { refreshToken } }).catch(() => {});
    saveSession(null); setSession(null); toast.success("Signed out");
  }

  function handleBidPlaced(data) {
    setAuctions((items) => items.map((item) => (item.id || item.auctionId) === (selected.id || selected.auctionId) ? { ...item, currentBid: data.auction.currentBid, highestBidderId: data.auction.highestBidderId } : item));
    setSelected((item) => ({ ...item, currentBid: data.auction.currentBid, highestBidderId: data.auction.highestBidderId }));
    setBids((items) => [data.bid, ...items]);
  }

  return (
    <main>
      <Toaster position="top-right" />
      <header className="site-header"><div className="header-inner"><Brand /><nav className={menuOpen ? "nav-open" : ""}><a href="#market" onClick={() => setMenuOpen(false)}>Discover</a><a href="#how" onClick={() => setMenuOpen(false)}>How it works</a><a href="#dashboard" onClick={() => setMenuOpen(false)}>My activity</a></nav><div className="header-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button>{session ? <div className="session-actions"><button className="profile-pill"><span>{session.user.name.slice(0, 1)}</span>{session.user.name}<ChevronDown size={14} /></button><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={17} /></button></div> : <><Button variant="ghost" onClick={() => setAuthOpen(true)}>Sign in</Button><Button className="primary-button" onClick={() => setAuthOpen(true)}>Start bidding</Button></>}<button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</button></div></div></header>

      <section className="hero" id="market"><div className="hero-copy"><Badge className="hero-badge"><Sparkles size={14} /> Live, verified, yours</Badge><h1>Bid on things<br />worth <em>keeping.</em></h1><p>A focused marketplace for remarkable objects. Real-time bids, verified sellers, and protected payments—without the noise.</p><div className="hero-search"><Search size={19} /><Input aria-label="Search auctions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cameras, watches, design…" /><Button className="primary-button" onClick={() => document.querySelector(".auction-grid")?.scrollIntoView({ behavior: "smooth" })}>Explore</Button></div><div className="trust-row"><span><Check /> Verified sellers</span><span><Check /> Real-time bidding</span><span><Check /> Secure payments</span></div></div><div className="hero-visual"><div className="lot-card"><div className="lot-top"><span>LOT 042</span><Badge className="status-live"><span className="live-dot" /> LIVE</Badge></div><div className="lot-gavel"><Gavel /></div><div className="lot-bottom"><div><span>Current bid</span><strong>{money(142500)}</strong></div><div><span>Ending in</span><strong>43:18</strong></div></div></div><div className="floating-bid"><span className="avatar-dot">A</span><div><strong>New bid placed</strong><span>{money(142500)} · just now</span></div></div></div></section>

      <section className="market-section"><div className="market-toolbar"><div><p className="eyebrow">Curated marketplace</p><h2>Auctions happening now</h2></div><div className="source-chip"><span className={source === "live" ? "source-live" : ""} />{source === "loading" ? "Connecting…" : source === "live" ? "Live backend" : "Demo catalog"}</div></div><div className="category-row">{CATEGORIES.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="auction-grid">{filtered.map((auction) => <AuctionCard key={auction.id || auction.auctionId} auction={auction} onOpen={(item) => setSelected(item)} />)}</div>{!filtered.length && <div className="no-results"><Search /><h3>No matching auctions</h3><p>Try another keyword or category.</p></div>}</section>

      <section className="how-section" id="how"><div className="how-intro"><p className="eyebrow">Built for confidence</p><h2>From first look<br />to final bid.</h2><p>BidX keeps the complex distributed systems underneath the interface—so each action feels immediate and dependable.</p></div><div className="how-list"><div><span>01</span><div><Search /><h3>Discover</h3><p>Search by name, category, condition, price, and auction status.</p></div></div><div><span>02</span><div><Gavel /><h3>Bid live</h3><p>Every bid is concurrency-safe, idempotent, and streamed in real time.</p></div></div><div><span>03</span><div><ShieldCheck /><h3>Pay securely</h3><p>Winners complete protected Razorpay checkout and receive confirmation.</p></div></div></div></section>

      <AccountView session={session} bids={session ? bids : []} auctions={auctions} onCreate={() => session ? setCreateOpen(true) : setAuthOpen(true)} />
      {session?.user?.role === "ADMIN" && <AdminView />}

      <footer><Brand /><p>Distributed systems. Delightfully simple auctions.</p><span>© 2026 BidX</span></footer>
      <AuthPanel open={authOpen} onOpenChange={setAuthOpen} onAuthenticated={setSession} />
      <AuctionDialog auction={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} session={session} onRequireAuth={() => setAuthOpen(true)} onBidPlaced={handleBidPlaced} />
      <CreateAuctionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}
