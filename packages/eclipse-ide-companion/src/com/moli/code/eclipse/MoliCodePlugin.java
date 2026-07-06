package com.moli.code.eclipse;

import java.io.File;
import java.lang.reflect.Method;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Status;
import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

/**
 * Activator for the Moli Code Eclipse companion.
 *
 * On startup it launches the local IDE server and writes the discovery lock
 * file so a Moli Code CLI running in any terminal whose cwd is inside this
 * workspace can connect, receive open-file context, and stay in sync.
 */
public class MoliCodePlugin extends AbstractUIPlugin {

    public static final String PLUGIN_ID = "com.moli.code.eclipse.companion";

    private static MoliCodePlugin plugin;

    private IdeServer server;
    private OpenFilesTracker tracker;
    private LockFileManager lockFileManager;

    public void start(BundleContext context) throws Exception {
        super.start(context);
        plugin = this;
        try {
            String authToken = TokenGenerator.generate(32);
            server = new IdeServer(authToken);
            int port = server.start();
            lockFileManager = new LockFileManager();
            lockFileManager.write(port, authToken, computeWorkspacePath(),
                    getJvmPid());
        } catch (Exception e) {
            logError("Failed to start the Moli Code companion server", e);
        }
    }

    public void stop(BundleContext context) throws Exception {
        if (tracker != null) {
            tracker.uninstall();
            tracker = null;
        }
        if (server != null) {
            server.stop();
            server = null;
        }
        if (lockFileManager != null) {
            lockFileManager.delete();
            lockFileManager = null;
        }
        plugin = null;
        super.stop(context);
    }

    public static MoliCodePlugin getDefault() {
        return plugin;
    }

    public IdeServer getServer() {
        return server;
    }

    public LockFileManager getLockFileManager() {
        return lockFileManager;
    }

    /**
     * Installs workbench listeners that publish open-editor context. Must be
     * called from the UI thread (see {@link StartupHook}).
     */
    public synchronized void installTracker() {
        if (tracker == null && server != null) {
            tracker = new OpenFilesTracker(server);
            tracker.install();
        }
    }

    /**
     * The CLI validates that its cwd falls under one of these
     * path-separator-joined roots. When the JVM pid is unknown the CLI falls
     * back to an existence check on the whole string, so multiple roots are
     * only advertised when the pid could be determined (see the staleness
     * logic in ide-client).
     */
    private static String computeWorkspacePath() {
        IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();
        IPath rootLocation = root.getLocation();
        String rootPath = rootLocation == null ? null : rootLocation
                .toOSString();

        if (getJvmPid() <= 0) {
            return rootPath == null ? "" : rootPath;
        }

        StringBuffer sb = new StringBuffer();
        if (rootPath != null) {
            sb.append(rootPath);
        }
        IProject[] projects = root.getProjects();
        for (int i = 0; i < projects.length; i++) {
            IPath location = projects[i].getLocation();
            if (location == null) {
                continue;
            }
            String path = location.toOSString();
            if (rootPath != null && path.startsWith(rootPath)) {
                continue; // Already covered by the workspace root.
            }
            if (sb.length() > 0) {
                sb.append(File.pathSeparatorChar);
            }
            sb.append(path);
        }
        return sb.toString();
    }

    /**
     * Best-effort JVM pid lookup. java.lang.management only exists on 1.5+,
     * so it is reached via reflection and failure simply returns -1 (the lock
     * file then omits ppid and the CLI uses the workspace-path existence
     * check instead).
     */
    static int getJvmPid() {
        try {
            Class factory = Class.forName("java.lang.management.ManagementFactory");
            Object bean = factory.getMethod("getRuntimeMXBean", new Class[0])
                    .invoke(null, new Object[0]);
            Class beanInterface = Class
                    .forName("java.lang.management.RuntimeMXBean");
            Method getName = beanInterface.getMethod("getName", new Class[0]);
            String name = (String) getName.invoke(bean, new Object[0]);
            int at = name.indexOf('@');
            if (at > 0) {
                return Integer.parseInt(name.substring(0, at));
            }
        } catch (Throwable t) {
            // Java 1.4 runtime or restricted environment: pid unavailable.
        }
        return -1;
    }

    public static void logError(String message, Throwable t) {
        MoliCodePlugin instance = plugin;
        if (instance != null) {
            instance.getLog().log(
                    new Status(IStatus.ERROR, PLUGIN_ID, 0, message, t));
        }
    }
}
