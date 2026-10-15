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
// iOS status bar + bottom toolbar, and app scrims cover them. Also ask the
// browser to RESIZE CONTENT (not just the visual viewport) when the on-screen
// keyboard opens — on browsers that support it (Chrome/Android) the layout
// shrinks so the bottom-anchored composer sits above the keyboard with no page
// scroll. iOS Safari ignores interactive-widget today; it's harmless there.
function ensureViewportFlags() {
  const m = document.head.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!m) return;
  let c = m.getAttribute('content') || '';
  if (!/viewport-fit\s*=\s*cover/.test(c)) c = c.replace(/\s*$/, '') + ', viewport-fit=cover';
  if (!/interactive-widget/.test(c)) c = c.replace(/\s*$/, '') + ', interactive-widget=resizes-content';
  m.setAttribute('content', c);
}

// A solid cap over the top safe-area (the status-bar notch band). iOS Safari
// tints the status bar from the pixels rendered under it; with viewport-fit=
// cover the page draws up there, so WITHOUT this a sheet's dim backdrop bleeds
// into the status-bar area and it goes an ugly washed grey. A fixed cap in the
// app colour, above everything (incl. the modal scrim), keeps the status bar
// the app colour at all times. pointer-events:none so it never eats taps; it's
// only env(safe-area-inset-top) tall (0 off-notch), so it's invisible on the
// home and only does work behind the real status bar.
function ensureStatusBarCap(bgColor: string) {
  let cap = document.getElementById('__one_statusbar_cap') as HTMLElement | null;
  if (!cap) {
    cap = document.createElement('div');
    cap.id = '__one_statusbar_cap';
    cap.style.cssText =
      'position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);' +
      'z-index:2147483647;pointer-events:none;';
    document.body.appendChild(cap);
  }
  cap.style.background = bgColor;
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
  ensureViewportFlags();
  ensureTouchIcon();
  ensureStatusBarCap(bgColor);
  // Paint the document itself the app colour so any safe-area band shows cream,
  // not the browser's default white. (No body scroll-lock — it interfered with
  // the on-screen keyboard on iOS; in-app ScrollViews handle their own scroll.)
  try {
    document.documentElement.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;
  } catch {
    /* non-DOM env */
  }
}
