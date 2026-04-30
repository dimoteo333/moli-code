package com.moli.code.eclipse.core.mcp;

import com.moli.code.eclipse.core.util.Java8Compat;
import java.io.File;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.util.EnumSet;
import java.util.Set;

/**
 * 한국어 주석: ~/.moli/ide/&lt;port&gt;.lock 파일을 생성하고 삭제합니다.
 */
public class MoliLockFileService {
    private Path lockFile;

    public synchronized Path write(int port, String workspacePath, String authToken) throws IOException {
        File home = new File(System.getProperty("user.home", System.getProperty("java.io.tmpdir")));
        Path ideDir = new File(new File(home, ".moli"), "ide").toPath();
        Files.createDirectories(ideDir);
        lockFile = ideDir.resolve(port + ".lock");
        long ppid = currentPid();
        String json = "{"
                + "\"port\":" + port + ","
                + "\"workspacePath\":" + quote(workspacePath) + ","
                + "\"ppid\":" + ppid + ","
                + "\"authToken\":" + quote(authToken) + ","
                + "\"ideName\":\"Eclipse\""
                + "}";
        Java8Compat.writeString(lockFile, json, StandardCharsets.UTF_8);
        try {
            Set<PosixFilePermission> permissions = EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(lockFile, permissions);
        } catch (UnsupportedOperationException ignored) {
            // 한국어 주석: Windows 파일 시스템에서는 POSIX 권한 설정을 건너뜁니다.
        }
        return lockFile;
    }

    private static long currentPid() {
        String runtimeName = ManagementFactory.getRuntimeMXBean().getName();
        int at = runtimeName.indexOf('@');
        if (at > 0) {
            try {
                return Long.parseLong(runtimeName.substring(0, at));
            } catch (NumberFormatException ignored) {
                // 한국어 주석: Java 8 표준 API만으로 PID를 얻지 못하면 0을 사용합니다.
            }
        }
        return 0L;
    }

    public synchronized void delete() {
        if (lockFile != null) {
            try {
                Files.deleteIfExists(lockFile);
            } catch (IOException ignored) {
                // 한국어 주석: 종료 시 lock file 삭제 실패는 다음 기동 때 정리될 수 있으므로 무시합니다.
            }
        }
    }

    private static String quote(String value) {
        if (value == null) {
            return "\"\"";
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }
}
