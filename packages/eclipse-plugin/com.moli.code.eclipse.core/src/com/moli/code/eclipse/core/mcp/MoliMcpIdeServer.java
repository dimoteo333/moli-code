package com.moli.code.eclipse.core.mcp;

import com.moli.code.eclipse.core.Activator;
import com.moli.code.eclipse.core.context.MoliContextService;
import com.moli.code.eclipse.core.diff.MoliDiffService;
import com.moli.code.eclipse.core.util.Java8Compat;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.eclipse.core.resources.ResourcesPlugin;

/**
 * 한국어 주석: localhost Streamable HTTP 형태의 MCP 엔드포인트와 IDE context 알림을 제공합니다.
 */
public class MoliMcpIdeServer {
    private final MoliDiffService diffService;
    private final MoliContextService contextService;
    private final MoliLockFileService lockFileService = new MoliLockFileService();
    private final McpToolHandler toolHandler;
    private final List<SseClient> clients = new CopyOnWriteArrayList<>();
    private HttpServer server;
    private ExecutorService executor;
    private int port;
    private String authToken;

    public MoliMcpIdeServer(MoliDiffService diffService, MoliContextService contextService) {
        this.diffService = diffService;
        this.contextService = contextService;
        this.toolHandler = new McpToolHandler(diffService);
        this.diffService.setNotificationSink(this::broadcastNotification);
    }

    public synchronized void start() throws IOException {
        if (server != null) {
            return;
        }
        authToken = createToken();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/mcp", this::handleMcp);
        executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.start();
        port = server.getAddress().getPort();
        lockFileService.write(port, workspacePath(), authToken);
        Activator.logInfo("Moli MCP IDE server started on " + getMcpUrl());
    }

    public synchronized void stop() {
        clients.forEach(SseClient::close);
        clients.clear();
        if (server != null) {
            server.stop(0);
            server = null;
        }
        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }
        lockFileService.delete();
        port = 0;
        authToken = null;
    }

    public int getPort() {
        return port;
    }

    public String getAuthToken() {
        return authToken;
    }

    public String getMcpUrl() {
        return "http://127.0.0.1:" + port + "/mcp";
    }

    public boolean isStarted() {
        return server != null;
    }

    public void broadcastContextUpdate() {
        broadcastNotification("{\"jsonrpc\":\"2.0\",\"method\":\"ide/contextUpdate\",\"params\":"
                + contextService.currentContextJson() + "}");
    }

    public void broadcastWorkspaceChanged() {
        broadcastNotification("{\"jsonrpc\":\"2.0\",\"method\":\"ide/workspaceChanged\",\"params\":"
                + contextService.currentContextJson() + "}");
    }

    public void broadcastNotification(String json) {
        for (SseClient client : clients) {
            try {
                client.send(json);
            } catch (IOException ex) {
                Activator.logError("Dropping disconnected MCP SSE client", ex);
                client.close();
                clients.remove(client);
            }
        }
    }

    private void handleMcp(HttpExchange exchange) throws IOException {
        if (!isAuthorized(exchange)) {
            sendText(exchange, 401, "Unauthorized", "text/plain");
            return;
        }
        if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            handleSse(exchange);
            return;
        }
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendText(exchange, 405, "Method Not Allowed", "text/plain");
            return;
        }
        String body = new String(Java8Compat.readAllBytes(exchange.getRequestBody()), StandardCharsets.UTF_8);
        String method = McpToolHandler.Json.field(body, "method");
        String id = McpToolHandler.Json.id(body);
        Headers headers = exchange.getResponseHeaders();
        headers.set("Mcp-Session-Id", UUID.randomUUID().toString());
        headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id");
        try {
            String result;
            if ("initialize".equals(method)) {
                result = "{\"protocolVersion\":\"2025-03-26\",\"capabilities\":{\"tools\":{}},\"serverInfo\":{\"name\":\"moli-code-eclipse\",\"version\":\"0.1.0\"}}";
            } else if ("tools/list".equals(method)) {
                result = toolHandler.toolsListResult();
            } else if ("tools/call".equals(method)) {
                result = toolHandler.handleToolCall(body);
            } else if ("notifications/initialized".equals(method)) {
                result = "{}";
            } else {
                result = "{\"content\":[{\"type\":\"text\",\"text\":\"Unsupported method\"}],\"isError\":true}";
            }
            sendText(exchange, 200, "{\"jsonrpc\":\"2.0\",\"id\":" + id + ",\"result\":" + result + "}", "application/json");
        } catch (Exception ex) {
            Activator.logError("MCP request failed: " + method, ex);
            sendText(exchange, 200, "{\"jsonrpc\":\"2.0\",\"id\":" + id
                    + ",\"error\":{\"code\":-32603,\"message\":\"Internal MCP server error\"}}", "application/json");
        }
    }

    private void handleSse(HttpExchange exchange) throws IOException {
        Headers headers = exchange.getResponseHeaders();
        headers.set("Content-Type", "text/event-stream");
        headers.set("Cache-Control", "no-cache");
        headers.set("Connection", "keep-alive");
        exchange.sendResponseHeaders(200, 0);
        SseClient client = new SseClient(exchange.getResponseBody());
        clients.add(client);
        client.send("{\"jsonrpc\":\"2.0\",\"method\":\"ide/contextUpdate\",\"params\":" + contextService.currentContextJson() + "}");
    }

    private boolean isAuthorized(HttpExchange exchange) {
        List<String> values = exchange.getRequestHeaders().get("Authorization");
        return values != null && values.stream().anyMatch(value -> value.equals("Bearer " + authToken));
    }

    private void sendText(HttpExchange exchange, int status, String text, String contentType) throws IOException {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType + "; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    private String workspacePath() {
        try {
            Path path = ResourcesPlugin.getWorkspace().getRoot().getLocation().toFile().toPath();
            return path.toString();
        } catch (RuntimeException ex) {
            return "";
        }
    }

    private String createToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * 한국어 주석: MCP Streamable HTTP의 GET 연결에 알림을 SSE event로 전달합니다.
     */
    private static class SseClient {
        private final OutputStream stream;

        SseClient(OutputStream stream) {
            this.stream = stream;
        }

        synchronized void send(String json) throws IOException {
            stream.write(("event: message\ndata: " + json + "\n\n").getBytes(StandardCharsets.UTF_8));
            stream.flush();
        }

        void close() {
            try {
                stream.close();
            } catch (IOException ignored) {
                // 한국어 주석: 연결 종료 중 이미 닫힌 스트림은 무시합니다.
            }
        }
    }
}
