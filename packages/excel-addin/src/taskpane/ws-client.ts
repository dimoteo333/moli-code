/**
 * ES5-safe WebSocket wrapper: JSON framing, keepalive pings, auto-reconnect
 * with capped backoff. Re-fetches the auth token before every reconnect.
 */

import {
  PROTOCOL_VERSION,
  WS_PATH,
  parseFrame,
  serializeFrame,
  type AnyFrame,
  type PaneToSidecarFrame,
  type SidecarToPaneFrame,
} from '../shared/messages.js';

export interface WsClientCallbacks {
  buildHello: (token: string) => PaneToSidecarFrame;
  onFrame: (frame: SidecarToPaneFrame) => void;
  onStatus: (
    status: 'connecting' | 'connected' | 'disconnected' | 'fatal',
    detail?: string,
  ) => void;
}

export interface WsClient {
  send(frame: PaneToSidecarFrame): boolean;
  close(): void;
}

const PING_INTERVAL_MS = 25000;
const MAX_BACKOFF_MS = 15000;

function fetchToken(onOk: (token: string) => void, onErr: () => void): void {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '/token', true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) {
      return;
    }
    if (xhr.status === 200) {
      try {
        const body = JSON.parse(xhr.responseText) as { token?: string };
        if (body.token) {
          onOk(body.token);
          return;
        }
      } catch (_e) {
        // fall through
      }
    }
    onErr();
  };
  xhr.onerror = function () {
    onErr();
  };
  xhr.send();
}

export function createWsClient(callbacks: WsClientCallbacks): WsClient {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempts = 0;
  let pingTimer: number | null = null;

  function stopPing(): void {
    if (pingTimer !== null) {
      window.clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function scheduleReconnect(): void {
    if (closed) {
      return;
    }
    attempts += 1;
    const delay = Math.min(1000 * attempts, MAX_BACKOFF_MS);
    callbacks.onStatus('disconnected');
    window.setTimeout(connect, delay);
  }

  function connect(): void {
    if (closed) {
      return;
    }
    callbacks.onStatus('connecting');
    fetchToken(
      (token) => {
        const proto =
          window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        let socket: WebSocket;
        try {
          socket = new WebSocket(proto + window.location.host + WS_PATH);
        } catch (_e) {
          scheduleReconnect();
          return;
        }
        ws = socket;
        socket.onopen = function () {
          attempts = 0;
          socket.send(serializeFrame(callbacks.buildHello(token) as AnyFrame));
          callbacks.onStatus('connected');
          stopPing();
          pingTimer = window.setInterval(() => {
            if (socket.readyState === 1) {
              socket.send(
                serializeFrame({ v: PROTOCOL_VERSION, type: 'ping' }),
              );
            }
          }, PING_INTERVAL_MS);
        };
        socket.onmessage = function (event) {
          const frame = parseFrame(String(event.data));
          if (frame) {
            callbacks.onFrame(frame as SidecarToPaneFrame);
          }
        };
        socket.onclose = function () {
          stopPing();
          ws = null;
          scheduleReconnect();
        };
        socket.onerror = function () {
          // onclose follows; nothing to do here.
        };
      },
      () => {
        callbacks.onStatus('disconnected', 'token');
        scheduleReconnect();
      },
    );
  }

  connect();

  return {
    send(frame) {
      if (ws && ws.readyState === 1) {
        ws.send(serializeFrame(frame));
        return true;
      }
      return false;
    },
    close() {
      closed = true;
      stopPing();
      if (ws) {
        ws.close();
      }
    },
  };
}
