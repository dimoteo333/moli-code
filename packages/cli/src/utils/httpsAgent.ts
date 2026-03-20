/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDebugLogger } from '@dobby/moli-code-core';

const logger = createDebugLogger('HTTPS_AGENT');

/**
 * Get custom CA certificates from various sources
 * @returns Array of PEM-formatted certificate strings
 */
function getCustomCACerts(): string[] {
  const certs: string[] = [];

  // 1. Check NODE_EXTRA_CA_CERTS environment variable (Node.js standard)
  const extraCertsPath = process.env['NODE_EXTRA_CA_CERTS'];
  if (extraCertsPath) {
    try {
      const certContent = fs.readFileSync(extraCertsPath, 'utf-8');
      certs.push(certContent);
      logger.debug(
        'Loaded CA certificates from NODE_EXTRA_CA_CERTS:',
        extraCertsPath,
      );
    } catch (error) {
      logger.error('Failed to read NODE_EXTRA_CA_CERTS:', error);
    }
  }

  // 2. Check MOLIMATE_CA_CERT_PATH environment variable (project-specific)
  const molimateCertPath = process.env['MOLIMATE_CA_CERT_PATH'];
  if (molimateCertPath) {
    try {
      const certContent = fs.readFileSync(molimateCertPath, 'utf-8');
      certs.push(certContent);
      logger.debug(
        'Loaded CA certificates from MOLIMATE_CA_CERT_PATH:',
        molimateCertPath,
      );
    } catch (error) {
      logger.error('Failed to read MOLIMATE_CA_CERT_PATH:', error);
    }
  }

  // 3. Check common certificate bundle locations
  const commonCertPaths: Array<[string, string]> = [];

  if (process.platform === 'win32') {
    // Windows certificate bundle locations
    commonCertPaths.push(
      [process.env['LOCALAPPDATA'] || '', 'Certificates/custom-ca.crt'],
      [process.env['ALLUSERSPROFILE'] || '', 'Certificates/custom-ca.crt'],
      ['C:\\', 'certs\\custom-ca.crt'],
    );
  } else if (process.platform === 'darwin') {
    // macOS certificate bundle locations
    commonCertPaths.push(
      [os.homedir(), '.config/moli-code/custom-ca.crt'],
      ['/usr/local/etc', 'moli-code/custom-ca.crt'],
    );
  } else {
    // Linux certificate bundle locations
    commonCertPaths.push(
      [os.homedir(), '.config/moli-code/custom-ca.crt'],
      ['/etc', 'moli-code/custom-ca.crt'],
    );
  }

  for (const [baseDir, filename] of commonCertPaths) {
    const fullPath = path.join(baseDir, filename);
    try {
      if (fs.existsSync(fullPath)) {
        const certContent = fs.readFileSync(fullPath, 'utf-8');
        certs.push(certContent);
        logger.debug('Loaded CA certificates from common path:', fullPath);
      }
    } catch (error) {
      // Ignore errors for optional certificate paths
      logger.error('Failed to read CA certificates:', error);
    }
  }

  return certs;
}

/**
 * Create fetch options with custom SSL certificate support
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Fetch options object with proper SSL configuration
 */
export function createSecureFetchOptions(
  timeoutMs: number = 120000,
): RequestInit {
  const options: RequestInit = {
    signal: AbortSignal.timeout(timeoutMs),
  };

  // Note: Node.js's native fetch automatically respects:
  // - NODE_EXTRA_CA_CERTS environment variable
  // - NODE_TLS_REJECT_UNAUTHORIZED environment variable
  // - System certificate store (on Windows, macOS, Linux)
  //
  // For additional custom certificates, users can set:
  // - MOLIMATE_CA_CERT_PATH=/path/to/custom-ca.crt
  //
  // The certificates are loaded at module initialization time

  return options;
}

/**
 * Initialize custom CA certificates for the process
 * This should be called once at application startup
 */
export function initializeCustomCerts(): void {
  const certs = getCustomCACerts();

  if (certs.length > 0) {
    // Combine all certificates into a single string
    const combinedCerts = certs.join('\n');

    // Set NODE_EXTRA_CA_CERTS to the combined certificates
    // Node.js will automatically use these certificates for all HTTPS requests
    process.env['NODE_EXTRA_CA_CERTS'] = combinedCerts;

    logger.debug(`Initialized ${certs.length} custom CA certificate(s)`);
  } else {
    logger.debug('No custom CA certificates found');
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
- If your network uses a corporate TLS inspection CA, set NODE_EXTRA_CA_CERTS:
  export NODE_EXTRA_CA_CERTS=/path/to/your/corporate-ca.crt

- Or set MOLIMATE_CA_CERT_PATH:
  export MOLIMATE_CA_CERT_PATH=/path/to/your/corporate-ca.crt

- For development only (insecure), you can disable certificate verification:
  export NODE_TLS_REJECT_UNAUTHORIZED=0

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
