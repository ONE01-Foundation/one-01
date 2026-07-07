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

/* ── live product mock rendered inside the phone frame ─────────── */
function PhoneMock({ variant = "home" }: { variant?: "home" | "process" | "identity" }) {
  if (variant === "process") {
    return (
      <div className="phone phone-sm" aria-hidden="true">
        <div className="phone-inner">
          <div className="mock">
            <div className="mock-orb" />
            <div className="mock-name">Weight Gain</div>
            <div className="mock-line">On track · Coach Eli +1</div>
            <div className="mock-cards" style={{ marginTop: 8 }}>
              <div className="mock-card">
                <div className="mock-card-top">
                  <span className="mock-card-title">Next step</span>
                  <span className="mock-card-time">2:00 PM</span>
                </div>
                <div className="mock-card-sub">Workout — upper body, then log protein.</div>
              </div>
              <div className="mock-card">
                <div className="mock-card-top">
                  <span className="mock-card-title">Metric</span>
                  <span className="mock-card-time">21 / 32</span>
                </div>
                <div className="mock-card-sub">Weeks completed toward your goal.</div>
              </div>
            </div>
            <div className="mock-input">Ask ONE about this process…</div>
          </div>
        </div>
      </div>
    );
  }
  if (variant === "identity") {
    return (
      <div className="phone phone-sm" aria-hidden="true">
        <div className="phone-inner">
          <div className="mock">
            <div className="mock-orb" />
            <div className="mock-name">ONE</div>
            <div className="mock-line">Switch identity</div>
            <div className="mock-cards" style={{ marginTop: 8 }}>
              <div className="mock-card">
                <div className="mock-card-top">
                  <span className="mock-card-title">👤 Ariel</span>
                  <span className="mock-card-time">Personal</span>
                </div>
                <div className="mock-card-sub">Health · Learning · Home · Legal</div>
              </div>
              <div className="mock-card">
                <div className="mock-card-top">
                  <span className="mock-card-title">🏢 ONE01</span>
                  <span className="mock-card-time">Business</span>
                </div>
                <div className="mock-card-sub">Clients · Projects · Operations</div>
              </div>
            </div>
            <div className="mock-input">+ Add identity</div>
          </div>
        </div>
      </div>
    );
  }
  // home
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-inner">
        <div className="mock">
          <div className="mock-orb" />
          <div className="mock-name">ONE</div>
          <div className="mock-line">Good evening, Ariel. 2 things are waiting.</div>
          <div className="mock-cards">
            <div className="mock-card">
              <div className="mock-card-top">
                <span className="mock-card-title">💪 Weight Gain</span>
                <span className="mock-card-time">14:20</span>
              </div>
              <div className="mock-card-sub">Next workout today at 2:00 PM.</div>
            </div>
            <div className="mock-card">
              <div className="mock-card-top">
                <span className="mock-card-title">💈 Hair Appointment</span>
                <span className="mock-card-time">Tue 18:00</span>
              </div>
              <div className="mock-card-sub">Sarah Salon confirmed your booking.</div>
            </div>
            <div className="mock-card">
              <div className="mock-card-top">
                <span className="mock-card-title">📋 Driver&apos;s License</span>
                <span className="mock-card-time">3 left</span>
              </div>
              <div className="mock-card-sub">Theory test scheduled — 2 forms to sign.</div>
            </div>
          </div>
          <div className="mock-input">Talk to ONE</div>
        </div>
      </div>
    </div>
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
            <a className="nav-link" href="#concept">ONE</a>
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

      {/* ── problem ── */}
      <section className="section soft" id="problem">
        <div className="shell">
          <div className="eyebrow">The problem</div>
          <h2>
            Life and work don&apos;t happen in one app.<br />
            They happen across <span className="accent-italic">everything</span>.
          </h2>
          <p className="lede">
            Your goals live in your head. Your conversations are in five chat apps.
            Your documents are in cloud drives. Your appointments are scattered
            between calendars, emails, and screenshots. Reality is held together by
            your memory.
          </p>
          <div className="problem-list">
            <div className="chip">📅 Calendar</div>
            <div className="chip">💬 WhatsApp</div>
            <div className="chip">📧 Email</div>
            <div className="chip">📂 Drive</div>
            <div className="chip">📝 Notes</div>
            <div className="chip">🧠 Your head</div>
          </div>
          <p className="problem-quote">ONE gives every intention a place to live.</p>
        </div>
      </section>

      {/* ── concept ── */}
      <section className="section" id="concept">
        <div className="shell">
          <div className="eyebrow">How it works</div>
          <h2>The layer between intention and reality.</h2>
          <p className="lede">
            You speak. ONE turns that into a structured process. That process
            connects to the people, businesses, and information needed to make it
            real.
          </p>
          <div className="flow">
            <div className="flow-row muted">A wish, a goal, a need</div>
            <div className="flow-row">Intention</div>
            <div className="flow-arr">↓</div>
            <div className="flow-row middle"><em>ONE</em> — your representative</div>
            <div className="flow-arr">↓</div>
            <div className="flow-row">Process</div>
            <div className="flow-arr">↓</div>
            <div className="flow-row muted">People · Businesses · Files · Time · Money · Decisions</div>
            <div className="flow-arr">↓</div>
            <div className="flow-row reality">Reality</div>
          </div>
        </div>
      </section>

      {/* ── what ONE does — bento grid ── */}
      <section className="section soft">
        <div className="shell">
          <div className="eyebrow">What ONE does</div>
          <h2>Say it once. ONE carries it to done.</h2>
          <div className="bento">
            <div className="bento-card span-3 dark">
              <div className="bento-visual">
                <Orb size={40} eyeR={12} faceColor="#ffffff" eyeColor="#0f0f0f" />
                <div className="bento-bubble">“Book me a haircut Tuesday.”</div>
              </div>
              <h3>One sentence becomes a process</h3>
              <p>ONE turns what you say into a living process — with a goal, the steps, and the next thing to do.</p>
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
              <p>Not the whole list. The one thing to do now — based on what’s actually happening.</p>
            </div>

            <div className="bento-card span-2">
              <div className="bento-icon">🔒</div>
              <h3>Yours, and private</h3>
              <p>No account needed to start. Sign in when you want ONE to follow you across devices.</p>
            </div>

            <div className="bento-card span-6 row">
              <div className="bento-side">
                <div className="bento-icon">🤝</div>
                <h3>Businesses have a ONE, too</h3>
                <p>
                  Book a haircut, a driving lesson, a move — your ONE talks to the business’s ONE.
                  The booking becomes a card for both of you, and the business sees its customers and followers.
                </p>
              </div>
              <div className="bento-booking" aria-hidden="true">
                <div className="bk-row">
                  <span>💈 Sarah Salon</span>
                  <span className="bk-tag">Tue 18:00</span>
                </div>
                <div className="bk-sub">Booking confirmed · added to both ONEs</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── scene: process is alive ── */}
      <section className="section">
        <div className="shell scene-grid">
          <div>
            <div className="eyebrow">A process is alive</div>
            <h2>Every process has memory, updates, people, files, and a timeline.</h2>
            <p className="lede">
              A process is not a task. It&apos;s the small living structure around
              something you want to move forward — with everything it needs to stay
              alive.
            </p>
            <div className="pc-card" aria-label="Process card example">
              <div className="pc-head">
                <div className="pc-title">
                  <span className="pc-emoji">💪</span>
                  <span>Weight Gain</span>
                </div>
                <div className="pc-time">
                  14:20
                  <span className="pc-badge">2</span>
                </div>
              </div>
              <div className="pc-body">
                Next workout today at 2:00 PM.<br />
                Protein goal reached yesterday.
              </div>
              <div className="pc-foot">
                <div className="pc-relation">Coach Eli +1</div>
                <div className="pc-progress">
                  <div className="pc-track"><div className="pc-fill" /></div>
                  <div className="pc-count">21/32</div>
                </div>
              </div>
              <div className="pc-line" />
            </div>
          </div>
          <PhoneMock variant="process" />
        </div>
      </section>

      {/* ── scene: personal + business ── */}
      <section className="section soft" id="identity">
        <div className="shell scene-grid reverse">
          <PhoneMock variant="identity" />
          <div>
            <div className="eyebrow">Personal and business</div>
            <h2>One agent. Many identities.</h2>
            <p className="lede">
              Use ONE for your personal life — health, learning, home, family,
              legal. Use the same ONE through a business identity — appointments,
              clients, projects, operations. Different worlds, same agent.
            </p>
          </div>
        </div>
      </section>

      {/* ── connections ── */}
      <section className="section" id="connections">
        <div className="shell">
          <div className="eyebrow">The network</div>
          <h2>
            Your ONE can <span className="accent-italic">connect</span> with other ONEs.
          </h2>
          <p className="lede">
            Communication doesn&apos;t have to happen in one big chat with a
            business. Each side has its own ONE. They connect around the specific
            process — a haircut, a clinic visit, a trip — not the whole
            relationship.
          </p>

          <div className="connect">
            <div className="connect-side">
              <div className="connect-orb" />
              <div className="connect-name">Ariel&apos;s ONE</div>
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

          <div className="connect" style={{ marginTop: 24 }}>
            <div className="connect-side">
              <div className="connect-orb" />
              <div className="connect-name">Your ONE</div>
              <div className="connect-role">Personal</div>
              <div className="connect-sub">🏜️ Join Desert Trip</div>
            </div>
            <div className="connect-bridge">
              <div className="connect-bridge-line">↔</div>
              <div className="connect-bridge-label">linked to the official process</div>
            </div>
            <div className="connect-side">
              <div className="connect-orb" />
              <div className="connect-name">Desert Trips&apos; ONE</div>
              <div className="connect-role">Business</div>
              <div className="connect-sub">🏜️ Night Trip — March 12</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── why not just chat ── */}
      <section className="section soft">
        <div className="shell">
          <div className="eyebrow">Why not just a chatbot?</div>
          <h2>
            A chatbot answers and forgets.<br />
            <span className="accent-italic">ONE</span> remembers and follows through.
          </h2>
          <p className="lede">
            A chat ends when you close the tab. A process keeps living — holding the
            files, decisions, people, and the next step until the thing is actually
            done.
          </p>
          <div className="compare">
            <div className="compare-row">
              <div className="compare-cell head">A chat / chatbot</div>
              <div className="compare-cell head">ONE</div>
            </div>
            {[
              ["Organized by who you talked to.", "Organized by what needs to happen."],
              ["Answers from the web, in the moment.", "Works from the real state of your process — and the business's own ONE."],
              ["Important details buried in scroll.", "Files, decisions, next step, people — pinned to the process."],
              ["Closing the chat closes the memory.", "The process keeps the memory, and moves it forward."],
            ].map(([l, r]) => (
              <div className="compare-row" key={l}>
                <div className="compare-cell left">{l}</div>
                <div className="compare-cell right">{r}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── status ── */}
      <section className="section soft" id="status">
        <div className="shell">
          <div className="eyebrow">Where we are</div>
          <h2>An honest map of what ships today.</h2>
          <p className="lede">
            ONE is in open preview. The interface is real, the gestures are native,
            and the flow is complete. The intelligence and the network layer are
            mocked for review — and shipping next.
          </p>
          <div className="status-cols">
            <div className="status-col">
              <h3>Live in this preview</h3>
              <ul className="status-list">
                {[
                  "12-surface interface — drag, swipe, snap",
                  "Multi-identity (Personal · Business · Family)",
                  "Process lifecycle: card → preview → profile → chat",
                  "Attention-sorted feed with broadcast loop",
                  "In-app Privacy, Terms, Account, deletion",
                  "Native bottom-sheet gestures",
                  "Light/dark theme · English / Hebrew RTL",
                ].map((t) => (
                  <li key={t}><span className="mark live">✓</span> {t}</li>
                ))}
              </ul>
            </div>
            <div className="status-col">
              <h3>Coming with v1.0</h3>
              <ul className="status-list">
                {[
                  "Live LLM responses (secured backend)",
                  "Cross-device sync",
                  "Identity-to-identity connections",
                  "Verified business sources (ONE01 network)",
                  "Aggregate process signals — anonymized",
                  "Connectors: Calendar, Email, Drive, Bank",
                  "Native builds on App Store + Play Store",
                ].map((t) => (
                  <li key={t}><span className="mark">○</span> {t}</li>
                ))}
              </ul>
            </div>
          </div>
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
          <a className="btn btn-ghost btn-lg" href="#problem">Read more</a>
        </div>
      </section>

      {/* ── footer ── */}
      <footer>
        <div className="foot-inner">
          <div className="foot-brand">
            <Link href="/" aria-label="ONE01"><Logo height={24} /></Link>
            <p>
              A digital representative that turns intentions into living processes.
              One agent. Many identities. Connected to reality.
            </p>
          </div>
          <div className="foot-col">
            <h4>Product</h4>
            <Link href="/app">Open ONE</Link>
            <a href="#problem">Why ONE</a>
            <a href="#concept">How it works</a>
            <a href="#connections">Connections</a>
            <a href="#status">Where we are</a>
          </div>
          <div className="foot-col">
            <h4>Company</h4>
            <a href="mailto:hello@one01.io">Contact</a>
            <a href="#status">Roadmap</a>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
          <div className="foot-col">
            <h4>Build</h4>
            <a href="#status">Open preview</a>
            <a href="mailto:hello@one01.io?subject=ONE%20feedback">Feedback</a>
            <a href="mailto:hello@one01.io?subject=ONE%20press">Press</a>
            <a href="mailto:hello@one01.io?subject=ONE%20partner">Partnerships</a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 ONE01 Foundation</span>
          <span>From intention to reality.</span>
        </div>
      </footer>
    </>
  );
}
