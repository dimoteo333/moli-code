package com.moli.code.eclipse.core.acp;

import com.moli.code.eclipse.core.Activator;
import com.moli.code.eclipse.core.mcp.MoliMcpIdeServer;
import com.moli.code.eclipse.core.util.Java8Compat;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.eclipse.jface.preference.IPreferenceStore;

/**
 * 한국어 주석: ACP subprocess transport를 통해 node cli.js --acp --channel=Eclipse와 통신합니다.
 */
public class MoliAcpClientService implements AutoCloseable {
    private final MoliMcpIdeServer ideServer;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> new Thread(r, "Moli ACP Client"));
    private final List<ChatEventListener> listeners = new CopyOnWriteArrayList<>();
    private final LinkedBlockingQueue<String> stdoutLines = new LinkedBlockingQueue<>();
    private final AtomicInteger ids = new AtomicInteger(1);

    private Process process;
    private BufferedWriter stdin;
    private String sessionId;
    private boolean initialized;
    private boolean authenticated;

    public MoliAcpClientService(MoliMcpIdeServer ideServer) {
        this.ideServer = ideServer;
    }

    public void addListener(ChatEventListener listener) {
        listeners.add(Objects.requireNonNull(listener));
    }

    public void removeListener(ChatEventListener listener) {
        listeners.remove(listener);
    }

    public void sendPrompt(String prompt) {
        executor.submit(() -> {
            try {
                ensureSession();
                int id = ids.incrementAndGet();
                String request = "{\"jsonrpc\":\"2.0\",\"id\":" + id + ",\"method\":\"session/prompt\",\"params\":{\"sessionId\":"
                        + quote(sessionId) + ",\"prompt\":[{\"type\":\"text\",\"text\":" + quote(prompt) + "}]}}";
                write(request);
                waitForResponse(id, true);
                listeners.forEach(ChatEventListener::onPromptFinished);
            } catch (Exception ex) {
                Activator.logError("ACP prompt failed", ex);
                resetDeadProcess();
                String message = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
                listeners.forEach(listener -> listener.onError(message));
            }
        });
    }

    public boolean hasSession() {
        return !Java8Compat.isBlank(sessionId) && process != null && process.isAlive();
    }

    public void resetSession() {
        sessionId = null;
    }

    public void restart() throws IOException {
        closeTransport();
        startProcess();
    }

    public void closeSession() throws InterruptedException, ExecutionException {
        executor.submit(() -> {
            try {
                closeTransport();
            } catch (IOException ex) {
                Activator.logError("Failed to close ACP transport", ex);
            }
        }).get();
    }

    private synchronized void ensureSession() throws IOException, InterruptedException {
        if (process == null || !process.isAlive()) {
            startProcess();
            initialize();
            authenticate();
        } else if (!initialized) {
            initialize();
            authenticate();
        } else if (!authenticated) {
            authenticate();
        }
        if (Java8Compat.isBlank(sessionId)) {
            newSession();
        }
    }

    private synchronized void startProcess() throws IOException {
        IPreferenceStore store = Activator.preferences();
        String nodePath = store.getString(Activator.PREF_NODE_PATH);
        String moliPath = store.getString(Activator.PREF_MOLI_CODE_PATH);
        ProcessBuilder builder = new ProcessBuilder(Java8Compat.isBlank(nodePath) ? "node" : nodePath,
                "cli.js", "--acp", "--channel=Eclipse");
        if (!Java8Compat.isBlank(moliPath)) {
            builder.directory(new File(moliPath));
        }
        if (store.getBoolean(Activator.PREF_ENABLE_PROXY) && !Java8Compat.isBlank(store.getString(Activator.PREF_PROXY_URL))) {
            builder.environment().put("HTTPS_PROXY", store.getString(Activator.PREF_PROXY_URL));
            builder.environment().put("HTTP_PROXY", store.getString(Activator.PREF_PROXY_URL));
        }
        stdoutLines.clear();
        process = builder.start();
        stdin = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
        initialized = false;
        authenticated = false;
        sessionId = null;
        startReader(process.getInputStream(), stdoutLines);
        startErrorReader();
        Activator.logInfo("Started Moli ACP subprocess");
    }

    private void initialize() throws IOException, InterruptedException {
        int id = ids.incrementAndGet();
        write("{\"jsonrpc\":\"2.0\",\"id\":" + id + ",\"method\":\"initialize\",\"params\":{\"protocolVersion\":1,"
                + "\"clientCapabilities\":{\"fs\":{\"readTextFile\":false,\"writeTextFile\":false},\"terminal\":false},"
                + "\"clientInfo\":{\"name\":\"moli-code-eclipse\",\"title\":\"Moli Code Eclipse\",\"version\":\"0.1.0\"}}}");
        waitForResponse(id, false);
        initialized = true;
    }

    private void authenticate() throws IOException, InterruptedException {
        IPreferenceStore store = Activator.preferences();
        String authType = store.getString(Activator.PREF_AUTH_TYPE);
        int id = ids.incrementAndGet();
        write("{\"jsonrpc\":\"2.0\",\"id\":" + id + ",\"method\":\"authenticate\",\"params\":{\"methodId\":"
                + quote(Java8Compat.isBlank(authType) ? "moli-oauth" : authType) + "}}");
        String response = waitForResponse(id, true);
        if (response.contains("\"error\"")) {
            throw new IOException("ACP authentication failed: " + response);
        }
        authenticated = true;
    }

    private void newSession() throws IOException, InterruptedException {
        int id = ids.incrementAndGet();
        String cwd = workspacePath();
        String mcp = "{\"type\":\"http\",\"name\":\"moli-eclipse-ide\",\"url\":" + quote(ideServer.getMcpUrl())
                + ",\"headers\":[{\"name\":\"Authorization\",\"value\":" + quote("Bearer " + ideServer.getAuthToken()) + "}]}";
        write("{\"jsonrpc\":\"2.0\",\"id\":" + id + ",\"method\":\"session/new\",\"params\":{\"cwd\":"
                + quote(cwd) + ",\"mcpServers\":[" + mcp + "]}}");
        String response = waitForResponse(id, false);
        sessionId = extractField(response, "sessionId");
        if (Java8Compat.isBlank(sessionId)) {
            throw new IOException("ACP session/new did not return a sessionId");
        }
        Activator.logInfo("Created Moli ACP session");
    }

    private String waitForResponse(int id, boolean dispatchNotifications) throws InterruptedException {
        String idMarker = "\"id\":" + id;
        while (true) {
            String line = stdoutLines.poll(30, TimeUnit.MINUTES);
            if (line == null) {
                throw new IllegalStateException("ACP response timeout");
            }
            if (line.contains(idMarker)) {
                if (line.contains("\"error\"")) {
                    throw new IllegalStateException("ACP request " + id + " failed: " + line);
                }
                if (dispatchNotifications) {
                    dispatchNotification(line);
                }
                return line;
            }
            if (dispatchNotifications) {
                dispatchNotification(line);
            }
        }
    }

    private void dispatchNotification(String line) {
        if (!line.contains("\"method\"")) {
            return;
        }
        if (line.contains("\"authenticate/update\"")) {
            String authUri = extractField(line, "authUri");
            if (!authUri.isEmpty()) {
                listeners.forEach(listener -> listener.onLog("Authenticate: " + authUri));
            }
        }
        String text = extractTextContent(line);
        if (!text.isEmpty()) {
            listeners.forEach(listener -> listener.onTextChunk(text));
        }
    }

    private String extractTextContent(String json) {
        int typeIndex = json.indexOf("\"type\":\"text\"");
        if (typeIndex < 0) {
            typeIndex = json.indexOf("\"type\": \"text\"");
        }
        if (typeIndex >= 0) {
            String text = extractField(json.substring(typeIndex), "text");
            if (!text.isEmpty()) {
                return text;
            }
        }
        return extractField(json, "text");
    }

    private void write(String json) throws IOException {
        if (stdin == null) {
            throw new IOException("ACP process is not started");
        }
        stdin.write(json);
        stdin.newLine();
        stdin.flush();
    }

    private void startReader(java.io.InputStream inputStream, LinkedBlockingQueue<String> queue) {
        Thread thread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    queue.offer(line);
                }
            } catch (IOException ignored) {
                // 한국어 주석: 프로세스 종료 시 stdout reader가 닫히는 것은 정상 종료 경로입니다.
            }
        }, "Moli ACP stdout");
        thread.setDaemon(true);
        thread.start();
    }

    private void startErrorReader() {
        Thread thread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String message = line;
                    Activator.logInfo("ACP stderr: " + message);
                    listeners.forEach(listener -> listener.onLog(message));
                }
            } catch (IOException ignored) {
                // 한국어 주석: 프로세스 종료 시 stderr reader가 닫히는 것은 정상 종료 경로입니다.
            }
        }, "Moli ACP stderr");
        thread.setDaemon(true);
        thread.start();
    }

    private synchronized void resetDeadProcess() {
        if (process != null && process.isAlive()) {
            return;
        }
        sessionId = null;
        initialized = false;
        authenticated = false;
    }

    private synchronized void closeTransport() throws IOException {
        sessionId = null;
        initialized = false;
        authenticated = false;
        if (stdin != null) {
            stdin.close();
            stdin = null;
        }
        if (process != null) {
            process.destroy();
            process = null;
        }
    }

    private String workspacePath() {
        try {
            return org.eclipse.core.resources.ResourcesPlugin.getWorkspace().getRoot().getLocation().toOSString();
        } catch (RuntimeException ex) {
            return System.getProperty("user.dir", "");
        }
    }

    private static String extractField(String json, String name) {
        int key = json.indexOf('"' + name + '"');
        if (key < 0) {
            return "";
        }
        int colon = json.indexOf(':', key);
        int start = skipWhitespace(json, colon + 1);
        if (start >= json.length() || json.charAt(start) != '"') {
            return "";
        }
        return readString(json, start);
    }

    private static int skipWhitespace(String json, int start) {
        int index = Math.max(0, start);
        while (index < json.length() && Character.isWhitespace(json.charAt(index))) {
            index++;
        }
        return index;
    }

    private static String readString(String json, int start) {
        StringBuilder builder = new StringBuilder();
        boolean escaped = false;
        for (int i = start + 1; i < json.length(); i++) {
            char c = json.charAt(i);
            if (escaped) {
                switch (c) {
                    case '"':
                        builder.append('"');
                        break;
                    case '\\':
                        builder.append('\\');
                        break;
                    case 'n':
                        builder.append('\n');
                        break;
                    case 'r':
                        builder.append('\r');
                        break;
                    case 't':
                        builder.append('\t');
                        break;
                    case 'u':
                        if (i + 4 < json.length()) {
                            builder.append((char) Integer.parseInt(json.substring(i + 1, i + 5), 16));
                            i += 4;
                        }
                        break;
                    default:
                        builder.append(c);
                        break;
                }
                escaped = false;
            } else if (c == '\\') {
                escaped = true;
            } else if (c == '"') {
                return builder.toString();
            } else {
                builder.append(c);
            }
        }
        return builder.toString();
    }

    private static String quote(String value) {
        if (value == null) {
            return "null";
        }
        StringBuilder builder = new StringBuilder(value.length() + 16).append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':
                    builder.append("\\\"");
                    break;
                case '\\':
                    builder.append("\\\\");
                    break;
                case '\n':
                    builder.append("\\n");
                    break;
                case '\r':
                    builder.append("\\r");
                    break;
                case '\t':
                    builder.append("\\t");
                    break;
                default:
                    builder.append(c);
                    break;
            }
        }
        return builder.append('"').toString();
    }

    @Override
    public void close() throws Exception {
        executor.shutdownNow();
        closeTransport();
    }

    /**
     * 한국어 주석: UI가 스트리밍 텍스트와 완료/오류 이벤트를 수신하기 위한 listener입니다.
     */
    public interface ChatEventListener {
        void onTextChunk(String text);

        void onPromptFinished();

        void onError(String message);

        default void onLog(String message) {
            // 한국어 주석: stderr 로그는 필요한 UI에서만 표시합니다.
        }
    }
}
