/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { getProjectHash } from '../utils/paths.js'; // MOLI: removed sanitizeCwd import

export const MOLI_DIR = '.moli'; // MOLI: renamed from MOLI_DIR
export const GOOGLE_ACCOUNTS_FILENAME = 'google_accounts.json';
export const OAUTH_FILE = 'oauth_creds.json';
const TMP_DIR_NAME = 'tmp';
const BIN_DIR_NAME = 'bin';
const PROJECT_DIR_NAME = 'projects';
const IDE_DIR_NAME = 'ide';
const DEBUG_DIR_NAME = 'debug';

export class Storage {
  private readonly targetDir: string;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
  }

  static getGlobalMoliDir(): string {
    const homeDir = os.homedir();
    if (!homeDir) {
      return path.join(os.tmpdir(), '.moli');
    }
    return path.join(homeDir, MOLI_DIR);
  }

  static getMcpOAuthTokensPath(): string {
    return path.join(Storage.getGlobalMoliDir(), 'mcp-oauth-tokens.json');
  }

  static getGlobalSettingsPath(): string {
    return path.join(Storage.getGlobalMoliDir(), 'settings.json');
  }

  static getInstallationIdPath(): string {
    return path.join(Storage.getGlobalMoliDir(), 'installation_id');
  }

  static getGoogleAccountsPath(): string {
    return path.join(Storage.getGlobalMoliDir(), GOOGLE_ACCOUNTS_FILENAME);
  }

  static getUserCommandsDir(): string {
    return path.join(Storage.getGlobalMoliDir(), 'commands');
  }

  static getGlobalMemoryFilePath(): string {
    return path.join(Storage.getGlobalMoliDir(), 'memory.md');
  }

  static getGlobalTempDir(): string {
    return path.join(Storage.getGlobalMoliDir(), TMP_DIR_NAME);
  }

  static getGlobalDebugDir(): string {
    return path.join(Storage.getGlobalMoliDir(), DEBUG_DIR_NAME);
  }

  static getDebugLogPath(sessionId: string): string {
    return path.join(Storage.getGlobalDebugDir(), `${sessionId}.txt`);
  }

  static getGlobalIdeDir(): string {
    return path.join(Storage.getGlobalMoliDir(), IDE_DIR_NAME);
  }

  static getGlobalBinDir(): string {
    return path.join(Storage.getGlobalMoliDir(), BIN_DIR_NAME);
  }

  getMoliDir(): string {
    // MOLI: renamed from getQwenDir
    return path.join(this.targetDir, MOLI_DIR);
  }

  getProjectDir(): string {
    const projectId = this.sanitizeCwd(this.getProjectRoot()); // MOLI: use instance method
    const projectsDir = path.join(Storage.getGlobalMoliDir(), PROJECT_DIR_NAME);
    return path.join(projectsDir, projectId);
  }

  getProjectTempDir(): string {
    const hash = getProjectHash(this.getProjectRoot());
    const tempDir = Storage.getGlobalTempDir();
    const targetDir = path.join(tempDir, hash);
    return targetDir;
  }

  ensureProjectTempDirExists(): void {
    fs.mkdirSync(this.getProjectTempDir(), { recursive: true });
  }

  static getOAuthCredsPath(): string {
    return path.join(Storage.getGlobalMoliDir(), OAUTH_FILE);
  }

  getProjectRoot(): string {
    return this.targetDir;
  }

  getHistoryDir(): string {
    const hash = getProjectHash(this.getProjectRoot());
    const historyDir = path.join(Storage.getGlobalMoliDir(), 'history');
    const targetDir = path.join(historyDir, hash);
    return targetDir;
  }

  getWorkspaceSettingsPath(): string {
    return path.join(this.getMoliDir(), 'settings.json');
  }

  getProjectCommandsDir(): string {
    return path.join(this.getMoliDir(), 'commands');
  }

  getProjectTempCheckpointsDir(): string {
    return path.join(this.getProjectTempDir(), 'checkpoints');
  }

  getExtensionsDir(): string {
    return path.join(this.getMoliDir(), 'extensions');
  }

  getExtensionsConfigPath(): string {
    return path.join(this.getExtensionsDir(), 'moli-extension.json'); // MOLI: renamed
  }

  getUserSkillsDir(): string {
    return path.join(Storage.getGlobalMoliDir(), 'skills');
  }

  getHistoryFilePath(): string {
    return path.join(this.getProjectTempDir(), 'shell_history');
  }

  // MOLI: private sanitizeCwd moved from utils/paths.js
  private sanitizeCwd(cwd: string): string {
    const normalizedCwd = os.platform() === 'win32' ? cwd.toLowerCase() : cwd;
    return normalizedCwd.replace(/[^a-zA-Z0-9]/g, '-');
  }
}
