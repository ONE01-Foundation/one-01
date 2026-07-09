"use client";

/**
 * DocsPanel — a GitBook-style floating side panel for the footer's
 * About / Support / Legal content. A floating rounded card slides in from the
 * reading-end edge (right in LTR, left in RTL) with a sidebar of pages and a
 * content pane. Opened by passing the group id; closes on scrim click or Esc.
 */

import { useEffect, useState } from "react";
import type { DocsCopy, DocGroupId } from "@/lib/docsContent";

export function DocsPanel({
  openGroup,
  onClose,
  docs,
}: {
  openGroup: DocGroupId | null;
  onClose: () => void;
  docs: DocsCopy;
}) {
  const [pageId, setPageId] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  // When opened via a footer link, jump to that group's first page.
  useEffect(() => {
    if (!openGroup) return;
    const g = docs.groups.find((x) => x.id === openGroup);
    setPageId(g?.pages[0]?.id ?? null);
  }, [openGroup, docs]);

  // Slide/fade in on the next frame after mount; reset when closed.
  useEffect(() => {
    if (!openGroup) {
      setShown(false);
      return;
    }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [openGroup]);

  // Esc closes.
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openGroup, onClose]);

  if (!openGroup) return null;

  const active = docs.groups.flatMap((g) => g.pages).find((p) => p.id === pageId) ?? null;

  return (
    <div className={`docs-scrim${shown ? " in" : ""}`} onClick={onClose}>
      <aside
        className={`docs-panel${shown ? " in" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={docs.panelTitle}
      >
        <div className="docs-head">
          <span className="docs-head-title">{docs.panelTitle}</span>
          <button className="docs-close" onClick={onClose} aria-label={docs.close}>
            ✕
          </button>
        </div>
        <div className="docs-body">
          <nav className="docs-nav">
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
          <div className="docs-content" key={pageId ?? ""}>
            {active && (
              <>
                <h2 className="docs-title">{active.title}</h2>
                {active.body.map((para, i) => (
                  <p className="docs-para" key={i}>
                    {para}
                  </p>
                ))}
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
