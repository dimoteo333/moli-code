package com.moli.code.eclipse.actions;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Status;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.ui.console.ConsolePlugin;
import org.eclipse.ui.console.IConsole;
import org.eclipse.ui.console.IConsoleManager;
import org.eclipse.ui.console.MessageConsole;
import org.eclipse.ui.console.MessageConsoleStream;

import com.moli.code.eclipse.MoliCodePlugin;

/**
 * Executes the external `cvs` client in a background Job and streams its
 * output to the "몰리 코드 CVS" console. Output is decoded with the platform
 * default encoding, which on legacy Korean Windows machines is CP949 —
 * exactly what CVSNT emits there.
 */
public final class CvsRunner {

    private static final String CONSOLE_NAME = "몰리 코드 CVS";

    private CvsRunner() {
    }

    /**
     * Runs `cvs -f <args>` in workingDir. Refreshes the given resource from
     * disk afterwards when refreshAfter is non-null (so `cvs update` results
     * appear in the workspace immediately).
     */
    public static void run(final String[] cvsArgs, final File workingDir,
            final IResource refreshAfter) {
        Job job = new Job("CVS: " + join(cvsArgs)) {
            protected IStatus run(IProgressMonitor monitor) {
                MessageConsoleStream out = findConsole().newMessageStream();
                try {
                    String[] command = new String[cvsArgs.length + 2];
                    command[0] = "cvs";
                    command[1] = "-f";
                    System.arraycopy(cvsArgs, 0, command, 2, cvsArgs.length);

                    out.println("[" + workingDir.getAbsolutePath() + "] $ "
                            + CvsRunner.join(command));

                    Process process = Runtime.getRuntime().exec(command, null,
                            workingDir);
                    StreamPump stdout = new StreamPump(
                            process.getInputStream(), out);
                    StreamPump stderr = new StreamPump(
                            process.getErrorStream(), out);
                    stdout.start();
                    stderr.start();
                    int exitCode = process.waitFor();
                    stdout.join();
                    stderr.join();
                    out.println("(exit code: " + exitCode + ")");
                    out.println("");

                    if (refreshAfter != null) {
                        refreshAfter.refreshLocal(IResource.DEPTH_INFINITE,
                                monitor);
                    } else {
                        ResourcesPlugin.getWorkspace().getRoot()
                                .refreshLocal(IResource.DEPTH_INFINITE,
                                        monitor);
                    }
                    return Status.OK_STATUS;
                } catch (IOException e) {
                    out.println("cvs 실행 실패: " + e.getMessage());
                    out.println("CVS 클라이언트(CVSNT 등)가 PATH에 있는지 확인하세요.");
                    return new Status(IStatus.ERROR, MoliCodePlugin.PLUGIN_ID,
                            0, "Failed to run cvs", e);
                } catch (Exception e) {
                    return new Status(IStatus.ERROR, MoliCodePlugin.PLUGIN_ID,
                            0, "CVS operation failed", e);
                } finally {
                    try {
                        out.close();
                    } catch (IOException e) {
                        // Ignore.
                    }
                }
            }
        };
        job.setUser(true);
        job.schedule();
    }

    private static MessageConsole findConsole() {
        IConsoleManager manager = ConsolePlugin.getDefault()
                .getConsoleManager();
        IConsole[] existing = manager.getConsoles();
        for (int i = 0; i < existing.length; i++) {
            if (CONSOLE_NAME.equals(existing[i].getName())
                    && existing[i] instanceof MessageConsole) {
                MessageConsole console = (MessageConsole) existing[i];
                manager.showConsoleView(console);
                return console;
            }
        }
        MessageConsole console = new MessageConsole(CONSOLE_NAME, null);
        manager.addConsoles(new IConsole[] { console });
        manager.showConsoleView(console);
        return console;
    }

    private static String join(String[] parts) {
        StringBuffer sb = new StringBuffer();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                sb.append(' ');
            }
            sb.append(parts[i]);
        }
        return sb.toString();
    }

    /** Copies a process stream to the console using the platform charset. */
    private static final class StreamPump extends Thread {
        private final InputStream in;
        private final MessageConsoleStream out;

        StreamPump(InputStream in, MessageConsoleStream out) {
            super("Moli Code CVS output");
            this.in = in;
            this.out = out;
            setDaemon(true);
        }

        public void run() {
            try {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(in));
                String line;
                while ((line = reader.readLine()) != null) {
                    out.println(line);
                }
            } catch (IOException e) {
                // Stream closed with the process; nothing to report.
            }
        }
    }
}
