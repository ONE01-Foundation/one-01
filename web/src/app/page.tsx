"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Orb } from "@/components/Orb";
import { Sheet } from "@/components/product/Sheet";
import { QRCodeSVG } from "qrcode.react";
import { signInWithEmail, signInWithGoogle } from "@/lib/cloud";
import { LANDING_COPY, type Lang, type LandingCopy } from "@/lib/landingCopy";
// DEMO — "Your data, live". Delete this import with the section.
import {
  DEMO_SEED,
  mulberry32,
  nextEvent,
  seedEvents,
  tickStats,
  type PulseEvent,
  type PulseStats,
} from "@/lib/demoPulse";

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
function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

/** Languages in the switcher. English + Hebrew are live; the other three are
    listed so the option is discoverable and flip on once their copy lands. */
const LANGS: { code: string; native: string; short: string; ready: boolean }[] = [
  { code: "en", native: "English", short: "EN", ready: true },
  { code: "he", native: "עברית", short: "עב", ready: true },
  { code: "ru", native: "Русский", short: "RU", ready: false },
  { code: "fr", native: "Français", short: "FR", ready: false },
  { code: "ar", native: "العربية", short: "AR", ready: false },
];

/** Globe/label button that opens a language menu. Used in the nav (with globe)
    and in the footer bar (text only). Closes on outside click or Escape. */
