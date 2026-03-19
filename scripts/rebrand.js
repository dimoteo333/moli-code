import fs from 'fs';
import path from 'path';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.vscode',
  '.idea',
  'out',
  'target', // Java UI build folder
]);

const IGNORE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.ttf',
  '.woff',
  '.woff2',
  '.eot',
  '.mp4',
  '.webm',
  '.zip',
  '.tar',
  '.gz',
  '.class',
  '.jar',
  '.pdf',
  '.map',
  '.lock',
  '.bin',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.DS_Store',
]);

const REPLACEMENTS = [
  // longest first
  { from: /molicode/g, to: 'molicode' },
  { from: /Molicode/g, to: 'Molicode' },
  { from: /MoliCode/g, to: 'MoliCode' },
  { from: /MOLICODE/g, to: 'MOLICODE' },
  { from: /moli-code/g, to: 'moli-code' },
  { from: /Moli-Code/g, to: 'Moli-Code' },
  { from: /MOLI_CODE/g, to: 'MOLI_CODE' },
  { from: /MOLI-CODE/g, to: 'MOLI-CODE' },
  { from: /moli/g, to: 'moli' },
  { from: /Moli/g, to: 'Moli' },
  { from: /MOLI/g, to: 'MOLI' },
];

let filesChanged = 0;

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_err) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walk(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORE_EXTENSIONS.has(ext)) continue;
      if (
        entry.name === 'package-lock.json' ||
        entry.name === 'pnpm-lock.yaml' ||
        entry.name === 'yarn.lock'
      )
        continue; // Don't touch lockfiles directly with raw replace

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        let newContent = content;

        for (const { from, to } of REPLACEMENTS) {
          newContent = newContent.replace(from, to);
        }

        if (content !== newContent) {
          fs.writeFileSync(fullPath, newContent, 'utf8');
          console.log(`Updated: ${fullPath}`);
          filesChanged++;
        }
      } catch (err) {
        // likely binary or unreadable
        console.error(`Skipping: ${fullPath} - ${err.message}`);
      }
    }
  }
}

const ROOT_DIR = process.cwd();
console.log(`Starting bulk replacement in ${ROOT_DIR}...`);
walk(ROOT_DIR);
console.log(`Success! Updated ${filesChanged} files.`);
