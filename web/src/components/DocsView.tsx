"use client";

/**
 * DocsView — a real docs PAGE (not a popup) for About / Support / Legal, in the
 * site's own style: a floating-pill header, the unified background, a GitBook-
 * style section sidebar (the only "panel" — it navigates the sections inside),
 * a content pane, and the site footer. Each footer link is its own route
 * (/about, /support, /legal) that opens on that group's first section.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LANDING_COPY, type Lang } from "@/lib/landingCopy";
import { DOCS, type DocGroupId } from "@/lib/docsContent";

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

export function DocsView({ initialGroup }: { initialGroup: DocGroupId }) {
  // Language — shares the landing's choice (localStorage + browser default).
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
  const docs = DOCS[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;
  }, [lang, t.dir]);
  const toggleLang = () =>
    setLang((prev) => {
      const next = prev === "he" ? "en" : "he";
      try {
        localStorage.setItem("one_web_lang", next);
      } catch {
        /* ignore */
      }
      return next;
    });

  // Theme — same time-of-day default + manual override as the landing.
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
    const apply = () => {
      const dark = mode === "auto" ? darkByClock() : mode === "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      setIsDark(dark);
    };
    apply();
    if (mode === "auto") {
      const id = setInterval(apply, 60_000);
      return () => clearInterval(id);
    }
  }, [mode]);
  const toggleTheme = () =>
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

  // Which section is open. Ids are language-independent, so this survives a
  // language switch. Starts at the routed group's first section.
  const [pageId, setPageId] = useState<string>(
    () => DOCS.en.groups.find((g) => g.id === initialGroup)!.pages[0].id
  );
  const active = docs.groups.flatMap((g) => g.pages).find((p) => p.id === pageId) ?? null;

  return (
    <main className="docs-root">
      <header className="docs-topbar">
        <Link href="/" className="docs-topbar-brand" aria-label="ONE01 home">
          <Logo height={20} interactive />
        </Link>
        <div className="docs-topbar-actions">
          <button type="button" className="nav-mode nav-lang" onClick={toggleLang} aria-label={t.aria.switchLang}>
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
          <Link className="btn btn-primary" href="/app">
            {t.nav.enter}
          </Link>
        </div>
      </header>

      <div className="docs-page">
        <nav className="docs-nav" aria-label="Sections">
          {docs.groups.map((g) => (
            <div className="docs-nav-group" key={g.id}>
              <div className="docs-nav-label">{g.title}</div>
              {g.pages.map((p) => (
                <button
                  key={p.id}
                  className={`docs-nav-item${p.id === pageId ? " active" : ""}`}
                  onClick={() => setPageId(p.id)}
                >
                  {p.title}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <article className="docs-content" key={pageId}>
          {active && (
            <>
              <h1 className="docs-title">{active.title}</h1>
              {active.body.map((para, i) => (
                <p className="docs-para" key={i}>
                  {para}
                </p>
              ))}
            </>
          )}
        </article>
      </div>

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
            <Link href="/about">{t.foot.about}</Link>
            <Link href="/support">{t.foot.support}</Link>
            <Link href="/legal">{t.foot.legal}</Link>
          </nav>
          <span className="foot-copy">© 2026 ONE01</span>
        </div>
      </footer>
    </main>
  );
}
