"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Orb } from "@/components/Orb";
import { Splash } from "@/components/Splash";
import { Sheet } from "@/components/product/Sheet";
import { signInWithEmail, signInWithGoogle } from "@/lib/cloud";

// Rotating prompts ONE "says" in the hero — invites action, like the app's
// broadcast. The first slot is filled with a time-aware greeting at runtime.
const HERO_PROMPTS = [
  "What would you like to move forward?",
  "Tell me one thing you want to get done.",
  "A trip, a booking, a license — where do we start?",
  "Say it once. I'll turn it into a process that moves.",
];

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 16.3 2 9.7 6.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 36.9 26.9 38 24 38c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 41.6 16.2 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.5 5.5C41.8 36.3 45 30.9 45 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function VoiceBars() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 9v6M12 6v12M16 9v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function SendArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  // Ready to type from the moment ONE appears — focus (blinking caret) without
  // yanking the page's scroll position.
  useEffect(() => {
    const t = setTimeout(() => heroInputRef.current?.focus({ preventScroll: true }), 300);
    return () => clearTimeout(t);
  }, []);

  // The gateway: type an intention → step into the product with it in hand.
  const [heroDraft, setHeroDraft] = useState("");
  const [greeting, setGreeting] = useState("Hello.");

  // Time-aware greeting, set on the client to avoid an SSR/hydration mismatch.
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.");
  }, []);

  // ONE's rotating "broadcast" in the hero (fades between lines), like the app.
  const heroLines = useMemo(() => [greeting, ...HERO_PROMPTS], [greeting]);
  const [bi, setBi] = useState(0);
  const [bfade, setBfade] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setBfade(true);
      setTimeout(() => {
        setBi((i) => (i + 1) % heroLines.length);
        setBfade(false);
      }, 300);
    }, 3800);
    return () => clearInterval(t);
  }, [heroLines.length]);

  // Sign-in popup (opened by tapping the Orb), mirroring the mobile SignInSheet.
  const [signInOpen, setSignInOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setAuthMsg("Sending…");
    const res = await signInWithEmail(email.trim());
    setAuthMsg(res.ok ? "Check your inbox for the link." : res.error ?? "Couldn't send the link.");
  };

  const startWith = (text: string) => {
    const t = text.trim();
    router.push(t ? `/app?q=${encodeURIComponent(t)}` : "/app");
  };

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !("IntersectionObserver" in window)) {
      setScrolled(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setScrolled(!entries[0].isIntersecting),
      { threshold: 0, rootMargin: "0px" }
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Splash bg="var(--bg)" padBottom="22vh" />
      {/* ── nav ── */}
      <nav ref={navRef} className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="nav-brand" aria-label="ONE01">
            <Logo height={22} />
          </Link>
          <div className="nav-actions">
            <a className="nav-link" href="#problem">ONE</a>
            <a className="nav-link" href="#identity">Life</a>
            <a className="nav-link" href="#connections">Business</a>
            <a className="nav-link" href="#status">Vision</a>
            <Link className="btn btn-primary" href="/app">Enter</Link>
          </div>
        </div>
      </nav>

      {/* ── hero — the gateway: ONE centre-stage, ready to start ── */}
      <section ref={heroRef} className="lhero">
        <div className="lhero-core">
          <span className="lhero-chev up" aria-hidden="true">
            <ChevronUp />
          </span>
          <button
            type="button"
            className="lhero-orb-btn"
            onClick={() => setSignInOpen(true)}
            aria-label="Sign in to ONE"
          >
            <Orb size={96} eyeR={12} alive className="lhero-orb" />
          </button>
          <p className={`lhero-line${bfade ? " is-fading" : ""}`}>{heroLines[bi]}</p>
          <button
            type="button"
            className="lhero-chev down"
            aria-label="Scroll to learn more"
            onClick={() => document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" })}
          >
            <ChevronDown />
          </button>
        </div>

        <div className="lhero-dockwrap">
          <form
            className="lhero-dock"
            onSubmit={(e) => {
              e.preventDefault();
              startWith(heroDraft);
            }}
          >
            <button type="button" className="lhero-plus" aria-label="Start fresh" onClick={() => startWith("")}>
              <PlusIcon />
            </button>
            <input
              ref={heroInputRef}
              className="lhero-input"
              aria-label="Tell ONE what you want to move forward"
              value={heroDraft}
              onChange={(e) => setHeroDraft(e.target.value)}
            />
            <button
              type="submit"
              className="lhero-voice"
              aria-label={heroDraft.trim() ? "Send" : "Talk to ONE"}
            >
              {heroDraft.trim() ? <SendArrow /> : <VoiceBars />}
            </button>
          </form>
          <p className="lhero-signin">
            No account needed to start ·{" "}
            <button type="button" className="lhero-link" onClick={() => setSignInOpen(true)}>
              Already have ONE?
            </button>
          </p>
        </div>
      </section>

      {/* Sign-in popup — opened by tapping the Orb, mirroring the mobile sheet. */}
      <Sheet open={signInOpen} onClose={() => setSignInOpen(false)}>
        <div className="signin">
          <Orb size={72} eyeR={12} />
          <h3 className="signin-title">Continue with ONE</h3>
          <p className="signin-sub">Save your processes and pick up on any device.</p>
          <button className="signin-google" onClick={() => signInWithGoogle()}>
            <GoogleG /> Continue with Google
          </button>
          <div className="signin-or"><span>or</span></div>
          <div className="signin-mail">
            <input
              className="signin-input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
            />
            <button className="signin-send" onClick={sendMagicLink}>Send link</button>
          </div>
          {authMsg && <p className="signin-msg">{authMsg}</p>}
        </div>
      </Sheet>

      {/* ── thesis ── */}
      <section className="section soft center" id="problem">
        <div className="shell narrow">
          <div className="eyebrow">Why ONE</div>
          <h2>
            Life doesn&apos;t happen in one app.<br />
            It happens across <span className="accent-italic">everything</span>.
          </h2>
          <p className="lede">
            Your goals, chats, files, and appointments are scattered across a dozen
            places — held together by your memory. ONE gives every intention one
            place to live, and quietly moves it forward.
          </p>
        </div>
      </section>

      {/* ── three steps ── */}
      <section className="section center" id="concept">
        <div className="shell">
          <div className="eyebrow">How it works</div>
          <h2>Say it once. ONE carries it to done.</h2>
          <div className="steps">
            <div className="step">
              <span className="step-n">1</span>
              <h3>You say it</h3>
              <p>“Book me a haircut Tuesday.” “Plan the move.” One sentence, in plain words.</p>
            </div>
            <div className="step">
              <span className="step-n">2</span>
              <h3>It becomes a process</h3>
              <p>ONE turns it into a living process — a goal, the steps, the people, and the next thing to do.</p>
            </div>
            <div className="step">
              <span className="step-n">3</span>
              <h3>It moves forward</h3>
              <p>ONE remembers, connects, and surfaces the one next step — until it&apos;s actually done.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── what you get — bento ── */}
      <section className="section soft center" id="identity">
        <div className="shell">
          <div className="eyebrow">What you get</div>
          <h2>An agent that remembers and follows through.</h2>
          <div className="bento" style={{ marginTop: 56 }}>
            <div className="bento-card span-3 dark">
              <div className="bento-visual">
                <Orb size={40} eyeR={12} faceColor="#ffffff" eyeColor="#0f0f0f" />
                <div className="bento-bubble">“Book me a haircut Tuesday.”</div>
              </div>
              <h3>One sentence becomes a process</h3>
              <p>What you say turns into a living process — with a goal, the steps, and the next thing to do.</p>
            </div>

            <div className="bento-card span-3">
              <div className="bento-chips">
                <span>👤 Personal</span>
                <span>🏢 Business</span>
                <span>👪 Family</span>
              </div>
              <h3>One agent, many identities</h3>
              <p>The same ONE for your health and your home — and for a business you run. Different worlds, one agent.</p>
            </div>

            <div className="bento-card span-2">
              <div className="bento-icon">🧠</div>
              <h3>It remembers</h3>
              <p>Files, decisions, people, and where you left off — pinned to the process, not lost in a chat.</p>
            </div>

            <div className="bento-card span-2">
              <div className="bento-icon">➡️</div>
              <h3>Shows the next step</h3>
              <p>Not the whole list — the one thing to do now, based on what&apos;s actually happening.</p>
            </div>

            <div className="bento-card span-2">
              <div className="bento-icon">🔒</div>
              <h3>Yours, and private</h3>
              <p>No account needed to start. Sign in when you want ONE to follow you across devices.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── businesses ── */}
      <section className="section center" id="connections">
        <div className="shell narrow">
          <div className="eyebrow">The network</div>
          <h2>
            Businesses have a <span className="accent-italic">ONE</span>, too.
          </h2>
          <p className="lede">
            Book a haircut, a driving lesson, a move — your ONE talks to the
            business&apos;s ONE. The booking becomes a card for both of you, around
            the process itself, not one endless chat.
          </p>
          <div className="connect" style={{ marginTop: 48 }}>
            <div className="connect-side">
              <div className="connect-orb" />
              <div className="connect-name">Your ONE</div>
              <div className="connect-role">Personal</div>
              <div className="connect-sub">💈 Hair Appointment</div>
            </div>
            <div className="connect-bridge">
              <div className="connect-bridge-line">↔</div>
              <div className="connect-bridge-label">connected around the process</div>
            </div>
            <div className="connect-side">
              <div className="connect-orb" />
              <div className="connect-name">Sarah Salon&apos;s ONE</div>
              <div className="connect-role">Business</div>
              <div className="connect-sub">📅 Booking · Tuesday 18:00</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── status ── */}
      <section className="section soft center" id="status">
        <div className="shell narrow">
          <div className="eyebrow">Where we are</div>
          <h2>Open preview.</h2>
          <p className="lede">
            The interface is real and complete — every screen, gesture, and flow.
            The intelligence and the connected network are shipping next. No account
            needed to try it today.
          </p>
        </div>
      </section>

      {/* ── final CTA ── */}
      <section className="final">
        <h2>
          Start with <span className="accent-italic">one thing</span>.
        </h2>
        <p className="lede">Tell ONE what matters. It will help move it forward.</p>
        <div className="final-ctas">
          <Link className="btn btn-primary btn-lg" href="/app">Start with ONE →</Link>
        </div>
      </section>

      {/* ── footer — centered: orb, quiet links, copyright ── */}
      <footer className="foot">
        <div className="foot-center">
          <Link href="/" aria-label="ONE01" className="foot-orb">
            <Orb size={38} eyeR={9} />
          </Link>
          <nav className="foot-links">
            <a href="#problem">About</a>
            <a href="mailto:hello@one01.io">Support</a>
            <a href="#">Legal</a>
          </nav>
          <span className="foot-copy">© 2026 ONE01</span>
        </div>
      </footer>
    </>
  );
}
