/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import tls from 'node:tls';
import { createDebugLogger } from '@dobby/moli-code-core';

const logger = createDebugLogger('HTTPS_AGENT');

/**
 * Extract CA certificates from Windows certificate store using certutil.
 * Parses PEM-formatted certificate blocks from certutil output.
 * @returns Array of PEM-formatted certificate strings
 */
function extractWindowsCerts(): string[] {
  const certs: string[] = [];
  // Machine-level Root and CA stores cover corporate/enterprise certificates
  const stores = ['Root', 'CA'];

  for (const store of stores) {
    try {
      const output = execSync(`certutil -store ${store}`, {
        encoding: 'utf-8',
        timeout: 15000,
        windowsHide: true,
      });

      const pemRegex =
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
      const matches = output.match(pemRegex);
      if (matches) {
        certs.push(...matches);
      }
    } catch (error) {
      logger.error(
        `Failed to read Windows certificate store "${store}":`,
        error,
      );
    }
  }

  return certs;
}

/**
 * Monkey-patch tls.createSecureContext to include Windows system certificates.
 * This ensures all TLS connections (including fetch/undici) trust
 * certificates from the Windows certificate store.
 */
function injectCertsIntoTLS(windowsCerts: string[]): void {
  if (windowsCerts.length === 0) return;

  const origCreateSecureContext = tls.createSecureContext;

  tls.createSecureContext = function (options?: tls.SecureContextOptions) {
    // If caller provided custom ca, merge with Windows certs.
    // If not, use Node.js default root certs + Windows certs.
    const existingCA = options?.ca
      ? Array.isArray(options.ca)
        ? options.ca
        : [options.ca]
      : tls.rootCertificates;

    const mergedOptions = {
      ...options,
      ca: [...existingCA, ...windowsCerts],
    };

    return origCreateSecureContext.call(tls, mergedOptions);
  };
}

/**
 * Initialize Windows certificate store CA certificates for Node.js.
 * Uses certutil to extract certificates and injects them into Node.js's TLS trust store.
 * This should be called once at application startup.
 */
export function initializeCustomCerts(): void {
  if (process.platform !== 'win32') {
    logger.debug(
      'Skipping Windows certificate injection: not running on Windows',
    );
    return;
  }

  try {
    const certs = extractWindowsCerts();

    if (certs.length > 0) {
      injectCertsIntoTLS(certs);
      logger.debug(
        `Injected ${certs.length} certificates from Windows certificate store`,
      );
    } else {
      logger.debug('No certificates found in Windows certificate store');
    }
  } catch (error) {
    logger.error('Failed to initialize Windows certificates:', error);
  }
}

/**
 * Get a user-friendly error message for TLS/SSL errors
 * @param error - The error object
 * @returns Formatted error message with troubleshooting tips
 */
export function formatTLSError(error: unknown): string {
  if (error instanceof Error) {
    const errorMessage = error.message;

    // Check for common TLS error codes
    if (
      errorMessage.includes('UNABLE_TO_GET_ISSUER_CERT_LOCALLY') ||
      errorMessage.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
      errorMessage.includes('SELF_SIGNED_CERT_IN_CHAIN') ||
      errorMessage.includes('DEPTH_ZERO_SELF_SIGNED_CERT') ||
      errorMessage.includes('CERT_HAS_EXPIRED') ||
      errorMessage.includes('ERR_TLS_CERT_ALTNAME_INVALID')
    ) {
      return `SSL/TLS Certificate Error: ${errorMessage}

Troubleshooting:
- If your network uses a corporate TLS inspection CA, import it into the Windows certificate store:
  certutil -addstore -f "Root" your-corporate-ca.crt

- Alternatively, set NODE_EXTRA_CA_CERTS:
  set NODE_EXTRA_CA_CERTS=C:\\path\\to\\your\\corporate-ca.crt

- For development only (insecure), you can disable certificate verification:
  set NODE_TLS_REJECT_UNAUTHORIZED=0

  WARNING: This is insecure and should never be used in production!`;
    }

    if (
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ECONNREFUSED')
    ) {
      return `Network Error: ${errorMessage}

Please check:
- Your internet connection
- Firewall settings
- Proxy configuration (if applicable)`;
    }
  }

  return `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
}
