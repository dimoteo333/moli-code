package com.moli.code.eclipse;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.moli.code.eclipse.json.Json;

/**
 * A tiny HTTP server implementing the subset of the MCP "streamable HTTP"
 * transport that the Moli Code CLI's IDE client uses:
 *
 * <ul>
 *   <li>POST /mcp — JSON-RPC requests: initialize, tools/list, ping;
 *       notifications are acknowledged with 202.</li>
 *   <li>GET /mcp — long-lived SSE stream used to push
 *       <code>ide/contextUpdate</code> notifications to the CLI.</li>
 *   <li>DELETE /mcp — session termination.</li>
 * </ul>
 *
 * Written against Java 1.4 / raw sockets so it runs inside Eclipse 3.2.2 as
 * well as Eclipse 4.7.3 without any additional libraries.
 */
public class IdeServer implements Runnable {

    private static final String MCP_PATH = "/mcp";
    private static final String DEFAULT_PROTOCOL_VERSION = "2025-03-26";

    private final String authToken;
    private final String sessionId;

    private ServerSocket serverSocket;
    private Thread acceptThread;
    private volatile boolean running;

    /** Connected SSE streams (SseClient). */
    private final List sseClients = new ArrayList();

    /** Last ide/contextUpdate notification JSON, replayed to new streams. */
    private volatile String lastContextNotification;

    public IdeServer(String authToken) {
        this.authToken = authToken;
        this.sessionId = TokenGenerator.generate(16);
    }

    /** Starts the server on an ephemeral loopback port; returns the port. */
    public synchronized int start() throws IOException {
        if (serverSocket != null) {
            return serverSocket.getLocalPort();
        }
        serverSocket = new ServerSocket(0, 50,
                InetAddress.getByName("127.0.0.1"));
        running = true;
        acceptThread = new Thread(this, "Moli Code IDE Server");
        acceptThread.setDaemon(true);
        acceptThread.start();
        return serverSocket.getLocalPort();
    }

