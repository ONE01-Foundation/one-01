"use client";

import { useEffect, useState } from "react";

/**
 * Sheet — desktop: a centered popup window overlay (scrim + dialog).
 * Mobile (<520px): a bottom sheet that slides up. Both share the same
 * markup; the shape switches via CSS media query in globals.css.
 * Closes on scrim click or Escape.
 */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`sheet-scrim${shown ? " open" : ""}`}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="sheet-popup" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
