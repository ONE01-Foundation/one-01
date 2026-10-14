/**
 * webHead — inject the mobile-browser head bits Expo's metro export doesn't
 * emit, at runtime, on web only. Keeps everything in the JS bundle so it ships
 * through the normal build (no custom HTML template, no Cloudflare Worker build
 * step needed).
 *
 * What it fixes on app.one01.io (iOS Safari):
 *  • theme-color + viewport-fit=cover + cream html/body bg → the status-bar
 *    notch area AND the bottom browser toolbar stop showing a white band and
 *    take the app background, and the page extends UNDER the safe areas so a
 *    sheet's dim scrim also covers the status-bar area.
 *  • apple-mobile-web-app-* → a clean standalone title ("ONE") + status bar.
 *  • apple-touch-icon → "Add to Home Screen" uses the ONE app icon.
 *  • installWebViewportFix() → pins the app to the VISIBLE viewport when the
 *    on-screen keyboard opens, so Safari doesn't scroll the whole page and
 *    float the composer into the middle of the screen.
 *
 * The page <title> is handled separately via React Navigation's documentTitle.
 */
import { Platform } from 'react-native';

function upsertMeta(name: string, content: string) {
  let m = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute('name', name);
    document.head.appendChild(m);
  }
  m.setAttribute('content', content);
}

// Make the page draw under the safe areas so cream (not white) shows behind the
// iOS status bar + bottom toolbar, and app scrims cover them. iOS Safari re-lays
// out when the viewport meta changes, so doing this at runtime is enough.
function ensureViewportFitCover() {
  const m = document.head.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!m) return;
  const c = m.getAttribute('content') || '';
  if (!/viewport-fit\s*=\s*cover/.test(c)) {
    m.setAttribute('content', c.replace(/\s*$/, '') + ', viewport-fit=cover');
  }
}

let touchIconDone = false;
function ensureTouchIcon() {
  if (touchIconDone) return;
  // A stable copy of the app icon ships in `public/apple-touch-icon.png`, which
  // Expo copies verbatim to the web output root. A RELATIVE href resolves right
  // whether the app is served at the domain root (app.one01.io → /apple-touch-
  // icon.png) or under a sub-path (the /app/ test harness → /app/apple-touch-
  // icon.png). iOS also auto-discovers /apple-touch-icon.png at the root.
  const add = (rel: string) => {
    let link = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      document.head.appendChild(link);
    }
    link.setAttribute('href', 'apple-touch-icon.png');
    link.setAttribute('sizes', '1024x1024');
  };
  add('apple-touch-icon');
  add('apple-touch-icon-precomposed');
  touchIconDone = true;
}

/**
 * Apply the head tags + page background. Safe to call repeatedly (e.g. when the
 * theme flips) — it upserts. `bgColor` is the app's current background so the
 * browser chrome and the safe-area bands match light/dark.
 */
export function applyWebHead(bgColor: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  // Tint the iOS status-bar area + bottom toolbar to match the app.
  upsertMeta('theme-color', bgColor);
  upsertMeta('apple-mobile-web-app-capable', 'yes');
  upsertMeta('mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-title', 'ONE');
  upsertMeta('apple-mobile-web-app-status-bar-style', 'default');
  ensureViewportFitCover();
  ensureTouchIcon();
  // Paint the document itself the app colour so any safe-area band shows cream,
  // not the browser's default white. Lock page scroll — the app is a fixed
  // full-screen SPA; only in-app ScrollViews should scroll.
  try {
    const root = document.documentElement;
    root.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;
    document.body.style.overflow = 'hidden';
  } catch {
    /* non-DOM env */
  }
}

let viewportFixInstalled = false;
/**
 * Pin the app element to the VISIBLE viewport height while the on-screen
 * keyboard is open. Without this, iOS Safari keeps the layout viewport at full
 * height, overlays the keyboard, then scrolls the page to reveal the focused
 * input — which left the composer floating mid-screen with a big gap above it.
 * Shrinking the app to the visible height removes the overflow, so there's
 * nothing for Safari to scroll and the bottom-anchored composer sits right
 * above the keyboard. Only engages while the keyboard is up (height dropped a
 * lot); normal address-bar show/hide is ignored.
 */
export function installWebViewportFix() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (viewportFixInstalled) return;
  const vv = window.visualViewport;
  const app =
    document.getElementById('root') ||
    document.getElementById('main') ||
    (document.body.firstElementChild as HTMLElement | null);
  if (!vv || !app) return;
  viewportFixInstalled = true;

  let maxH = vv.height;
  let raf = 0;
  const apply = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      maxH = Math.max(maxH, vv.height);
      const kbOpen = maxH - vv.height > 120;
      if (kbOpen) {
        app.style.height = Math.round(vv.height) + 'px';
      } else {
        app.style.height = '';
      }
    });
  };
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  apply();
}
