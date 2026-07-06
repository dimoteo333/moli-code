package com.moli.code.eclipse;

import org.eclipse.swt.widgets.Display;
import org.eclipse.ui.IStartup;
import org.eclipse.ui.PlatformUI;

/**
 * Early-startup hook (org.eclipse.ui.startup). Activates the bundle when the
 * workbench starts and installs the open-files tracker on the UI thread.
 */
public class StartupHook implements IStartup {

    public void earlyStartup() {
        Display display = PlatformUI.getWorkbench().getDisplay();
        display.asyncExec(new Runnable() {
            public void run() {
                MoliCodePlugin plugin = MoliCodePlugin.getDefault();
                if (plugin != null) {
                    plugin.installTracker();
                }
            }
        });
    }
}
