#!/usr/bin/env node
/**
 * patch-web-head.mjs — inject the mobile-browser <head> bits Expo's metro
 * export doesn't emit, into the STATIC dist/index.html at build time.
 *
 * Why static (not only the runtime webHead.ts): iOS Safari reads the viewport
 * meta + theme-color at PAGE LOAD. Adding viewport-fit=cover at runtime did NOT
 * take — so env(safe-area-inset-top) stayed 0, the status-bar cap had 0 height,
 * and the status bar never got the app colour. Emitting these at load fixes it.
 *
 * Idempotent (safe to run twice). Runs standalone (`node scripts/patch-web-head.mjs`,
 * patches dist/index.html) and is imported by build-deploy.mjs for the /app/ bundle.
 *
 * The Cloudflare Worker that serves app.one01.io must run this after export —
 * set its build command to `npm run build:web` (which does export + this patch).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BG_LIGHT = '#F5F4F0'; // app light background (src/utils/theme.ts)

export function patchWebHead(htmlPath) {
  if (!existsSync(htmlPath)) {
    console.warn('patch-web-head: not found', htmlPath);
    return false;
  }
  let html = readFileSync(htmlPath, 'utf8');

  // 1) viewport: ensure viewport-fit=cover (safe-area insets) + interactive-widget.
  html = html.replace(/<meta name="viewport" content="([^"]*)"\s*\/?>/i, (_m, c) => {
    let content = c;
    if (!/viewport-fit/.test(content)) content += ', viewport-fit=cover';
    if (!/interactive-widget/.test(content)) content += ', interactive-widget=resizes-content';
    return `<meta name="viewport" content="${content}" />`;
  });

  // 2) theme-color + apple PWA metas + touch icon (once — marker-guarded).
  //    theme-color defaults to the LIGHT bg; the runtime webHead.ts updates it
  //    when the in-app theme flips. apple-touch-icon href is RELATIVE so it
  //    resolves at the domain root (app.one01.io) and under /app/ alike.
  if (!/data-one-head/.test(html)) {
    const inject = [
      `<meta name="theme-color" content="${BG_LIGHT}" data-one-head />`,
      `<meta name="apple-mobile-web-app-capable" content="yes" data-one-head />`,
      `<meta name="mobile-web-app-capable" content="yes" data-one-head />`,
      `<meta name="apple-mobile-web-app-title" content="ONE" data-one-head />`,
      `<meta name="apple-mobile-web-app-status-bar-style" content="default" data-one-head />`,
      `<link rel="apple-touch-icon" href="apple-touch-icon.png" data-one-head />`,
      `<link rel="apple-touch-icon-precomposed" href="apple-touch-icon.png" data-one-head />`,
    ].join('\n    ');
    html = html.replace(/<\/head>/i, `    ${inject}\n  </head>`);
  }

  writeFileSync(htmlPath, html, 'utf8');
  console.log('patch-web-head: patched', htmlPath);
  return true;
}

// Standalone: patch dist/index.html at the repo root.
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('patch-web-head.mjs');
if (invokedDirectly) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const ROOT = resolve(__dirname, '..');
  patchWebHead(join(ROOT, 'dist', 'index.html'));
}
