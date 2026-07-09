"use client";

/**
 * DocsView — a real docs PAGE per route (About / Support / Legal), each standing
 * on its own: the site header with page tabs, a sidebar of THIS page's sections
 * (scroll-spy + smooth anchor scroll), the sections stacked in the content pane,
 * and the site footer. The FAQ renders as an accordion. Sections carry a
 * scroll-margin so the sticky header never covers a heading you jump to.
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
function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DocsView({ group }: { group: DocGroupId }) {
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

  const g = docs.groups.find((x) => x.id === group) ?? docs.groups[0];

  // Scroll-spy: the active section is the last one whose top has scrolled above
  // a line just under the sticky header — i.e. the one you're reading now.
  const [activeId, setActiveId] = useState<string>(g.pages[0]?.id ?? "");
  useEffect(() => {
    const onScroll = () => {
      let current = g.pages[0]?.id ?? "";
      for (const p of g.pages) {
        const el = document.getElementById(p.id);
        if (el && el.getBoundingClientRect().top <= 120) current = p.id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [group, lang, g]);

  // FAQ accordion — first item open by default.
  const [openFaq, setOpenFaq] = useState(0);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  };

  return (
    <main className="docs-root">
      <header className="docs-topbar">
        <Link href="/" className="docs-topbar-brand" aria-label="ONE01 home">
          <Logo height={20} interactive />
        </Link>
        <nav className="docs-tabs" aria-label="Pages">
          {docs.groups.map((gr) => (
            <Link key={gr.id} href={`/${gr.id}`} className={`docs-tab${gr.id === group ? " active" : ""}`}>
              {gr.title}
            </Link>
          ))}
        </nav>
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
        <nav className="docs-nav" aria-label={g.title}>
          <div className="docs-nav-title">{g.title}</div>
          {g.pages.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className={`docs-nav-item${p.id === activeId ? " active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                jumpTo(p.id);
              }}
            >
              {p.title}
            </a>
          ))}
        </nav>

        <div className="docs-content">
          {g.pages.map((p) => (
            <section id={p.id} className="docs-section" key={p.id}>
              <h2 className="docs-title">{p.title}</h2>
              {p.id === "faq" ? (
                <div className="faq">
                  {p.body.map((qa, i) => {
                    const sep = qa.indexOf(" — ");
                    const q = sep >= 0 ? qa.slice(0, sep) : qa;
                    const a = sep >= 0 ? qa.slice(sep + 3) : "";
                    const open = openFaq === i;
                    return (
                      <div className={`faq-item${open ? " open" : ""}`} key={i}>
                        <button
                          type="button"
                          className="faq-q"
                          aria-expanded={open}
                          onClick={() => setOpenFaq(open ? -1 : i)}
                        >
                          <span>{q}</span>
                          <span className="faq-chev" aria-hidden="true">
                            <Chevron />
                          </span>
                        </button>
                        <div className="faq-a">
                          <p>{a}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                p.body.map((para, i) => (
                  <p className="docs-para" key={i}>
                    {para}
                  </p>
                ))
              )}
            </section>
          ))}
        </div>
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
          <span className="foot-copy">{t.foot.copy}</span>
        </div>
      </footer>
    </main>
  );
}
