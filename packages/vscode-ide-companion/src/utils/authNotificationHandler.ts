/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import type { AuthenticateUpdateNotification } from '../types/acpTypes.js';
import { UI_STRINGS } from '../i18n/strings.js';

// Store reference to the current notification
let currentNotification: Thenable<string | undefined> | null = null;

/**
 * Handle authentication update notifications by showing a VS Code notification
 * with the authentication URI and action buttons.
 *
 * @param data - Authentication update notification data containing the auth URI
 */
export function handleAuthenticateUpdate(
  data: AuthenticateUpdateNotification,
): void {
  const authUri = data._meta.authUri;

  // Store reference to the current notification
  currentNotification = vscode.window.showInformationMessage(
    UI_STRINGS.authNeedsAction,
    UI_STRINGS.openInBrowser,
    UI_STRINGS.copyLink,
    UI_STRINGS.dismiss,
  );

  currentNotification.then((selection) => {
    if (selection === UI_STRINGS.openInBrowser) {
      // Open the authentication URI in the default browser
      vscode.env.openExternal(vscode.Uri.parse(authUri));
      vscode.window.showInformationMessage(UI_STRINGS.openingAuthPage);
    } else if (selection === UI_STRINGS.copyLink) {
      // Copy the authentication URI to clipboard
      vscode.env.clipboard.writeText(authUri);
      vscode.window.showInformationMessage(UI_STRINGS.copiedAuthLink);
    }

    // Clear the notification reference after user interaction
    currentNotification = null;
  });
}
