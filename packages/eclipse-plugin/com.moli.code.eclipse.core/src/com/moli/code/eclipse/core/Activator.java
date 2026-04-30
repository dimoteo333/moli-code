package com.moli.code.eclipse.core;

import com.moli.code.eclipse.core.acp.AcpSessionManager;
import com.moli.code.eclipse.core.context.MoliContextService;
import com.moli.code.eclipse.core.diff.MoliDiffService;
import com.moli.code.eclipse.core.mcp.MoliMcpIdeServer;
import org.eclipse.core.resources.IResourceChangeEvent;
import org.eclipse.core.resources.IResourceChangeListener;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Status;
import org.eclipse.jface.preference.IPreferenceStore;
import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

/**
 * 한국어 주석: core 번들의 생명주기를 관리하고 ACP/MCP/컨텍스트 서비스를 공유합니다.
 */
public class Activator extends AbstractUIPlugin {
    public static final String PLUGIN_ID = "com.moli.code.eclipse.core";
    public static final String PREF_NODE_PATH = "moli.nodePath";
    public static final String PREF_MOLI_CODE_PATH = "moli.codePath";
    public static final String PREF_DEFAULT_MODEL = "moli.defaultModel";
    public static final String PREF_AUTH_TYPE = "moli.authType";
    public static final String PREF_PROXY_URL = "moli.proxyUrl";
    public static final String PREF_ENABLE_PROXY = "moli.enableProxy";

    private static Activator plugin;

    private AcpSessionManager acpSessionManager;
    private MoliDiffService diffService;
    private MoliContextService contextService;
    private MoliMcpIdeServer mcpIdeServer;
    private IResourceChangeListener workspaceListener;

    @Override
    public void start(BundleContext context) throws Exception {
        super.start(context);
        plugin = this;
        diffService = new MoliDiffService();
        contextService = new MoliContextService();
        mcpIdeServer = new MoliMcpIdeServer(diffService, contextService);
        acpSessionManager = new AcpSessionManager(mcpIdeServer);
        workspaceListener = this::handleWorkspaceEvent;

        // 한국어 주석: IDE 서버는 lock file을 통해 기존 core의 IdeClient가 찾을 수 있게 workspace 기동과 함께 시작합니다.
        ResourcesPlugin.getWorkspace().addResourceChangeListener(workspaceListener,
                IResourceChangeEvent.POST_CHANGE | IResourceChangeEvent.PRE_CLOSE | IResourceChangeEvent.PRE_DELETE);
        startWorkspaceServices();
    }

    @Override
    public void stop(BundleContext context) throws Exception {
        try {
            if (workspaceListener != null) {
                ResourcesPlugin.getWorkspace().removeResourceChangeListener(workspaceListener);
            }
            stopWorkspaceServices();
            if (acpSessionManager != null) {
                acpSessionManager.close();
            }
        } finally {
            plugin = null;
            super.stop(context);
        }
    }

    public static Activator getDefault() {
        return plugin;
    }

    public static IPreferenceStore preferences() {
        return getDefault().getPreferenceStore();
    }

    public static void logInfo(String message) {
        log(IStatus.INFO, message, null);
    }

    public static void logError(String message, Throwable throwable) {
        log(IStatus.ERROR, message, throwable);
    }

    private static void log(int severity, String message, Throwable throwable) {
        Activator current = getDefault();
        if (current != null) {
            current.getLog().log(new Status(severity, PLUGIN_ID, message, throwable));
        }
    }

    private void startWorkspaceServices() {
        try {
            mcpIdeServer.start();
            contextService.start(mcpIdeServer::broadcastContextUpdate);
            acpSessionManager.start();
            logInfo("Moli Code workspace services started on " + mcpIdeServer.getMcpUrl());
        } catch (Exception ex) {
            logError("Failed to start Moli Code workspace services", ex);
        }
    }

    private void stopWorkspaceServices() {
        if (contextService != null) {
            contextService.stop();
        }
        if (mcpIdeServer != null) {
            mcpIdeServer.stop();
        }
        if (acpSessionManager != null) {
            acpSessionManager.invalidateSession();
        }
    }

    private void handleWorkspaceEvent(IResourceChangeEvent event) {
        if (event.getType() == IResourceChangeEvent.POST_CHANGE) {
            if (mcpIdeServer != null && mcpIdeServer.isStarted()) {
                mcpIdeServer.broadcastWorkspaceChanged();
            }
            return;
        }
        logInfo("Workspace is closing; stopping Moli Code MCP services");
        stopWorkspaceServices();
    }

    public AcpSessionManager getAcpSessionManager() {
        return acpSessionManager;
    }

    public MoliDiffService getDiffService() {
        return diffService;
    }

    public MoliContextService getContextService() {
        return contextService;
    }

    public MoliMcpIdeServer getMcpIdeServer() {
        return mcpIdeServer;
    }
}
