"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Orb } from "@/components/Orb";
import { Splash } from "@/components/Splash";
import { Sheet } from "@/components/product/Sheet";
import { DocsPanel } from "@/components/DocsPanel";
import { signInWithEmail, signInWithGoogle } from "@/lib/cloud";
import { LANDING_COPY, type Lang } from "@/lib/landingCopy";
import { DOCS, type DocGroupId } from "@/lib/docsContent";

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

  // Language: Hebrew-first product, English default on the web with a manual
  // toggle. On first load we honour a saved choice, else the browser language.
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    let initial: Lang = "en";
    try {
      const s = localStorage.getItem("one_web_lang");
      if (s === "en" || s === "he") initial = s;
      else if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("he"))
        initial = "he";
    } catch {
      /* ignore */
    }
    setLang(initial);
  }, []);
  const t = LANDING_COPY[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;
  }, [lang, t.dir]);
  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === "he" ? "en" : "he";
      try {
        localStorage.setItem("one_web_lang", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

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

  // Time-aware greeting, resolved on the client to avoid an SSR/hydration
  // mismatch (starts as a neutral "hello" until the hour is known).
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);
  const greeting =
    hour == null
      ? t.hero.greetings.hello
      : hour < 12
      ? t.hero.greetings.morning
      : hour < 18
      ? t.hero.greetings.afternoon
      : t.hero.greetings.evening;

  // ONE's rotating "broadcast" in the hero (fades between lines), like the app.
  const heroLines = useMemo(() => [greeting, ...t.hero.prompts], [greeting, t]);
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

  // Footer doc panel (About / Support / Legal) — GitBook-style side panel.
  const [docsGroup, setDocsGroup] = useState<DocGroupId | null>(null);

  // Sign-in popup (opened by tapping the Orb), mirroring the mobile SignInSheet.
  const [signInOpen, setSignInOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setAuthMsg(t.signin.sending);
    const res = await signInWithEmail(email.trim());
    setAuthMsg(res.ok ? t.signin.sent : res.error ?? t.signin.failed);
  };

  const startWith = (text: string) => {
    const s = text.trim();
    router.push(s ? `/app?q=${encodeURIComponent(s)}` : "/app");
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
          <div className="nav-links">
            <a className="nav-link" href="#problem">{t.nav.one}</a>
            <a className="nav-link" href="#identity">{t.nav.life}</a>
            <a className="nav-link" href="#connections">{t.nav.business}</a>
            <a className="nav-link" href="#pricing">{t.nav.pricing}</a>
          </div>
          <div className="nav-right">
            <button
              type="button"
              className="nav-mode nav-lang"
              onClick={toggleLang}
              aria-label={t.aria.switchLang}
            >
              {t.aria.langLabel}
            </button>
            <button
              type="button"
              className="nav-mode"
              onClick={toggleTheme}
              aria-label={isDark ? t.aria.toLight : t.aria.toDark}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link className="btn btn-primary" href="/app">{t.nav.enter}</Link>
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
            <Orb
              size={84}
              eyeR={11}
              alive
              className="lhero-orb"
              faceColor={isDark ? "#2a2a2a" : "#0a0a0a"}
              eyeColor={isDark ? "#ffffff" : "#f5f4f0"}
            />
          </button>
          <p className={`lhero-line${bfade ? " is-fading" : ""}`}>{heroLines[bi % heroLines.length]}</p>
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
                aria-label={t.hero.inputAria}
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
            {t.hero.noAccount} ·{" "}
            <button type="button" className="lhero-link" onClick={() => setSignInOpen(true)}>
              {t.hero.haveOne}
            </button>
          </p>
        </div>
      </section>

      {/* Sign-in popup — opened by tapping the Orb, mirroring the mobile sheet. */}
      <Sheet open={signInOpen} onClose={() => setSignInOpen(false)}>
        <div className="signin">
          <Orb
            size={64}
            eyeR={11}
            faceColor={isDark ? "#2a2a2a" : "#0a0a0a"}
            eyeColor={isDark ? "#ffffff" : "#f5f4f0"}
          />
          <h3 className="signin-title">{t.signin.title}</h3>
          <p className="signin-sub">{t.signin.sub}</p>
          <button className="signin-google" onClick={() => signInWithGoogle()}>
            <GoogleG /> {t.signin.google}
          </button>
          <div className="signin-or"><span>{t.signin.or}</span></div>
          <div className="signin-mail">
            <input
              className="signin-input"
              type="email"
              placeholder={t.signin.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
            />
            <button className="signin-send" onClick={sendMagicLink}>{t.signin.send}</button>
          </div>
          {authMsg && <p className="signin-msg">{authMsg}</p>}
        </div>
      </Sheet>

      {/* ── thesis ── */}
      <section className="section center reveal" id="problem">
        <div className="shell narrow">
          <div className="eyebrow">{t.thesis.eyebrow}</div>
          <h2>
            {t.thesis.line1}<br />
            {t.thesis.line2pre}<span className="accent-italic">{t.thesis.accent}</span>{t.thesis.line2post}
          </h2>
          <p className="lede">{t.thesis.lede}</p>
        </div>
      </section>

      {/* ── concepts: the vocabulary (ONE · Units · Global) ── */}
      <section className="section center reveal" id="concept">
        <div className="shell">
          <div className="eyebrow">{t.concepts.eyebrow}</div>
          <h2>{t.concepts.h2}</h2>
          <div className="concepts">
            {t.concepts.items.map((c) => (
              <div className="concept" key={c.key}>
                <div className="concept-key">{c.key}</div>
                <h3>{c.h3}</h3>
                <p>{c.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ONE for Life / ONE for Business ── */}
      <section className="section center reveal" id="identity">
        <div className="shell">
          <div className="eyebrow">{t.duo.eyebrow}</div>
          <h2>{t.duo.h2}</h2>
          <p className="lede">{t.duo.lede}</p>
          <div className="duo">
            <div className="duo-card">
              <span className="duo-tag">{t.duo.life.tag}</span>
              <h3>{t.duo.life.h3}</h3>
              <p>{t.duo.life.p}</p>
              <div className="duo-list">
                {t.duo.life.list.map((li, i) => (
                  <span key={i}>{li}</span>
                ))}
              </div>
            </div>
            <div className="duo-card">
              <span className="duo-tag">{t.duo.business.tag}</span>
              <h3>{t.duo.business.h3}</h3>
              <p>{t.duo.business.p}</p>
              <div className="duo-list">
                {t.duo.business.list.map((li, i) => (
                  <span key={i}>{li}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── businesses connect (the network in action) ── */}
      <section className="section center reveal" id="connections">
        <div className="shell narrow">
          <div className="eyebrow">{t.network.eyebrow}</div>
          <h2>
            {t.network.h2pre}<span className="accent-italic">{t.network.h2accent}</span>{t.network.h2post}
          </h2>
          <p className="lede">{t.network.lede}</p>
          <div className="connect" style={{ marginTop: 48 }}>
            <div className="connect-side">
              <div className="connect-orb" />
              <div className="connect-name">{t.network.yourOne}</div>
              <div className="connect-role">{t.network.yourRole}</div>
              <div className="connect-sub">{t.network.yourProcess}</div>
            </div>
            <div className="connect-bridge">
              <div className="connect-bridge-line">↔</div>
              <div className="connect-bridge-label">{t.network.connectedLabel}</div>
            </div>
            <div className="connect-side">
              <div className="connect-orb" />
              <div className="connect-name">{t.network.providerName}</div>
              <div className="connect-role">{t.network.providerRole}</div>
              <div className="connect-sub">{t.network.providerStatus}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── pricing ── */}
      <section className="section center reveal" id="pricing">
        <div className="shell">
          <div className="eyebrow">{t.pricing.eyebrow}</div>
          <h2>{t.pricing.h2}</h2>
          <div className="plans">
            {t.pricing.plans.map((p, i) => {
              const featured = i === 1;
              const per = i === 0 ? t.pricing.perForever : t.pricing.perMonth;
              const btnClass = featured ? "btn btn-primary" : "btn btn-ghost";
              return (
                <div className={featured ? "plan plan-featured" : "plan"} key={p.name}>
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-price">
                    {p.price}
                    <small>{per}</small>
                  </div>
                  <p className="plan-blurb">{p.blurb}</p>
                  <div className="plan-feats">
                    {p.feats.map((f, fi) => (
                      <span key={fi}>{f}</span>
                    ))}
                  </div>
                  <Link className={btnClass} href="/app">{p.cta}</Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── status ── */}
      <section className="section center reveal" id="status">
        <div className="shell narrow">
          <div className="eyebrow">{t.status.eyebrow}</div>
          <h2>{t.status.h2}</h2>
          <p className="lede">{t.status.lede}</p>
        </div>
      </section>

      {/* ── final CTA ── */}
      <section className="final reveal">
        <h2>
          {t.final.pre}<span className="accent-italic">{t.final.accent}</span>{t.final.post}
        </h2>
        <p className="lede">{t.final.lede}</p>
        <div className="final-ctas">
          <Link className="btn btn-primary btn-lg" href="/app">{t.final.cta}</Link>
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
            <button type="button" onClick={() => setDocsGroup("about")}>{t.foot.about}</button>
            <button type="button" onClick={() => setDocsGroup("support")}>{t.foot.support}</button>
            <button type="button" onClick={() => setDocsGroup("legal")}>{t.foot.legal}</button>
          </nav>
          <span className="foot-copy">© 2026 ONE01</span>
        </div>
      </footer>

      {/* Footer doc panel — About / Support / Legal, GitBook-style side panel. */}
      <DocsPanel openGroup={docsGroup} onClose={() => setDocsGroup(null)} docs={DOCS[lang]} />
    </>
  );
}