function LangSwitch({
  lang,
  onSelect,
  variant,
  menuLabel,
  soonLabel,
}: {
  lang: Lang;
  onSelect: (code: Lang) => void;
  variant: "nav" | "foot";
  menuLabel: string;
  soonLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <div className={`lang-switch lang-switch-${variant}`} ref={ref}>
      <button
        type="button"
        className={variant === "nav" ? "nav-mode nav-lang" : "foot-ctrl"}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={menuLabel}
      >
        {variant === "nav" && <GlobeIcon />}
        <span>{current.short}</span>
        <svg className="lang-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="lang-menu" role="listbox">
          {LANGS.map((l) => {
            const active = l.code === lang;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={!l.ready}
                  className={`lang-opt${active ? " is-active" : ""}${l.ready ? "" : " is-soon"}`}
                  onClick={() => {
                    if (!l.ready) return;
                    onSelect(l.code as Lang);
                    setOpen(false);
                  }}
                >
                  <span className="lang-opt-name">{l.native}</span>
                  {l.ready ? (
                    active ? (
                      <span className="lang-opt-check" aria-hidden="true">✓</span>
                    ) : null
                  ) : (
                    <span className="lang-opt-soon">{soonLabel}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
type A11ySettings = {
  large: boolean;
  contrast: boolean;
  motion: boolean;
  underline: boolean;
};
const A11Y_DEFAULTS: A11ySettings = { large: false, contrast: false, motion: false, underline: false };
function applyA11y(s: A11ySettings) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const set = (attr: string, on: boolean) => {
    if (on) el.setAttribute(attr, "");
    else el.removeAttribute(attr);
  };
  set("data-a11y-large", s.large);
  set("data-a11y-contrast", s.contrast);
  set("data-a11y-motion", s.motion);
  set("data-a11y-underline", s.underline);
}
function A11yIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="7" r="1.35" fill="currentColor" />
      <path
        d="M6.6 9.6c1.7.8 3.5 1.2 5.4 1.2s3.7-.4 5.4-1.2M12 10.8V15M12 15l-2.1 3.6M12 15l2.1 3.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
/** Footer accessibility menu — display toggles (bigger text, high contrast,
    reduced motion, underlined links) applied to <html> and remembered across
    visits. Replaces the footer's language control; language stays in the nav. */
function A11yMenu({ copy }: { copy: LandingCopy["a11y"] }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(A11Y_DEFAULTS);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("one_web_a11y");
      if (raw) {
        const next = { ...A11Y_DEFAULTS, ...JSON.parse(raw) } as A11ySettings;
        setSettings(next);
        applyA11y(next);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const toggle = (key: keyof A11ySettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      applyA11y(next);
      try {
        localStorage.setItem("one_web_a11y", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const items: { key: keyof A11ySettings; label: string }[] = [
    { key: "large", label: copy.largeText },
    { key: "contrast", label: copy.contrast },
    { key: "motion", label: copy.motion },
    { key: "underline", label: copy.underline },
  ];
  return (
    <div className="lang-switch lang-switch-foot" ref={ref}>
      <button
        type="button"
        className="foot-ctrl foot-ctrl-icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={copy.label}
        onClick={() => setOpen((o) => !o)}
      >
        <A11yIcon />
      </button>
      {open && (
        <ul className="lang-menu a11y-menu" role="menu">
          {items.map((it) => (
            <li key={it.key}>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={settings[it.key]}
                className={`lang-opt a11y-opt${settings[it.key] ? " is-on" : ""}`}
                onClick={() => toggle(it.key)}
              >
                <span className="lang-opt-name">{it.label}</span>
                <span className={`a11y-switch${settings[it.key] ? " is-on" : ""}`} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function YouTubeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.507a3.02 3.02 0 0 0-2.124-2.135C19.505 3.86 12 3.86 12 3.86s-7.505 0-9.376.512A3.02 3.02 0 0 0 .5 6.507 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.493 3.02 3.02 0 0 0 2.124 2.135C4.495 20.14 12 20.14 12 20.14s7.505 0 9.376-.512a3.02 3.02 0 0 0 2.124-2.135A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.493ZM9.6 15.6V8.4l6.223 3.6L9.6 15.6Z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" />
    </svg>
  );
}
/**
 * The closing screen's facing side — ONE doing the things a process is made of
 * (moving, studying, cooking, travelling…). The frame cross-fades through them.
 *
 * EMPTY ON PURPOSE: the artwork isn't in the repo yet. Drop the files into
 * `web/public/one/` and list them here — nothing else needs to change. While
 * this is empty the frame falls back to a plain Orb, so the layout is already
 * final and only the pictures are missing.
 *
 *   { src: "/one/moving.png",   alt: "ONE carrying a box" },
 *   { src: "/one/studying.png", alt: "ONE studying at a desk" },
 */
const CLOSING_SHOTS: { src: string; alt: string }[] = [];

/** The closing-screen face — alive: its eyes follow the cursor, and when the
    mouse is idle it drifts on its own in a slow wander. The loop only runs while
    the orb is on screen (IntersectionObserver), so it costs nothing up top. */
function ClosingOrb({ isDark }: { isDark: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [eye, setEye] = useState({ look: 0, gaze: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    let idle = 999;
    let phase = 0;
    let targetLook = 0;
    let targetGaze = 0;
    let curLook = 0;
    let curGaze = 0;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      targetGaze = clamp(((e.clientX - cx) / (window.innerWidth / 2)) * 1.5);
      targetLook = clamp(((e.clientY - cy) / (window.innerHeight / 2)) * 1.5);
      idle = 0;
    };
    const tick = () => {
      idle += 1;
      // After ~1.5s without the mouse, wander on its own.
      if (idle > 100) {
        phase += 0.01;
        targetGaze = Math.sin(phase) * 0.6;
        targetLook = 0.15 + Math.sin(phase * 0.7) * 0.35;
      }
      curGaze += (targetGaze - curGaze) * 0.08;
      curLook += (targetLook - curLook) * 0.08;
      setEye((prev) =>
        Math.abs(prev.gaze - curGaze) < 0.004 && Math.abs(prev.look - curLook) < 0.004
          ? prev
          : { look: curLook, gaze: curGaze }
      );
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !raf) {
          window.addEventListener("mousemove", onMove);
          raf = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && raf) {
          window.removeEventListener("mousemove", onMove);
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className="final-visual-empty" ref={wrapRef}>
      <Orb
        size={168}
        alive
        look={eye.look}
        gaze={eye.gaze}
        faceColor={isDark ? "#2a2a2a" : "#0a0a0a"}
        eyeColor={isDark ? "#ffffff" : "#f5f4f0"}
        className="final-orb"
      />
    </div>
  );
}

function MonitorIcon() {
  return (
    <svg className="get-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.6" y="4" width="18.8" height="12.4" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 20.5h6M12 16.4v4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg className="get-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6.6" y="2.4" width="10.8" height="19.2" rx="2.8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.6 18.6h2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function CaretIcon() {
  return (
    <svg className="get-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The phone QR — encodes THIS deployment's /app URL (resolved on the client so
    it points wherever the site is actually hosted), with the ONE face set in the
    middle behind a subtle frame. High error-correction keeps it scannable with
    the centre badge. */
function AppQR() {
  const [url, setUrl] = useState("https://one01.io/app");
  useEffect(() => {
    if (typeof window !== "undefined") setUrl(window.location.origin + "/app");
  }, []);
  return (
    <div className="qr">
      <QRCodeSVG value={url} size={168} level="H" marginSize={2} bgColor="#ffffff" fgColor="#121212" />
      <span className="qr-badge" aria-hidden="true">
        <Orb size={30} look={0.7} faceColor="#0a0a0a" eyeColor="#f5f4f0" />
      </span>
    </div>
  );
}

/** The two device buttons ("Desktop" / "Mobile"), each opening a small menu —
    the same dropdown affordance as the language switch. Desktop → open in the
    browser (works today); Mobile → a QR to scan on the phone. Opening one closes
    the other; outside-click / Escape close both. */
function GetOptions({ get }: { get: LandingCopy["download"]["get"] }) {
  const [open, setOpen] = useState<null | "desktop" | "mobile">(null);
  const ref = useRef<HTMLDivElement>(null);
  // Hover opens the menu (mouse only); a short close delay bridges the gap
  // between the button and its menu so it doesn't flicker shut in between.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openItem = (kind: "desktop" | "mobile") => {
    cancelClose();
    setOpen(kind);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  };
  useEffect(() => () => cancelClose(), []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="get-row" ref={ref}>
      <div
        className="get-item"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") openItem("desktop");
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") scheduleClose();
        }}
      >
        <button
          type="button"
          className="get-btn"
          aria-haspopup="menu"
          aria-expanded={open === "desktop"}
          onClick={() => setOpen((o) => (o === "desktop" ? null : "desktop"))}
        >
          <MonitorIcon />
          <span>{get.desktop}</span>
          <CaretIcon />
        </button>
        {open === "desktop" && (
          <div className="get-pop" role="menu">
            <Link className="get-opt" href="/app" role="menuitem">
              <span className="get-opt-l">
                <span className="get-opt-name">{get.browser}</span>
                <span className="get-opt-sub">{get.browserSub}</span>
              </span>
              <span className="get-opt-arrow" aria-hidden="true">→</span>
            </Link>
            <div className="get-opt is-soon">
              <span className="get-opt-l">
                <span className="get-opt-name">{get.desktopApp}</span>
              </span>
              <span className="get-opt-soon">{get.soon}</span>
            </div>
          </div>
        )}
      </div>
      <div
        className="get-item"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") openItem("mobile");
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") scheduleClose();
        }}
      >
        <button
          type="button"
          className="get-btn"
          aria-haspopup="menu"
          aria-expanded={open === "mobile"}
          onClick={() => setOpen((o) => (o === "mobile" ? null : "mobile"))}
        >
          <PhoneIcon />
          <span>{get.mobile}</span>
          <CaretIcon />
        </button>
        {open === "mobile" && (
          <div className="get-pop get-pop-qr get-pop-up" role="menu">
            <div className="qr-tile">
              <AppQR />
            </div>
            <div className="get-qr-cap">{get.scan}</div>
            <div className="get-qr-platforms">{get.platforms}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const heroInputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  // The footer is fixed behind the page; the page reserves exactly its height
  // as bottom spacing so scrolling to the end uncovers it fully. Measured, not
  // guessed, because the footer's height changes as its links wrap.
  const footRef = useRef<HTMLElement>(null);
  // The opening "awakening" owns --p until it finishes; scroll takes over after.
  const introDoneRef = useRef(false);
  const [scrolled, setScrolled] = useState(false);
  // Which pricing plan is hovered — drives the ONE that "grows with you".
  const [hoverPlan, setHoverPlan] = useState<number | null>(null);
  // True once the footer starts being revealed at the end of the scroll. Drives
  // the nav's "arrived" state (Enter CTA fills, wordmark wakes into the ONE
  // face) — the same look as hovering the brand — and relaxes back on scroll up.
  const [atFooter, setAtFooter] = useState(false);
  // True only at the very bottom — squares off the page's rounded bottom corners
  // once the footer is fully revealed (they're rounded during the reveal).
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const router = useRouter();

  // Hero scroll-collapse: as you scroll off the (pinned) hero, ONE centres and
  // shrinks into the splash's black dot while the broadcast, arrows, and input
  // fade — and it all reverses on the way back up, like coming out of the
  // splash. Driven by a --p (0→1) CSS variable set on the hero element via a
  // rAF-throttled scroll listener, so the animation runs in CSS with no React
  // re-render per scroll frame.
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      raf = 0;
      const el = heroRef.current;
      if (!el || !introDoneRef.current) return; // let the awakening own --p first
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.68)));
      el.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ONE's awakening — the opening IS the hero animating in, the exact reverse of
  // the scroll-collapse: ONE starts as a dot at the centre of the screen, then
  // grows/rises into place while its eyes open and the broadcast, input and
  // arrows fade in. No separate splash overlay — it's the home's own elements.
  // Runs on every load; scroll takes over the moment it finishes.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    // Hand --p straight to the current scroll position (no awakening).
    const syncToScroll = () => {
      introDoneRef.current = true;
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.68)));
      el.style.setProperty("--p", p.toFixed(4));
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Only awaken when entering at the very top; if the page loads already
    // scrolled (or reduced-motion is on), skip the animation.
    if (reduce || window.scrollY > 4) {
      syncToScroll();
      return;
    }
    el.style.setProperty("--p", "1"); // start collapsed: a dot at screen centre
    const DURATION = 1050;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min(1, (ts - startTs) / DURATION);
      el.style.setProperty("--p", (1 - ease(t)).toFixed(4));
      if (t < 1) raf = requestAnimationFrame(step);
      else introDoneRef.current = true; // ended at the top → --p=0 is correct
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

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
  const selectLang = (code: Lang) => {
    setLang(code);
    try {
      localStorage.setItem("one_web_lang", code);
    } catch {
      /* ignore */
    }
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

  // DEMO — the "Your data, live" section. Invented numbers that drift upward
  // and a feed that ticks; see src/lib/demoPulse.ts to delete or replace.
  // Seeded state renders identically on server and client (no Math.random at
  // module scope), then only starts moving after mount — otherwise React
  // hydration would mismatch on the very first paint.
  const [stats, setStats] = useState<PulseStats>(DEMO_SEED);
  const [events, setEvents] = useState<PulseEvent[]>(() => seedEvents(mulberry32(7)));
  useEffect(() => {
    const roll = mulberry32(Date.now() & 0xffff);
    let nextId = 100;
    const id = setInterval(() => {
      setStats((s) => tickStats(s, roll));
      setEvents((prev) => {
        const aged = prev.map((e) => ({ ...e, age: e.age + 4 }));
        // A new event only sometimes, so the feed breathes instead of marching.
        if (roll() < 0.6) return [nextEvent(nextId++, roll), ...aged].slice(0, 5);
        return aged.slice(0, 5);
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // The facing shots cross-fade slowly — the only movement on the closing
  // screen, so it reads as ONE being alive rather than as a busy CTA.
  // Mirror the fixed footer's height into --foot-h so .page-layer can reserve
  // exactly that much space below itself for the reveal.
  useEffect(() => {
    const el = footRef.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--foot-h", `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [si, setSi] = useState(0);
  useEffect(() => {
    if (CLOSING_SHOTS.length < 2) return;
    const id = setInterval(() => setSi((i) => (i + 1) % CLOSING_SHOTS.length), 4200);
    return () => clearInterval(id);
  }, []);

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

  // Mobile "get the app" prompt — a dismissible bottom sheet-style banner shown
  // on narrow screens a moment after load, remembered per browser.
  const [showAppBanner, setShowAppBanner] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("one_web_dl_dismissed") === "1";
    } catch {
      /* ignore */
    }
    if (dismissed || typeof window === "undefined" || window.innerWidth > 640) return;
    const timer = setTimeout(() => setShowAppBanner(true), 1200);
    return () => clearTimeout(timer);
  }, []);
  const dismissAppBanner = () => {
    setShowAppBanner(false);
    try {
      localStorage.setItem("one_web_dl_dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  // Global sheet — scrolling UP at the top of the page (or tapping the ↑ chevron)
  // pulls up a full-screen view of the network, like opening Global on mobile.
  const [globalOpen, setGlobalOpen] = useState(false);
  useEffect(() => {
    if (globalOpen) return;
    let acc = 0;
    let t = 0;
    const onWheel = (e: WheelEvent) => {
      if (window.scrollY > 2) {
        acc = 0;
        return;
      }
      if (e.deltaY < 0) {
        acc += -e.deltaY;
        if (acc > 130) {
          acc = 0;
          setGlobalOpen(true);
        }
      } else {
        acc = 0;
      }
      window.clearTimeout(t);
      t = window.setTimeout(() => (acc = 0), 260);
    };
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (window.scrollY > 2) return;
      if ((e.touches[0]?.clientY ?? 0) - startY > 90) setGlobalOpen(true);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.clearTimeout(t);
    };
  }, [globalOpen]);
  useEffect(() => {
    if (!globalOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGlobalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [globalOpen]);

  // Automatic gateway transition: a scroll down inside the hero zone completes
  // the fold-to-a-dot and carries you into the site; a scroll up in that zone
  // brings you back to the hero (re-expanding ONE). We snap to the nearest end
  // of the pinned hero on scroll-stop, by direction, so the collapse never
  // strands you half-way — it always resolves to hero or content.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let lastY = window.scrollY;
    let dir: "up" | "down" = "down";
    let snapping = false;
    let t = 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) dir = y > lastY ? "down" : "up";
      lastY = y;
      if (snapping || globalOpen) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (globalOpen) return;
        const pin = document.querySelector<HTMLElement>(".lhero-pin");
        if (!pin) return;
        const pinH = pin.offsetHeight;
        const y2 = window.scrollY;
        if (y2 <= 2 || y2 >= pinH - 2) return; // already at an end — nothing to resolve
        const target = dir === "up" ? 0 : pinH;
        snapping = true;
        window.scrollTo({ top: target, behavior: "smooth" });
        window.setTimeout(() => (snapping = false), 900);
      }, 140);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
    };
  }, [globalOpen]);

  // Nav pill reveals a little AFTER you leave the hero — not the instant it
  // scrolls out — so the gateway stays clean and the pill feels intentional.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 1.15);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Nav "arrived" state: watch the transparent foot-spacer (whose height mirrors
  // the fixed footer). The moment it enters the viewport the footer is being
  // uncovered, so the nav lights up; it turns back off as you scroll away.
  useEffect(() => {
    const spacer = document.querySelector(".foot-spacer");
    if (!spacer || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setAtFooter(e.isIntersecting), {
      threshold: 0,
    });
    io.observe(spacer);
    return () => io.disconnect();
  }, []);

  // Round the page's bottom corners while the footer is being revealed, then
  // square them off at the very end of the scroll so it sits flush on the footer.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      setScrolledToEnd(window.innerHeight + window.scrollY >= doc.scrollHeight - 4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Touch/hover the revealed footer strip → smooth-scroll the rest of the way,
  // so the footer opens all the way on its own (a "grab the footer" gesture).
  const revealFooter = () => {
    if (typeof window === "undefined" || scrolledToEnd || !atFooter) return;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  };

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

  // Film section: a scroll-linked parallax — the frame expands toward full width
  // as it reaches the middle of the viewport and contracts as it leaves. Sets a
  // 0..1 `--fp` on the frame; the scale itself lives in CSS.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".why-video");
    if (!el) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const center = r.top + r.height / 2;
      const dist = Math.abs(center - vh / 2) / (vh / 2 + r.height / 2);
      el.style.setProperty("--fp", Math.max(0, Math.min(1, 1 - dist)).toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* The whole page is an opaque layer that sits ABOVE the fixed footer and
          slides up off it at the end of the scroll — the Wolt "reveal" effect.
          It needs a solid background and a positive z-index so the fixed footer
          (z-index 0) stays hidden behind it until the last screen. */}
      <div className={`page-layer${scrolledToEnd ? " at-end" : ""}`}>
      {/* ── nav — floating pill, revealed after scrolling into the content ── */}
      <nav className={`nav${scrolled ? " is-scrolled" : ""}${atFooter ? " is-footer" : ""}${scrolledToEnd ? " is-end" : ""}`}>
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
            <LangSwitch
              lang={lang}
              onSelect={selectLang}
              variant="nav"
              menuLabel={t.aria.langMenu}
              soonLabel={t.aria.langSoon}
            />
            <Link className="btn btn-primary" href="/app">{t.nav.enter}</Link>
          </div>
        </div>
      </nav>

      {/* ── hero — the gateway: ONE centre-stage, ready to start ── */}
      <div className="lhero-pin">
      <section className="lhero" ref={heroRef} style={{ ["--p" as string]: 1 } as React.CSSProperties}>
        <div className="lhero-core">
          <button
            type="button"
            className="lhero-chev up"
            onClick={() => setGlobalOpen(true)}
            aria-label={t.global.hint}
          >
            <ChevronUp />
          </button>
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
                dir="auto"
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
      </div>

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
      {/* ── why ONE — the film IS the section: one full-screen poster ── */}
      <section className="section center reveal why-section" id="problem">
        <div className="shell">
          {/* The frame is the stage. Drop the footage in as a first child
              <video src="…" poster="…" playsInline /> — it fills the frame and
              sits UNDER the poster, which carries the copy on a dark scrim. */}
          <div className="why-video">
            <div className="why-poster">
              {/* The copy is nested one level down so it can be counter-scaled:
                  the frame grows on hover, this cancels that growth back out, so
                  the box gets bigger and the text does not. */}
              <div className="why-poster-inner">
                <h2 className="why-title">{t.thesis.title}</h2>
                <p className="why-lede">{t.thesis.lede}</p>
              </div>
            </div>
            {/* The whole frame plays — no play button; hovering grows the frame
                and dims the copy, and that IS the affordance. The transparent
                button covers the frame rather than wrapping the copy, because a
                <button> may only contain phrasing content (an <h2> inside one is
                invalid), and it keeps the control keyboard-reachable. */}
            <button type="button" className="why-play-target" aria-label={t.thesis.playAria} />
          </div>
        </div>
      </section>

      {/* ── the whole idea as three themed bentos, stacked: what ONE does
             (capabilities) → the worlds it represents you across → the network
             of ONEs. Each group is a centered header over its own grid; tiles
             carry an icon, a title, and a supporting line. ── */}
      <section className="section center reveal" id="identity">
        <div className="shell">
          <div className="bento bento-one">
            {/* One heading, living inside the grid as a full-width intro cell. */}
            <div className="bento-tile bento-full bento-head-cell">
              <h2>{t.bento.h2}</h2>
              <p className="lede">{t.bento.lede}</p>
              <div className="bento-points">
                {t.bento.points.map((p, i) => (
                  <span key={i}>{p}</span>
                ))}
              </div>
            </div>
            {t.bento.tiles.map((tile) => {
              const cls = [
                "bento-tile",
                tile.span ? `bento-${tile.span}` : "",
                tile.variant ? `bento-${tile.variant}` : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div className={cls} key={tile.key}>
                  {tile.variant === "core" ? (
                    <div className="bento-core-orb">
                      <Orb size={54} faceColor={isDark ? "#2a2a2a" : "#0a0a0a"} eyeColor={isDark ? "#ffffff" : "#f5f4f0"} />
                    </div>
                  ) : tile.icon ? (
                    <i className={`fi ${tile.icon} bento-icon`} aria-hidden="true" />
                  ) : null}
                  {tile.label ? <div className="bento-key">{tile.label}</div> : null}
                  <h3>{tile.title}</h3>
                  {tile.text ? <p>{tile.text}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── businesses connect (the network in action) ── */}
      <section className="section center reveal" id="connections">
        {/* The system, breathing — live (demo) numbers and a running feed. The
            "Demo data" tag stays: invented numbers shown as live have to say so. */}
        <div className="shell live-block">
          <div className="live-head">
            <h3 className="live-title">{t.pulse.h2}</h3>
            <span className="pulse-demo-tag">{t.pulse.demoTag}</span>
          </div>
          <p className="lede">{t.pulse.lede}</p>
          <div className="pulse-stats">
            {t.pulse.stats.map((s) => (
              <div className="pulse-stat" key={s.key}>
                <div className="pulse-num">{stats[s.key as keyof PulseStats].toLocaleString()}</div>
                <div className="pulse-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="pulse-feed">
            <div className="pulse-feed-head">
              <span className="pulse-feed-title">{t.pulse.timelineTitle}</span>
              <span className="pulse-live">
                <span className="pulse-dot" aria-hidden="true" />
                {t.pulse.liveLabel}
              </span>
            </div>
            <ul className="pulse-list">
              {events.map((e) => (
                <li className="pulse-row" key={e.id}>
                  <span className="pulse-row-dot" aria-hidden="true" />
                  <span className="pulse-row-text">{t.pulse.events[e.key]}</span>
                  <span className="pulse-row-age">
                    {e.age < 60 ? t.pulse.justNow : t.pulse.minsAgo.replace("{n}", String(Math.floor(e.age / 60)))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── pricing ── */}
      <section className="section center reveal" id="pricing">
        <div className="shell">
          <h2>{t.pricing.h2}</h2>
          {/* The ONE literally grows with the plan you hover — Free small, Pro
              big — a live picture of "grows with you". */}
          <div className="pricing-orb" aria-hidden="true">
            <div
              className="pricing-orb-inner"
              style={{ transform: `scale(${hoverPlan === 0 ? 0.82 : hoverPlan === 2 ? 1.32 : 1})` }}
            >
              <Orb size={92} alive faceColor={isDark ? "#2a2a2a" : "#0a0a0a"} eyeColor={isDark ? "#ffffff" : "#f5f4f0"} />
            </div>
          </div>
          <div className="plans">
            {t.pricing.plans.map((p, i) => {
              const featured = i === 2;
              const per = i === 0 ? t.pricing.perForever : t.pricing.perMonth;
              const btnClass = featured ? "btn btn-primary" : "btn btn-ghost";
              // Metallic tier ladder on the plan name: Free quiet, Plus silver,
              // Pro mustard-gold.
              const nameTier = i === 2 ? "plan-name-pro" : i === 1 ? "plan-name-plus" : "plan-name-free";
              return (
                <div
                  className={`plan${featured ? " plan-featured" : ""}${i === 0 ? " plan-plain" : ""}`}
                  key={p.name}
                  onMouseEnter={() => setHoverPlan(i)}
                  onMouseLeave={() => setHoverPlan(null)}
                >
                  <div className={`plan-name ${nameTier}`}>{p.name}</div>
                  <div className="plan-price">
                    {p.price}
                    <small>{per}</small>
                  </div>
                  <p className="plan-blurb">{p.blurb}</p>
                  <div className="plan-feats">
                    {p.feats.map((f, fi) => (
                      <span key={fi}>
                        <i className={`fi ${f.icon} plan-feat-ico`} aria-hidden="true" />
                        {f.label}
                      </span>
                    ))}
                  </div>
                  <Link className={btnClass} href="/app">{p.cta}</Link>
                </div>
              );
            })}
          </div>
          {/* Tailored tier — a quiet line + link under the cards, mirroring the
              hero's "have a ONE? sign in" affordance. */}
          <p className="plan-enterprise">
            {t.pricing.enterprise.line}{" "}
            <Link className="lhero-link" href="/app">{t.pricing.enterprise.cta}</Link>
          </p>
        </div>
      </section>

      {/* ── FAQ — expandable drawers below the plans (native <details>) ── */}
      <section className="section center reveal faq-section">
        <div className="shell narrow">
          <h2>{t.faq.title}</h2>
          <div className="faq-list">
            {t.faq.items.map((item, i) => (
              <details className="faq-item" key={i}>
                <summary className="faq-q">
                  <span>{item.q}</span>
                  <svg className="faq-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <p className="faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── newsroom — a moving row of updates, partnerships, and releases,
             below the plans as a momentum beat before the closing CTA.
             Data-driven from news.items; loops seamlessly; pauses on hover;
             holds still under reduced-motion. ── */}
      <section className="section center reveal news-section">
        <div className="news-marquee">
          <div className="news-track">
            {[...t.news.items, ...t.news.items].map((item, i) => (
              <article
                className="news-card"
                key={`${item.title}-${i}`}
                aria-hidden={i >= t.news.items.length}
              >
                <span className="news-tag">{item.tag}</span>
                <h3 className="news-card-title">{item.title}</h3>
                <span className="news-date">{item.date}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── the closing screen — one headline, one subtitle, three buttons.
             The footer is wrapped in with it so the two SHARE one viewport and
             the page ends on a single screen, rather than the footer starting
             a second one. ── */}
      <div className="closing">
      <section className="final reveal">
        <div className="final-grid">
          <div className="final-copy">
            {/* One sentence over two lines — the lead muted, the payoff solid.
                Nothing rotates: this is the CTA, and movement here would pull
                the eye off the buttons. */}
            <h2 className="final-title">
              <span className="final-lead">{t.download.titleLead}</span>
              {t.download.titleRest}
            </h2>
            <p className="lede">{t.download.sub}</p>
            {/* Two device buttons — each opens a small menu: Desktop → open in
                the browser (works today); Mobile → a QR to scan on the phone. */}
            <GetOptions get={t.download.get} />
          </div>

          {/* The facing side — ONE doing the things a process is made of.
              Empty until the art lands, so it falls back to the plain Orb and
              the layout is already correct. See CLOSING_SHOTS. */}
          <div className="final-visual" aria-hidden={CLOSING_SHOTS.length === 0}>
            {CLOSING_SHOTS.length > 0 ? (
              CLOSING_SHOTS.map((shot, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={shot.src}
                  className={`final-shot${i === si % CLOSING_SHOTS.length ? " is-on" : ""}`}
                  src={shot.src}
                  alt={i === si % CLOSING_SHOTS.length ? shot.alt : ""}
                />
              ))
            ) : (
              <ClosingOrb isDark={isDark} />
            )}
          </div>
        </div>
      </section>
      </div>
      </div>

      {/* Transparent spacer the height of the footer — scrolling through it
          uncovers the fixed footer beneath the page layer. A real element (not
          a margin) so it can't collapse away. */}
      <div className="foot-spacer" aria-hidden="true" />

      {/* ── footer — full-bleed, fixed at the bottom BEHIND the page layer.
             It's uncovered as the page scrolls up off it (see .page-layer). No
             rounded corners, no reveal class — the scroll itself is the reveal. ── */}
      <footer className="foot foot-rich" ref={footRef}>
        <div className="foot-center">
          <div className="foot-top">
            <div className="foot-brand">
              <Link href="/" aria-label="ONE01" className="foot-logo">
                <Logo height={26} interactive />
              </Link>
              <p className="foot-company">{t.foot.company}</p>
            </div>
            <div className="foot-cols">
              {t.foot.cols.map((col) => (
                <div className="foot-col" key={col.title}>
                  <div className="foot-col-title">{col.title}</div>
                  <ul>
                    {col.links.map((link) => (
                      <li key={`${col.title}-${link.label}`}>
                        <Link href={link.href}>{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="foot-bar" onPointerEnter={revealFooter}>
            <div className="foot-bar-actions">
              <a
                className="foot-social-link"
                href="https://x.com/one01_io"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
              >
                <XIcon />
              </a>
              <a
                className="foot-social-link"
                href="https://youtube.com/@one01_io"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
              >
                <YouTubeIcon />
              </a>
              <a
                className="foot-social-link"
                href="https://instagram.com/one01_io"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <InstagramIcon />
              </a>
            </div>
            <span className="foot-copy">{t.foot.copy}</span>
            <div className="foot-bar-controls">
              <A11yMenu copy={t.a11y} />
              <button
                type="button"
                className="foot-ctrl foot-ctrl-icon"
                onClick={toggleTheme}
                aria-label={isDark ? t.aria.toLight : t.aria.toDark}
              >
                {isDark ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile-only "get the app" banner — appears a moment after load. */}
      {showAppBanner && (
        <div className="dl-banner" role="dialog" aria-label={t.mobileBanner.title}>
          <span className="dl-banner-orb" aria-hidden="true">
            <Orb size={38} faceColor={isDark ? "#2a2a2a" : "#0a0a0a"} eyeColor={isDark ? "#ffffff" : "#f5f4f0"} />
          </span>
          <div className="dl-banner-text">
            <div className="dl-banner-title">{t.mobileBanner.title}</div>
            <div className="dl-banner-sub">{t.mobileBanner.sub}</div>
          </div>
          <Link className="dl-banner-cta" href="/app">{t.mobileBanner.cta}</Link>
          <button className="dl-banner-close" onClick={dismissAppBanner} aria-label={t.mobileBanner.dismiss}>
            ✕
          </button>
        </div>
      )}

      {/* Global — a full-screen network view pulled up by scrolling up at the top. */}
      <div className={`gsheet${globalOpen ? " open" : ""}`} aria-hidden={!globalOpen}>
        <div className="gsheet-scrim" onClick={() => setGlobalOpen(false)} />
        <div
          className="gsheet-panel"
          role="dialog"
          aria-modal="true"
          aria-label={t.global.title}
          onWheel={(e) => {
            if (e.currentTarget.scrollTop <= 0 && e.deltaY > 40) setGlobalOpen(false);
          }}
        >
          <button className="gsheet-grab" onClick={() => setGlobalOpen(false)} aria-label="Close Global" />
          <button className="gsheet-close" onClick={() => setGlobalOpen(false)} aria-label="Close">
            ✕
          </button>
          <div className="gsheet-inner">
            <h2 className="gsheet-title">{t.global.title}</h2>
            <p className="gsheet-sub">{t.global.sub}</p>
            <div className="connect gsheet-connect">
              <div className="connect-side">
                <div className="connect-orb" />
                <div className="connect-name">{t.network.yourOne}</div>
                <div className="connect-role">{t.network.yourRole}</div>
                <div className="connect-sub"><i className={`fi ${t.network.yourProcessIcon} connect-ico`} aria-hidden="true" />{t.network.yourProcess}</div>
              </div>
              <div className="connect-bridge">
                <div className="connect-bridge-line">↔</div>
                <div className="connect-bridge-label">{t.network.connectedLabel}</div>
              </div>
              <div className="connect-side">
                <div className="connect-orb" />
                <div className="connect-name">{t.network.providerName}</div>
                <div className="connect-role">{t.network.providerRole}</div>
                <div className="connect-sub"><i className={`fi ${t.network.providerStatusIcon} connect-ico`} aria-hidden="true" />{t.network.providerStatus}</div>
              </div>
            </div>
            <Link className="btn btn-primary btn-lg gsheet-cta" href="/app">{t.global.cta}</Link>
          </div>
        </div>
      </div>
    </>
  );
}
