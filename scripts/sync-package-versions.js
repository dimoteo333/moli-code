/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const rootPackagePath = path.join(repoRoot, 'package.json');
const targets = [
  path.join(repoRoot, 'package.offline.json'),
  path.join(repoRoot, 'packages', 'vscode-ide-companion', 'package.json'),
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

const rootPackage = readJson(rootPackagePath);
const rootVersion = rootPackage.version;

if (typeof rootVersion !== 'string' || rootVersion.length === 0) {
  throw new Error('Root package.json version is missing.');
}

for (const targetPath of targets) {
  const target = readJson(targetPath);
  if (target.version === rootVersion) {
    continue;
  }

  target.version = rootVersion;
  writeJson(targetPath, target);
  console.log(
    `[sync-package-versions] Updated ${path.relative(repoRoot, targetPath)} -> ${rootVersion}`,
  );
}