    public synchronized void stop() {
        running = false;
        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (IOException e) {
                // Ignore: shutting down.
            }
            serverSocket = null;
        }
        synchronized (sseClients) {
            for (Iterator it = sseClients.iterator(); it.hasNext();) {
                ((SseClient) it.next()).close();
            }
            sseClients.clear();
        }
    }

    public int getPort() {
        ServerSocket s = serverSocket;
        return s == null ? -1 : s.getLocalPort();
    }

    public int getClientCount() {
        synchronized (sseClients) {
            return sseClients.size();
        }
    }

    /**
     * Publishes a new IDE context. The full JSON-RPC notification is built
     * here and pushed to every connected CLI.
     */
    public void publishContext(Map ideContext) {
        Map notification = new LinkedHashMap();
        notification.put("jsonrpc", "2.0");
        notification.put("method", "ide/contextUpdate");
        notification.put("params", ideContext);
        String json = Json.write(notification);
        lastContextNotification = json;
        broadcast(json);
    }

    private void broadcast(String json) {
        synchronized (sseClients) {
            for (Iterator it = sseClients.iterator(); it.hasNext();) {
                SseClient client = (SseClient) it.next();
                if (!client.send(json)) {
                    client.close();
                    it.remove();
                }
            }
        }
    }

    public void run() {
        while (running) {
            final Socket socket;
            try {
                socket = serverSocket.accept();
            } catch (IOException e) {
                if (running) {
                    MoliCodePlugin.logError("IDE server accept failed", e);
                }
                return;
            }
            Thread handler = new Thread(new Runnable() {
                public void run() {
                    handleConnection(socket);
                }
            }, "Moli Code IDE Connection");
            handler.setDaemon(true);
            handler.start();
        }
    }

    // ------------------------------------------------------------------
    // HTTP handling
    // ------------------------------------------------------------------

    private void handleConnection(Socket socket) {
        boolean keepOpen = false;
        try {
            socket.setTcpNoDelay(true);
            InputStream in = new BufferedInputStream(socket.getInputStream());
            OutputStream out = socket.getOutputStream();

            HttpRequest request = HttpRequest.read(in);
            if (request == null) {
                return;
            }

            if (!MCP_PATH.equals(request.path)) {
                writeResponse(out, 404, "Not Found", "text/plain",
                        bytes("not found"), null);
                return;
            }

            if (!isAuthorized(request)) {
                writeResponse(out, 401, "Unauthorized", "text/plain",
                        bytes("unauthorized"), null);
                return;
            }

            if ("POST".equals(request.method)) {
                handlePost(request, out);
            } else if ("GET".equals(request.method)) {
                keepOpen = handleSse(request, socket, out);
            } else if ("DELETE".equals(request.method)) {
                writeResponse(out, 200, "OK", "text/plain", bytes("ok"), null);
            } else {
                writeResponse(out, 405, "Method Not Allowed", "text/plain",
                        bytes("method not allowed"), null);
            }
        } catch (IOException e) {
            // Client went away; nothing to do.
        } catch (RuntimeException e) {
            MoliCodePlugin.logError("IDE server request failed", e);
        } finally {
            if (!keepOpen) {
                try {
                    socket.close();
                } catch (IOException e) {
                    // Ignore.
                }
            }
        }
    }

    private boolean isAuthorized(HttpRequest request) {
        if (authToken == null || authToken.length() == 0) {
            return true;
        }
        String header = request.getHeader("authorization");
        return header != null && header.equals("Bearer " + authToken);
    }

    private void handlePost(HttpRequest request, OutputStream out)
            throws IOException {
        Object message;
        try {
            message = Json.parse(new String(request.body, "UTF-8"));
        } catch (RuntimeException e) {
            writeJson(out, 400, jsonRpcError(null, -32700, "Parse error"));
            return;
        }

        if (!(message instanceof Map)) {
            writeJson(out, 400,
                    jsonRpcError(null, -32600, "Invalid request"));
            return;
        }

        Map rpc = (Map) message;
        Object id = rpc.get("id");
        String method = (String) rpc.get("method");

        if (method == null || id == null) {
            // Notification (or a client response): acknowledge, no body.
            writeResponse(out, 202, "Accepted", null, new byte[0], null);
            return;
        }

        if ("initialize".equals(method)) {
            writeJson(out, 200, initializeResult(rpc, id));
        } else if ("tools/list".equals(method)) {
            Map result = new LinkedHashMap();
            result.put("tools", new ArrayList());
            writeJson(out, 200, jsonRpcResult(id, result));
        } else if ("ping".equals(method)) {
            writeJson(out, 200, jsonRpcResult(id, new HashMap()));
        } else {
            writeJson(out, 200,
                    jsonRpcError(id, -32601, "Method not found"));
        }
    }

    private String initializeResult(Map rpc, Object id) {
        String protocolVersion = DEFAULT_PROTOCOL_VERSION;
        Object params = rpc.get("params");
        if (params instanceof Map) {
            Object requested = ((Map) params).get("protocolVersion");
            if (requested instanceof String) {
                // Echo the client's version: every version the CLI proposes
                // is one it supports.
                protocolVersion = (String) requested;
            }
        }
        Map capabilities = new LinkedHashMap();
        capabilities.put("tools", new HashMap());
        Map serverInfo = new LinkedHashMap();
        serverInfo.put("name", "moli-code-eclipse-companion");
        serverInfo.put("version", "0.1.0");
        Map result = new LinkedHashMap();
        result.put("protocolVersion", protocolVersion);
        result.put("capabilities", capabilities);
        result.put("serverInfo", serverInfo);
        return jsonRpcResult(id, result);
    }

    private boolean handleSse(HttpRequest request, Socket socket,
            OutputStream out) throws IOException {
        String accept = request.getHeader("accept");
        if (accept == null || accept.indexOf("text/event-stream") < 0) {
            writeResponse(out, 405, "Method Not Allowed", "text/plain",
                    bytes("expected text/event-stream"), null);
            return false;
        }

        StringBuffer head = new StringBuffer();
        head.append("HTTP/1.1 200 OK\r\n");
        head.append("Content-Type: text/event-stream\r\n");
        head.append("Cache-Control: no-cache\r\n");
        head.append("Connection: keep-alive\r\n");
        head.append("mcp-session-id: ").append(sessionId).append("\r\n");
        head.append("\r\n");
        out.write(bytes(head.toString()));
        out.flush();

        SseClient client = new SseClient(socket, out);
        String snapshot = lastContextNotification;
        if (snapshot != null && !client.send(snapshot)) {
            client.close();
            return false;
        }
        synchronized (sseClients) {
            sseClients.add(client);
        }
        return true;
    }

    // ------------------------------------------------------------------
    // JSON-RPC helpers
    // ------------------------------------------------------------------

    private static String jsonRpcResult(Object id, Object result) {
        Map response = new LinkedHashMap();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("result", result);
        return Json.write(response);
    }

    private static String jsonRpcError(Object id, int code, String message) {
        Map error = new LinkedHashMap();
        error.put("code", new Integer(code));
        error.put("message", message);
        Map response = new LinkedHashMap();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("error", error);
        return Json.write(response);
    }

    private void writeJson(OutputStream out, int status, String json)
            throws IOException {
        Map extra = new LinkedHashMap();
        extra.put("mcp-session-id", sessionId);
        writeResponse(out, status, status == 200 ? "OK" : "Bad Request",
                "application/json", bytes(json), extra);
    }

    private static void writeResponse(OutputStream out, int status,
            String statusText, String contentType, byte[] body, Map extraHeaders)
            throws IOException {
        StringBuffer head = new StringBuffer();
        head.append("HTTP/1.1 ").append(status).append(' ').append(statusText)
                .append("\r\n");
        if (contentType != null) {
            head.append("Content-Type: ").append(contentType)
                    .append("; charset=utf-8\r\n");
        }
        head.append("Content-Length: ").append(body.length).append("\r\n");
        head.append("Connection: close\r\n");
        if (extraHeaders != null) {
            for (Iterator it = extraHeaders.entrySet().iterator(); it
                    .hasNext();) {
                Map.Entry entry = (Map.Entry) it.next();
                head.append(entry.getKey()).append(": ")
                        .append(entry.getValue()).append("\r\n");
            }
        }
        head.append("\r\n");
        out.write(bytes(head.toString()));
        out.write(body);
        out.flush();
    }

    private static byte[] bytes(String s) {
        try {
            return s.getBytes("UTF-8");
        } catch (UnsupportedEncodingException e) {
            // UTF-8 is mandatory on every JVM.
            return s.getBytes();
        }
    }

    // ------------------------------------------------------------------
    // Inner types
    // ------------------------------------------------------------------

    /** A connected SSE (GET /mcp) client. */
    private static final class SseClient {
        private final Socket socket;
        private final OutputStream out;

        SseClient(Socket socket, OutputStream out) {
            this.socket = socket;
            this.out = out;
        }

        /** Returns false when the stream is broken and should be dropped. */
        boolean send(String json) {
            try {
                synchronized (this) {
                    out.write(bytes("event: message\ndata: " + json + "\n\n"));
                    out.flush();
                }
                return true;
            } catch (IOException e) {
                return false;
            }
        }

        void close() {
            try {
                socket.close();
            } catch (IOException e) {
                // Ignore.
            }
        }
    }

    /** Barebones HTTP/1.1 request parser. */
    private static final class HttpRequest {
        String method;
        String path;
        final Map headers = new HashMap();
        byte[] body = new byte[0];

        String getHeader(String name) {
            return (String) headers.get(name.toLowerCase());
        }

        static HttpRequest read(InputStream in) throws IOException {
            String requestLine = readLine(in);
            if (requestLine == null || requestLine.length() == 0) {
                return null;
            }
            HttpRequest request = new HttpRequest();
            int firstSpace = requestLine.indexOf(' ');
            int secondSpace = requestLine.indexOf(' ', firstSpace + 1);
            if (firstSpace < 0 || secondSpace < 0) {
                return null;
            }
            request.method = requestLine.substring(0, firstSpace);
            String rawPath = requestLine.substring(firstSpace + 1, secondSpace);
            int query = rawPath.indexOf('?');
            request.path = query >= 0 ? rawPath.substring(0, query) : rawPath;

            String line;
            while ((line = readLine(in)) != null && line.length() > 0) {
                int colon = line.indexOf(':');
                if (colon > 0) {
                    String name = line.substring(0, colon).trim().toLowerCase();
                    String value = line.substring(colon + 1).trim();
                    request.headers.put(name, value);
                }
            }

            String lengthHeader = request.getHeader("content-length");
            if (lengthHeader != null) {
                int length;
                try {
                    length = Integer.parseInt(lengthHeader);
                } catch (NumberFormatException e) {
                    return null;
                }
                if (length > 8 * 1024 * 1024) {
                    return null; // Refuse absurdly large payloads.
                }
                byte[] body = new byte[length];
                int off = 0;
                while (off < length) {
                    int n = in.read(body, off, length - off);
                    if (n < 0) {
                        return null;
                    }
                    off += n;
                }
                request.body = body;
            }
            return request;
        }

        /** Reads a CRLF-terminated line as ISO-8859-1 (header charset). */
        private static String readLine(InputStream in) throws IOException {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            int b;
            while ((b = in.read()) >= 0) {
                if (b == '\n') {
                    break;
                }
                if (b != '\r') {
                    buf.write(b);
                }
            }
            if (b < 0 && buf.size() == 0) {
                return null;
            }
            return new String(buf.toByteArray(), "ISO-8859-1");
        }
    }
}
