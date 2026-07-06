package com.moli.code.eclipse;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.util.LinkedHashMap;
import java.util.Map;

import com.moli.code.eclipse.json.Json;

/**
 * Writes the discovery lock file the Moli Code CLI scans to find running IDE
 * companions: <code>~/.moli/ide/&lt;port&gt;.lock</code>.
 *
 * The file format matches what the VS Code companion writes, plus an
 * <code>ideInfo</code> object so the CLI recognizes Eclipse even though it
 * cannot detect it from environment variables.
 */
public class LockFileManager {

    private File lockFile;

    /**
     * @param port          server port
     * @param authToken     bearer token the CLI must present
     * @param workspacePath path.delimiter-joined workspace roots
     * @param pid           Eclipse JVM pid, or -1 when unknown
     */
    public synchronized void write(int port, String authToken,
            String workspacePath, int pid) throws IOException {
        File ideDir = getIdeDir();
        if (!ideDir.exists() && !ideDir.mkdirs()) {
            throw new IOException("Cannot create " + ideDir.getAbsolutePath());
        }

        Map ideInfo = new LinkedHashMap();
        ideInfo.put("name", "eclipse");
        ideInfo.put("displayName", "Eclipse");

        Map content = new LinkedHashMap();
        content.put("port", String.valueOf(port));
        content.put("workspacePath", workspacePath);
        if (pid > 0) {
            content.put("ppid", new Integer(pid));
        }
        content.put("authToken", authToken);
        content.put("ideInfo", ideInfo);
        // Older CLI builds read `ideName` instead of `ideInfo`.
        content.put("ideName", "Eclipse");

        File file = new File(ideDir, port + ".lock");
        Writer writer = new OutputStreamWriter(new FileOutputStream(file),
                "UTF-8");
        try {
            writer.write(Json.write(content));
        } finally {
            writer.close();
        }
        this.lockFile = file;
    }

    public synchronized void delete() {
        if (lockFile != null) {
            lockFile.delete();
            lockFile = null;
        }
    }

    public synchronized File getLockFile() {
        return lockFile;
    }

    static File getIdeDir() {
        String home = System.getProperty("user.home");
        if (home == null || home.length() == 0) {
            home = System.getProperty("java.io.tmpdir");
        }
        return new File(new File(home, ".moli"), "ide");
    }
}
