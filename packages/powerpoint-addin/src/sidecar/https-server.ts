/**
 * HTTPS server: serves the bundled task-pane assets, plus /health (unauthed,
 * used by the installer and single-instance probing) and /token (Origin- and
 * Host-pinned, hands the WS auth token to the pane).
 *
 * Host-header pinning mirrors packages/vscode-ide-companion/src/ide-server.ts.
 */

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import type { Logger } from './logger.js';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
};

export interface HttpsServerOptions {
  port: number;
  webRoot: string;
  /** Either a PFX bundle (prod, installer-generated)… */
  pfxPath?: string;
  passphrase?: string;
  /** …or PEM cert+key (dev). */
  pemCertPath?: string;
  pemKeyPath?: string;
  authToken: string;
  version: string;
  logger: Logger;
  /** Dev-only: serve plain HTTP (for browser tooling that rejects self-signed certs). */
  insecureHttp?: boolean;
}

function tlsOptions(options: HttpsServerOptions): https.ServerOptions {
  if (options.pfxPath && fs.existsSync(options.pfxPath)) {
    return {
      pfx: fs.readFileSync(options.pfxPath),
      passphrase: options.passphrase,
    };
  }
  if (options.pemCertPath && options.pemKeyPath) {
    return {
      cert: fs.readFileSync(options.pemCertPath),
      key: fs.readFileSync(options.pemKeyPath),
    };
  }
  throw new Error('No TLS certificate configured (pfx or pem)');
}

export function createHttpsServer(
  options: HttpsServerOptions,
): https.Server | http.Server {
  const { port, webRoot, authToken, version, logger } = options;

  const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`];
  const scheme = options.insecureHttp ? 'http' : 'https';
  const allowedOrigins = [
    `${scheme}://localhost:${port}`,
    `${scheme}://127.0.0.1:${port}`,
  ];

  const handler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void => {
    const host = req.headers.host ?? '';
    if (!allowedHosts.includes(host)) {
      logger.warn(`Rejected request with invalid Host header: ${host}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid Host header' }));
      return;
    }

    const url = (req.url ?? '/').split('?')[0];
    logger.debug(`HTTP ${req.method} ${url}`);

    if (req.method !== 'GET') {
      res.writeHead(405);
      res.end();
      return;
    }

    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          name: 'moli-powerpoint-sidecar',
          version,
          pid: process.pid,
        }),
      );
      return;
    }

    if (url === '/token') {
      // The pane fetches same-origin, so Origin is usually absent; a
      // cross-origin browser request would carry a foreign Origin.
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) {
        logger.warn(`Rejected /token request from origin: ${origin}`);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ token: authToken }));
      return;
    }

    serveStatic(webRoot, url, res, logger);
  };

  if (options.insecureHttp) {
    logger.warn(
      'Serving plain HTTP (dev --insecure-http mode) — never use in production',
    );
    return http.createServer(handler);
  }
  return https.createServer(tlsOptions(options), handler);
}

function serveStatic(
  webRoot: string,
  url: string,
  res: import('node:http').ServerResponse,
  logger: Logger,
): void {
  // Drop query string / fragment (e.g. cache-busting ?v=... on icon URLs).
  const pathname = url.split(/[?#]/, 1)[0];
  const rel =
    pathname === '/'
      ? 'taskpane.html'
      : pathname === '/favicon.ico'
        ? 'assets/icon-32.png'
        : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(webRoot, rel);
  // Path-traversal guard: the resolved path must stay inside webRoot.
  if (resolved !== webRoot && !resolved.startsWith(webRoot + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      logger.warn(`404 ${url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}
