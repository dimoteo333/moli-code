/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RemoteUpdateResult } from '../ui/utils/remoteVersionCheck.js';
import { updateEventEmitter } from './updateEventEmitter.js';

export function handleRemoteUpdate(info: RemoteUpdateResult | null): void {
  if (!info) return;

  updateEventEmitter.emit('update-info', {
    message: info.message,
  });
}
