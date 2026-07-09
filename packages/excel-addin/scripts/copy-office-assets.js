/**
 * Copy the offline vendor assets into dist/web/assets:
 *  - office.js + the sibling scripts/locale strings it loads at runtime
 *    (from @microsoft/office-js/dist) → assets/office/
 *  - Office UI Fabric Core CSS → assets/fabric/ with remote @font-face
 *    blocks stripped, so the closed network never sees an outbound request.
 *
 * Validate against the sidecar access log on the target: any 404 under
 * /assets/office/ means a file is missing from COPY_PATTERNS.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

/** npm hoists deps to the monorepo root; look in both places. */
function findModuleDir(...segments) {
  const candidates = [
    path.join(pkgRoot, 'node_modules', ...segments),
    path.resolve(pkgRoot, '..', '..', 'node_modules', ...segments),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? candidates[0];
}

const officeDist = findModuleDir('@microsoft', 'office-js', 'dist');
const fabricDist = findModuleDir('office-ui-fabric-core', 'dist', 'css');

const LOCALES = ['ko-kr', 'en-us'];

/** Top-level office-js dist files to ship (non-debug, Excel-relevant). */
function shouldCopyTopLevel(name) {
  if (name.endsWith('.debug.js')) return false;
  if (name === 'office.js' || name === 'o15apptofilemappingtable.js')
    return true;
  if (name === 'es6-promise.js' || name === 'html2canvas.js') return true;
  if (name === 'custom-functions-runtime.js') return true;
  if (/^excel.*\.js$/.test(name)) return true;
  if (/^office_strings.*\.js$/.test(name)) return true;
  return false;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      copyFile(s, d);
    }
  }
}

export function copyOfficeAssets(webRoot) {
  if (!fs.existsSync(officeDist)) {
    throw new Error(`@microsoft/office-js not installed: ${officeDist}`);
  }
  const officeOut = path.join(webRoot, 'assets', 'office');
  let count = 0;
  for (const name of fs.readdirSync(officeDist)) {
    const src = path.join(officeDist, name);
    if (fs.statSync(src).isFile() && shouldCopyTopLevel(name)) {
      copyFile(src, path.join(officeOut, name));
      count++;
    }
  }
  for (const locale of LOCALES) {
    const localeDir = path.join(officeDist, locale);
    if (fs.existsSync(localeDir)) {
      copyDir(localeDir, path.join(officeOut, locale));
      count++;
    }
  }
  // office.js probes these auxiliary dirs; ship them so nothing 404s loudly.
  for (const aux of ['telemetry', 'ariatelemetry', 'agaveerrorux', 'webauth']) {
    const auxDir = path.join(officeDist, aux);
    if (fs.existsSync(auxDir)) {
      copyDir(auxDir, path.join(officeOut, aux));
      count++;
    }
  }

  // Fabric CSS with remote fonts stripped (falls back to system fonts).
  const fabricSrc = path.join(fabricDist, 'fabric.min.css');
  if (fs.existsSync(fabricSrc)) {
    const css = fs.readFileSync(fabricSrc, 'utf8');
    const stripped = css.replace(
      /@font-face\{[^}]*url\((?:'|")?https?:[^}]*\}/gi,
      '',
    );
    const fabricOutDir = path.join(webRoot, 'assets', 'fabric');
    fs.mkdirSync(fabricOutDir, { recursive: true });
    fs.writeFileSync(
      path.join(fabricOutDir, 'fabric.min.css'),
      stripped,
      'utf8',
    );
    count++;
  }

  console.log(
    `copied ${count} office/fabric asset entries → ${path.join(webRoot, 'assets')}`,
  );
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  copyOfficeAssets(process.argv[2] ?? path.join(pkgRoot, 'dist', 'web'));
}
