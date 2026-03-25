/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import semver from 'semver';
import { getMolimateConfigSafe } from '../../constants/molimateConfig.js';
import { getCliVersion } from '../../utils/version.js';
import { createDebugLogger } from '@dobby/moli-code-core';
import { t } from '../../i18n/index.js';

const debugLogger = createDebugLogger('REMOTE_UPDATE_CHECK');

const FETCH_TIMEOUT_MS = 3000;

export interface RemoteVersionInfo {
  version: string;
  downloadUrl?: string;
  releaseNotes?: string;
}

export interface RemoteUpdateResult {
  message: string;
}

function pad(text: string, width: number): string {
  const len = [...text].length;
  return text + ' '.repeat(Math.max(0, width - len));
}

function buildNotification(
  currentVersion: string,
  data: RemoteVersionInfo,
): string {
  const title = t('remote.update.available', {
    current: currentVersion,
    latest: data.version,
  });
  const contentLines: string[] = [title];

  if (data.releaseNotes) {
    const note =
      data.releaseNotes.length > 34
        ? data.releaseNotes.slice(0, 31) + '...'
        : data.releaseNotes;
    contentLines.push(note);
  }
  if (data.downloadUrl) {
    contentLines.push(`${t('remote.update.download')}: ${data.downloadUrl}`);
  }

  const innerWidth = Math.max(...contentLines.map((l) => [...l].length)) + 2;
  const hr = '─'.repeat(innerWidth);
  const lines: string[] = [];

  lines.push(`  ╭${hr}╮`);
  for (const line of contentLines) {
    lines.push(`  │ ${pad(line, innerWidth - 1)}│`);
  }
  lines.push(`  ╰${hr}╯`);

  return lines.join('\n');
}

export async function checkForRemoteUpdates(): Promise<RemoteUpdateResult | null> {
  try {
    if (process.env['DEV'] === 'true') {
      return null;
    }

    const config = getMolimateConfigSafe();
    if (!config?.url) {
      debugLogger.info(
        'No url in molimate.config.json, skipping remote version check',
      );
      return null;
    }

    const versionUrl = `${config.url.replace(/\/+$/, '')}/version.json`;
    const currentVersion = await getCliVersion();
    if (!currentVersion || currentVersion === 'unknown') {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(versionUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        debugLogger.warn(`Remote version check returned ${res.status}`);
        return null;
      }

      const data = (await res.json()) as RemoteVersionInfo;
      if (!data.version || !semver.valid(data.version)) {
        return null;
      }

      if (semver.gt(data.version, currentVersion)) {
        return { message: buildNotification(currentVersion, data) };
      }

      return null;
    } catch (e) {
      clearTimeout(timeout);
      debugLogger.warn(`Remote version check failed: ${e}`);
      return null;
    }
  } catch (e) {
    debugLogger.warn(`Remote version check failed: ${e}`);
    return null;
  }
}
