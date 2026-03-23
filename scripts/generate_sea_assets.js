/**
 * Generate sea-config.json with embedded assets for Node.js SEA build.
 *
 * Scans dist-sea/assets/ and writes sea-config.json with an "assets" field
 * so all runtime files are embedded into the single executable.
 *
 * Usage:
 *   node scripts/generate_sea_assets.js              # Include all assets
 *   node scripts/generate_sea_assets.js --windows     # Windows-only (x64-win32 ripgrep, skip .sb)
 */

import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const assetsDir = join(rootDir, 'dist-sea', 'assets');

const isWindows = process.argv.includes('--windows');

/**
 * Recursively collect all file paths under a directory.
 */
function walkDir(dir, base = dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    if (entry === '.DS_Store') continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath, base));
    } else {
      // Key = relative path with forward slashes (POSIX style for sea-config)
      const relPath = relative(base, fullPath).split('\\').join('/');
      results.push(relPath);
    }
  }
  return results;
}

/**
 * Filter assets based on target platform.
 */
function filterAssets(files, windowsOnly) {
  if (!windowsOnly) return files;

  return files.filter((f) => {
    // Skip macOS sandbox profiles
    if (f.endsWith('.sb')) return false;

    // For ripgrep binaries, only keep the target platform
    if (f.startsWith('vendor/ripgrep/')) {
      const platformDirs = [
        'arm64-darwin',
        'x64-darwin',
        'x64-linux',
        'arm64-linux',
      ];
      for (const pd of platformDirs) {
        if (f.includes(pd + '/')) return false;
      }
    }

    return true;
  });
}

// --- Main ---

if (!existsSync(assetsDir)) {
  console.error(
    `Error: ${assetsDir} does not exist. Run asset copy step first.`,
  );
  process.exit(1);
}

const allFiles = walkDir(assetsDir);
const filteredFiles = filterAssets(allFiles, isWindows);

// Build the assets map: key (relative path) -> filepath (relative to project root)
const assets = {};
for (const relPath of filteredFiles) {
  // Use POSIX paths in the config for cross-platform compatibility in sea-config
  const filePath = posix.join('dist-sea/assets', relPath);
  assets[relPath] = filePath;
}

const seaConfig = {
  main: 'dist-sea/cli.cjs',
  output: 'dist-sea/sea-prep.blob',
  disableExperimentalSEAWarning: true,
  useCodeCache: false,
  assets,
};

const outPath = join(rootDir, 'sea-config.json');
writeFileSync(outPath, JSON.stringify(seaConfig, null, 2) + '\n');

console.log(
  `Generated sea-config.json with ${filteredFiles.length} embedded assets:`,
);
for (const f of filteredFiles) {
  console.log(`  ${f}`);
}
