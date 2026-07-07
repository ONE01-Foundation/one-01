#!/usr/bin/env node
/**
 * build-deploy.mjs — single command that assembles the live demo bundle.
 *
 * Steps:
 *   1.  Wipe dist/ and dist-deploy/
 *   2.  Run `expo export --platform web --output-dir dist`
 *   3.  Rewrite absolute paths in dist/index.html so the bundle works when
 *       served from a /app/ subdirectory (the absolute /_expo/... paths
 *       produced by Expo otherwise 404 under any non-root mount).
 *   4.  Assemble dist-deploy/:
 *         dist-deploy/index.html       ← landing/index.html
 *         dist-deploy/privacy.html     ← landing/privacy.html (if present)
 *         dist-deploy/terms.html       ← landing/terms.html (if present)
 *         dist-deploy/screens/*.png    ← F:/One/One Screens/Mobile/*.png
 *         dist-deploy/app/             ← dist/* (the Expo web bundle)
 *
 * Run: `npm run deploy`
 */

import { execSync } from 'node:child_process';
import {
  rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync, readdirSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DEPLOY = join(ROOT, 'dist-deploy');
const LANDING = join(ROOT, 'landing');
const MOCKUPS = 'F:/One/One Screens/Mobile';

function step(label) {
  console.log(`\n› ${label}`);
}

function rmrf(p) {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

function cp(src, dst) {
  cpSync(src, dst, { recursive: true });
}

step('1/4  Clean dist/ + dist-deploy/');
rmrf(DIST);
rmrf(DEPLOY);

step('2/4  Run expo export (web)');
execSync('npx expo export --platform web --output-dir dist', {
  cwd: ROOT,
  stdio: 'inherit',
});

step('3/4  Rewrite absolute paths in dist/index.html → relative');
const distHtmlPath = join(DIST, 'index.html');
if (existsSync(distHtmlPath)) {
  const original = readFileSync(distHtmlPath, 'utf8');
  const patched = original
    .replace(/href="\/favicon\.ico"/g, 'href="./favicon.ico"')
    .replace(/src="\/_expo\//g, 'src="./_expo/')
    .replace(/href="\/_expo\//g, 'href="./_expo/');
  writeFileSync(distHtmlPath, patched, 'utf8');
  console.log('    paths rewritten OK');
} else {
  console.warn('    WARN: dist/index.html missing');
}

step('4/4  Assemble dist-deploy/');
mkdirSync(DEPLOY, { recursive: true });

// landing index + legal pages
cp(join(LANDING, 'index.html'), join(DEPLOY, 'index.html'));
for (const f of ['privacy.html', 'terms.html']) {
  const p = join(LANDING, f);
  if (existsSync(p)) cp(p, join(DEPLOY, f));
}

// app bundle
cp(DIST, join(DEPLOY, 'app'));

// mockups (best-effort — skip silently on machines without F: drive)
if (existsSync(MOCKUPS)) {
  const screens = join(DEPLOY, 'screens');
  mkdirSync(screens, { recursive: true });
  for (const f of readdirSync(MOCKUPS)) {
    if (f.toLowerCase().endsWith('.png')) {
      cp(join(MOCKUPS, f), join(screens, f));
    }
  }
  console.log(`    screens/ copied (${readdirSync(screens).length} files)`);
} else {
  console.warn(`    WARN: mockups not found at ${MOCKUPS} — landing images will 404`);
}

step('done. Serve with:  npx serve dist-deploy -l 3030');
