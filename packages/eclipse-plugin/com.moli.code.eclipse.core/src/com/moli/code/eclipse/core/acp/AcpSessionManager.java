package com.moli.code.eclipse.core.acp;

import com.moli.code.eclipse.core.Activator;
import com.moli.code.eclipse.core.mcp.MoliMcpIdeServer;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 한국어 주석: ACP subprocess와 session/new로 얻은 ACP 세션의 수명, 유휴 만료, 재시작을 관리합니다.
 */
public class AcpSessionManager implements AutoCloseable {
    private static final Duration SESSION_IDLE_TIMEOUT = Duration.ofMinutes(30);

    private final MoliAcpClientService clientService;
    private final ScheduledExecutorService reaper = Executors.newSingleThreadScheduledExecutor(
            runnable -> new Thread(runnable, "Moli ACP Session Reaper"));

    private Instant lastUsedAt = Instant.EPOCH;
    private boolean started;

    public AcpSessionManager(MoliMcpIdeServer ideServer) {
        this.clientService = new MoliAcpClientService(ideServer);
    }

    public synchronized void start() {
        if (started) {
            return;
        }
        started = true;
        lastUsedAt = Instant.now();
        reaper.scheduleWithFixedDelay(this::closeIdleSession, 1, 1, TimeUnit.MINUTES);
    }

    public MoliAcpClientService client() {
        return clientService;
    }

    public void sendPrompt(String prompt) {
        markUsed();
        clientService.sendPrompt(prompt);
    }

    public synchronized void invalidateSession() {
        clientService.resetSession();
    }

    public synchronized void restart() {
        try {
            clientService.restart();
            lastUsedAt = Instant.now();
        } catch (Exception ex) {
            Activator.logError("Failed to restart ACP session", ex);
        }
    }

    public synchronized boolean isSessionActive() {
        return clientService.hasSession();
    }

    private synchronized void markUsed() {
        if (!started) {
            start();
        }
        lastUsedAt = Instant.now();
    }

    private void closeIdleSession() {
        try {
            synchronized (this) {
                if (!started || !clientService.hasSession()) {
                    return;
                }
                if (Duration.between(lastUsedAt, Instant.now()).compareTo(SESSION_IDLE_TIMEOUT) < 0) {
                    return;
                }
            }
            clientService.closeSession();
            Activator.logInfo("Closed idle Moli ACP session");
        } catch (Exception ex) {
            Activator.logError("Failed to close idle ACP session", ex);
        }
    }

    @Override
    public void close() throws Exception {
        synchronized (this) {
            started = false;
        }
        reaper.shutdownNow();
        clientService.close();
    }
}
