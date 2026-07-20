/**
 * WebSocket endpoint (wss://localhost:<port>/ws). The first frame from the
 * pane must be a `hello` carrying the auth token (fetched from /token);
 * anything else closes the socket. One PaneSession per connection.
 */

import type * as http from 'node:http';
import type * as https from 'node:https';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { WS_PATH, parseFrame } from '../shared/messages.js';
import { MAX_WEBSOCKET_PAYLOAD_BYTES } from '../shared/attachment-limits.js';
import type { HelloFrame } from '../shared/messages.js';
import { PaneSession, type SessionEnv } from './session.js';
import type { Logger } from './logger.js';

const HELLO_TIMEOUT_MS = 10_000;

export function attachWsServer(
  server: https.Server | http.Server,
  authToken: string,
  env: SessionEnv,
  logger: Logger,
): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WEBSOCKET_PAYLOAD_BYTES,
  });

  server.on('upgrade', (req, socket, head) => {
    const url = (req.url ?? '').split('?')[0];
    const host = req.headers.host ?? '';
    const allowedHosts = [`localhost:${env.port}`, `127.0.0.1:${env.port}`];
    if (url !== WS_PATH || !allowedHosts.includes(host)) {
      logger.warn(`Rejected WS upgrade: url=${url} host=${host}`);
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('WS connection opened, awaiting hello');
    let session: PaneSession | null = null;

    const helloTimer = setTimeout(() => {
      if (!session) {
        logger.warn('WS hello timeout, closing');
        ws.close(4001, 'hello timeout');
      }
    }, HELLO_TIMEOUT_MS);

    ws.on('message', (data) => {
      const frame = parseFrame(String(data));
      if (!frame) {
        logger.warn('Dropping malformed WS frame');
        return;
      }
      if (!session) {
        if (frame.type !== 'hello') {
          ws.close(4002, 'expected hello');
          return;
        }
        const hello = frame as HelloFrame;
        if (hello.token !== authToken) {
          logger.warn('WS hello with invalid token');
          ws.close(4003, 'invalid token');
          return;
        }
        clearTimeout(helloTimer);
        session = new PaneSession(ws, hello, env, logger);
        return;
      }
      try {
        session.onFrame(frame);
      } catch (err) {
        logger.error(`Unhandled error handling '${frame.type}' frame`, err);
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (session) {
        session.dispose('pane disconnected');
        session = null;
      }
      logger.info('WS connection closed');
    });

    ws.on('error', (err) => {
      logger.error('WS error', err);
    });
  });

  return wss;
}
