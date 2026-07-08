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
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14.5A8 8 0 019.5 4a7 7 0 100 16 8 8 0 0010.5-5.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export default function LandingPage() {
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  // Ready to type from the moment ONE appears — focus (blinking caret) without
  // yanking the page's scroll position.
  useEffect(() => {
    const t = setTimeout(() => heroInputRef.current?.focus({ preventScroll: true }), 300);
    return () => clearTimeout(t);
  }, []);

  // Theme: time-of-day by default (dark 18:00–06:00, like the app), with a
  // manual light/dark override the user can toggle from the nav.
  const [mode, setMode] = useState<"auto" | "light" | "dark">("auto");
  const [isDark, setIsDark] = useState(false);
  const darkByClock = () => {
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  };
  useEffect(() => {
    try {
      const s = localStorage.getItem("one_web_theme");
      if (s === "light" || s === "dark") setMode(s);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const applyTheme = () => {
      const dark = mode === "auto" ? darkByClock() : mode === "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      setIsDark(dark);
    };
    applyTheme();
    if (mode === "auto") {
      const t = setInterval(applyTheme, 60_000);
      return () => clearInterval(t);
    }
  }, [mode]);
  const toggleTheme = () => {
    setMode((prev) => {
      const curDark = prev === "auto" ? darkByClock() : prev === "dark";
      const next = curDark ? "light" : "dark";
      try {
        localStorage.setItem("one_web_theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // The gateway: type an intention → step into the product with it in hand.
  const [heroDraft, setHeroDraft] = useState("");
  const [heroFocused, setHeroFocused] = useState(false);
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

  // Nav pill reveals a little AFTER you leave the hero — not the instant it
  // scrolls out — so the gateway stays clean and the pill feels intentional.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 1.15);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Content floats up into place as it enters the viewport (free scroll).
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Splash bg="var(--bg)" padBottom="22vh" />
      {/* ── nav — floating pill, revealed after scrolling into the content ── */}
      <nav className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="nav-brand" aria-label="ONE01">
            <Logo height={22} interactive />
          </Link>
          <div className="nav-actions">
            <a className="nav-link" href="#problem">ONE</a>
            <a className="nav-link" href="#identity">Life</a>
            <a className="nav-link" href="#connections">Business</a>
            <a className="nav-link" href="#pricing">Pricing</a>
            <button
              type="button"
              className="nav-mode"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light" : "Switch to dark"}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link className="btn btn-primary" href="/app">Enter</Link>
          </div>
        </div>
      </nav>

      {/* ── hero — the gateway: ONE centre-stage, ready to start ── */}
      <section className="lhero">
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
            <span className="lhero-inputwrap">
              {!heroDraft && !heroFocused && <span className="lhero-caret" aria-hidden="true" />}
              <input
                ref={heroInputRef}
                className="lhero-input"
                aria-label="Tell ONE what you want to move forward"
                value={heroDraft}
                onChange={(e) => setHeroDraft(e.target.value)}
                onFocus={() => setHeroFocused(true)}
                onBlur={() => setHeroFocused(false)}
              />
            </span>
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
      <section className="section center reveal" id="problem">
        <div className="shell narrow">
          <div className="eyebrow">Why ONE</div>
          <h2>
            One for everything.<br />
            Everything in <span className="accent-italic">one</span>.
          </h2>
          <p className="lede">
            Your goals, chats, files, and appointments live in a dozen places —
            held together by your memory. ONE gives every intention one place to
            live, and quietly moves it forward.
          </p>
        </div>
      </section>

      {/* ── concepts: the vocabulary (ONE · Units · Global) ── */}
      <section className="section center reveal" id="concept">
        <div className="shell">
          <div className="eyebrow">The idea</div>
          <h2>Three words. One system.</h2>
          <div className="concepts">
            <div className="concept">
              <div className="concept-key">ONE</div>
              <h3>Digital representative</h3>
              <p>Your agent. You speak in plain words; ONE understands what you mean and acts on your behalf.</p>
            </div>
            <div className="concept">
              <div className="concept-key">Units</div>
              <h3>Living processes</h3>
              <p>Each goal becomes a Unit — a small living process holding its steps, files, people, and next move.</p>
            </div>
            <div className="concept">
              <div className="concept-key">Global</div>
              <h3>The network</h3>
              <p>Units connect to other ONEs — people and businesses — so things move between you, not inside one app.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ONE for Life / ONE for Business ── */}
      <section className="section center reveal" id="identity">
        <div className="shell">
          <div className="eyebrow">One agent, many identities</div>
          <h2>ONE for Life. ONE for Business.</h2>
          <p className="lede">
            The same ONE, in different worlds — switch identities without switching apps.
          </p>
          <div className="duo">
            <div className="duo-card">
              <span className="duo-tag">👤 ONE for Life</span>
              <h3>Your personal life, handled</h3>
              <p>Health, learning, home, family, errands, legal. Say what you want to move forward — ONE keeps every process alive and shows you the next step.</p>
              <div className="duo-list">
                <span>Book appointments and track them to done</span>
                <span>Licenses, moving, travel, health goals</span>
                <span>Remembers your people, files, and decisions</span>
              </div>
            </div>
            <div className="duo-card">
              <span className="duo-tag">🏢 ONE for Business</span>
              <h3>Your business has a ONE, too</h3>
              <p>Give your business its own ONE. Customers&apos; ONEs talk to it — bookings, followers, and a customer list, without a call centre.</p>
              <div className="duo-list">
                <span>Bookings become cards for both sides</span>
                <span>See your followers and customers</span>
                <span>Describe your business once — it&apos;s live</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── businesses connect (the network in action) ── */}
      <section className="section center reveal" id="connections">
        <div className="shell narrow">
          <div className="eyebrow">The network</div>
          <h2>
            Your ONE talks to <span className="accent-italic">their</span> ONE.
          </h2>
          <p className="lede">
            Book a haircut, a driving lesson, a move — your ONE connects to the
            business&apos;s ONE around the process itself, and the booking becomes a
            card for both of you.
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

      {/* ── pricing ── */}
      <section className="section center reveal" id="pricing">
        <div className="shell">
          <div className="eyebrow">Plans</div>
          <h2>Start free. Grow when you&apos;re ready.</h2>
          <div className="plans">
            <div className="plan">
              <div className="plan-name">ONE Free</div>
              <div className="plan-price">$0<small> / forever</small></div>
              <p className="plan-blurb">Move your first things forward — no account needed.</p>
              <div className="plan-feats">
                <span>Unlimited processes</span>
                <span>One personal identity</span>
                <span>Works on this device</span>
              </div>
              <Link className="btn btn-ghost" href="/app">Start free</Link>
            </div>
            <div className="plan plan-featured">
              <div className="plan-name">ONE Plus</div>
              <div className="plan-price">$8<small> / month</small></div>
              <p className="plan-blurb">Your whole life, synced and remembered everywhere.</p>
              <div className="plan-feats">
                <span>Everything in Free</span>
                <span>Sync across all your devices</span>
                <span>Full memory &amp; history</span>
                <span>Connect calendar, email, files</span>
              </div>
              <Link className="btn btn-primary" href="/app">Start with Plus</Link>
            </div>
            <div className="plan">
              <div className="plan-name">ONE Business</div>
              <div className="plan-price">$29<small> / month</small></div>
              <p className="plan-blurb">Give your business a ONE customers can reach.</p>
              <div className="plan-feats">
                <span>Everything in Plus</span>
                <span>Business identity + bookings</span>
                <span>Followers &amp; customer list</span>
                <span>Team access</span>
              </div>
              <Link className="btn btn-ghost" href="/app">Add Business</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── status ── */}
      <section className="section center reveal" id="status">
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
      <section className="final reveal">
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
            <svg width="40" height="40" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="50" fill="var(--orb)" />
              <circle className="foot-eye" cx="34" cy="45" r="12" fill="var(--orb-eye)" />
              <circle className="foot-eye" cx="66" cy="45" r="12" fill="var(--orb-eye)" />
            </svg>
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
