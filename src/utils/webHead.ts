/**
 * webHead — inject the mobile-browser head bits Expo's metro export doesn't
 * emit, at runtime, on web only. Keeps everything in the JS bundle so it ships
 * through the normal build (no custom HTML template, no Cloudflare Worker build
 * step needed).
 *
 * What it fixes on app.one01.io (iOS Safari):
 *  • theme-color → the status-bar notch area AND the bottom browser toolbar
 *    get tinted with the app's own background instead of a white band, so they
 *    "disappear" into the page (what the user called transparent).
 *  • apple-mobile-web-app-* → a clean standalone title ("ONE") + status bar.
 *  • apple-touch-icon → "Add to Home Screen" uses the ONE app icon instead of a
 *    letter placeholder (Next set one automatically; the Expo page had none).
 *
 * The page <title> is handled separately via React Navigation's documentTitle
 * (it overwrites document.title per route), so we don't set it here.
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

let touchIconDone = false;
function ensureTouchIcon() {
  if (touchIconDone) return;
  // A stable copy of the app icon ships in `public/apple-touch-icon.png`, which
  // Expo copies verbatim to the web output root. A RELATIVE href resolves right
  // whether the app is served at the domain root (app.one01.io → /apple-touch-
  // icon.png) or under a sub-path (the /app/ test harness → /app/apple-touch-
  // icon.png). iOS also auto-discovers /apple-touch-icon.png at the root, so the
  // home-screen shortcut gets the ONE icon even before this tag is read.
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
 * Apply the head tags. Safe to call repeatedly (e.g. when the theme flips) — it
 * upserts. `bgColor` is the app's current background so the browser chrome
 * matches light/dark.
 */
export function applyWebHead(bgColor: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  // Tints the iOS status-bar area + bottom toolbar to match the app.
  upsertMeta('theme-color', bgColor);
  // Standalone (installed-to-home-screen) behaviour.
  upsertMeta('apple-mobile-web-app-capable', 'yes');
  upsertMeta('mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-title', 'ONE');
  upsertMeta('apple-mobile-web-app-status-bar-style', 'default');
  ensureTouchIcon();
}
