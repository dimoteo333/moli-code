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
  'target',
]);

function walkAndRename(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_err) {
    if (_err.code !== 'ENOENT') throw _err;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;

    const oldPath = path.join(dir, entry.name);
    let newName = entry.name;

    const REPLACEMENTS = [
      { from: /qwencode/g, to: 'molicode' },
      { from: /Molicode/g, to: 'Molicode' },
      { from: /MoliCode/g, to: 'MoliCode' },
      { from: /QWENCODE/g, to: 'MOLICODE' },
      { from: /qwen-code/g, to: 'moli-code' },
      { from: /Moli-Code/g, to: 'Moli-Code' },
      { from: /QWEN_CODE/g, to: 'MOLI_CODE' },
      { from: /QWEN-CODE/g, to: 'MOLI-CODE' },
      { from: /qwen/g, to: 'moli' },
      { from: /Moli/g, to: 'Moli' },
      { from: /QWEN/g, to: 'MOLI' },
    ];

    for (const { from, to } of REPLACEMENTS) {
      newName = newName.replace(from, to);
    }

    const newPath = path.join(dir, newName);

    if (entry.isDirectory()) {
      walkAndRename(oldPath);

      if (oldPath !== newPath) {
        if (!fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
          console.log(`Renamed dir: ${oldPath} -> ${newPath}`);
        } else {
          // Merge contents
          const childEntries = fs.readdirSync(oldPath);
          for (const child of childEntries) {
            fs.renameSync(path.join(oldPath, child), path.join(newPath, child));
          }
          fs.rmdirSync(oldPath);
          console.log(`Merged dir: ${oldPath} -> ${newPath}`);
        }
      }
    } else if (entry.isFile()) {
      if (oldPath !== newPath && !fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed file: ${oldPath} -> ${newPath}`);
      } else if (oldPath !== newPath && fs.existsSync(newPath)) {
        fs.unlinkSync(oldPath); // if the new file already exists, we drop the old file (likely it was copied already or redundant)
        console.log(`Deleted redundant file: ${oldPath}`);
      }
    }
  }
}

const ROOT_DIR = process.cwd();
console.log(`Starting bulk rename (Phase 2) in ${ROOT_DIR}...`);
walkAndRename(ROOT_DIR);
console.log(`Renaming complete.`);
