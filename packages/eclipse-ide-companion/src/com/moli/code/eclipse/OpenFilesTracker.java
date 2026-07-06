package com.moli.code.eclipse;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.runtime.IPath;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.swt.widgets.Display;
import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IEditorReference;
import org.eclipse.ui.IFileEditorInput;
import org.eclipse.ui.IPartListener2;
import org.eclipse.ui.ISelectionListener;
import org.eclipse.ui.IWindowListener;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.IWorkbenchPart;
import org.eclipse.ui.IWorkbenchPartReference;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.texteditor.ITextEditor;

/**
 * Tracks open editors, the active file, cursor position, and selected text,
 * and publishes the aggregate as the ide/contextUpdate payload the Moli Code
 * CLI consumes.
 *
 * Uses only APIs present in both Eclipse 3.2.2 and 4.7.3 (IPartListener2,
 * ISelectionListener, IWindowListener).
 */
public class OpenFilesTracker implements IPartListener2, ISelectionListener,
        IWindowListener {

    /** Matches the VS Code companion's open-file cap. */
    private static final int MAX_FILES = 10;
    private static final int MAX_SELECTED_TEXT_LENGTH = 16384;
    private static final int DEBOUNCE_MS = 100;

    private final IdeServer server;
    /** List of Entry, most recently focused last. */
    private final List entries = new ArrayList();
    private boolean broadcastPending;

    private static final class Entry {
        String path;
        long timestamp;
        boolean active;
        int cursorLine = -1;
        int cursorCharacter = -1;
        String selectedText;
    }

    public OpenFilesTracker(IdeServer server) {
        this.server = server;
    }

    // ------------------------------------------------------------------
    // Installation
    // ------------------------------------------------------------------

    public void install() {
        IWorkbench workbench = PlatformUI.getWorkbench();
        workbench.addWindowListener(this);
        IWorkbenchWindow[] windows = workbench.getWorkbenchWindows();
        for (int i = 0; i < windows.length; i++) {
            hookWindow(windows[i]);
            seedWindow(windows[i]);
        }
        broadcastNow();
    }

    public void uninstall() {
        IWorkbench workbench = PlatformUI.getWorkbench();
        workbench.removeWindowListener(this);
        IWorkbenchWindow[] windows = workbench.getWorkbenchWindows();
        for (int i = 0; i < windows.length; i++) {
            unhookWindow(windows[i]);
        }
    }

    private void hookWindow(IWorkbenchWindow window) {
        window.getPartService().addPartListener(this);
        window.getSelectionService().addPostSelectionListener(this);
    }

    private void unhookWindow(IWorkbenchWindow window) {
        window.getPartService().removePartListener(this);
        window.getSelectionService().removePostSelectionListener(this);
    }

    /** Registers editors that were already open before the plugin started. */
    private void seedWindow(IWorkbenchWindow window) {
        IWorkbenchPage[] pages = window.getPages();
        for (int p = 0; p < pages.length; p++) {
            IEditorReference[] editors = pages[p].getEditorReferences();
            for (int e = 0; e < editors.length; e++) {
                IEditorPart editor = editors[e].getEditor(false);
                if (editor != null) {
                    String path = editorPath(editor);
                    if (path != null) {
                        touch(path, false);
                    }
                }
            }
            IEditorPart active = pages[p].getActiveEditor();
            if (active != null) {
                String path = editorPath(active);
                if (path != null) {
                    touch(path, true);
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // IPartListener2
    // ------------------------------------------------------------------

    public void partActivated(IWorkbenchPartReference ref) {
        String path = editorPath(ref);
        if (path != null) {
            touch(path, true);
            scheduleBroadcast();
        }
    }

    public void partBroughtToTop(IWorkbenchPartReference ref) {
        partActivated(ref);
    }

    public void partOpened(IWorkbenchPartReference ref) {
        String path = editorPath(ref);
        if (path != null) {
            touch(path, false);
            scheduleBroadcast();
        }
    }

    public void partClosed(IWorkbenchPartReference ref) {
        String path = editorPath(ref);
        if (path != null) {
            remove(path);
            scheduleBroadcast();
        }
    }

    public void partDeactivated(IWorkbenchPartReference ref) {
        // Keep the file in the list; only activation order changes matter.
    }

    public void partHidden(IWorkbenchPartReference ref) {
    }

    public void partVisible(IWorkbenchPartReference ref) {
    }

    public void partInputChanged(IWorkbenchPartReference ref) {
        // Rare (e.g. rename); resync everything from open windows.
    }

    // ------------------------------------------------------------------
    // ISelectionListener (post-selection: cursor moves, text selection)
    // ------------------------------------------------------------------

    public void selectionChanged(IWorkbenchPart part, ISelection selection) {
        if (!(part instanceof IEditorPart)
                || !(selection instanceof ITextSelection)) {
            return;
        }
        IEditorPart editor = (IEditorPart) part;
        String path = editorPath(editor);
        if (path == null) {
            return;
        }
        ITextSelection textSelection = (ITextSelection) selection;
        Entry entry = touch(path, true);
        entry.cursorLine = textSelection.getStartLine() + 1;
        entry.cursorCharacter = computeColumn(editor, textSelection);
        String text = textSelection.getText();
        if (text != null && text.length() > 0) {
            if (text.length() > MAX_SELECTED_TEXT_LENGTH) {
                text = text.substring(0, MAX_SELECTED_TEXT_LENGTH)
                        + "... [TRUNCATED]";
            }
            entry.selectedText = text;
        } else {
            entry.selectedText = null;
        }
        scheduleBroadcast();
    }

    private static int computeColumn(IEditorPart editor,
            ITextSelection selection) {
        try {
            if (editor instanceof ITextEditor) {
                ITextEditor textEditor = (ITextEditor) editor;
                IDocument document = textEditor.getDocumentProvider()
                        .getDocument(textEditor.getEditorInput());
                if (document != null) {
                    int offset = selection.getOffset();
                    int line = document.getLineOfOffset(offset);
                    return offset - document.getLineOffset(line) + 1;
                }
            }
        } catch (Exception e) {
            // Fall through to a safe default.
        }
        return 1;
    }

    // ------------------------------------------------------------------
    // IWindowListener
    // ------------------------------------------------------------------

    public void windowOpened(IWorkbenchWindow window) {
        hookWindow(window);
        seedWindow(window);
        scheduleBroadcast();
    }

    public void windowClosed(IWorkbenchWindow window) {
        unhookWindow(window);
        scheduleBroadcast();
    }

    public void windowActivated(IWorkbenchWindow window) {
    }

    public void windowDeactivated(IWorkbenchWindow window) {
    }

    // ------------------------------------------------------------------
    // State handling
    // ------------------------------------------------------------------

    private synchronized Entry touch(String path, boolean makeActive) {
        Entry found = null;
        for (Iterator it = entries.iterator(); it.hasNext();) {
            Entry entry = (Entry) it.next();
            if (entry.path.equals(path)) {
                found = entry;
            } else if (makeActive) {
                entry.active = false;
                entry.selectedText = null;
                entry.cursorLine = -1;
                entry.cursorCharacter = -1;
            }
        }
        if (found == null) {
            found = new Entry();
            found.path = path;
            entries.add(found);
        }
        found.timestamp = System.currentTimeMillis();
        if (makeActive) {
            found.active = true;
        }
        while (entries.size() > MAX_FILES) {
            removeOldest();
        }
        return found;
    }

    private void removeOldest() {
        Entry oldest = null;
        for (Iterator it = entries.iterator(); it.hasNext();) {
            Entry entry = (Entry) it.next();
            if (!entry.active
                    && (oldest == null || entry.timestamp < oldest.timestamp)) {
                oldest = entry;
            }
        }
        if (oldest != null) {
            entries.remove(oldest);
        } else if (!entries.isEmpty()) {
            entries.remove(0);
        }
    }

    private synchronized void remove(String path) {
        for (Iterator it = entries.iterator(); it.hasNext();) {
            Entry entry = (Entry) it.next();
            if (entry.path.equals(path)) {
                it.remove();
            }
        }
    }

    // ------------------------------------------------------------------
    // Broadcasting
    // ------------------------------------------------------------------

    private void scheduleBroadcast() {
        Display display = Display.getCurrent();
        if (display == null) {
            broadcastNow();
            return;
        }
        synchronized (this) {
            if (broadcastPending) {
                return;
            }
            broadcastPending = true;
        }
        display.timerExec(DEBOUNCE_MS, new Runnable() {
            public void run() {
                synchronized (OpenFilesTracker.this) {
                    broadcastPending = false;
                }
                broadcastNow();
            }
        });
    }

    void broadcastNow() {
        server.publishContext(buildContext());
    }

    private synchronized Map buildContext() {
        List sorted = new ArrayList(entries);
        Collections.sort(sorted, new Comparator() {
            public int compare(Object a, Object b) {
                long diff = ((Entry) b).timestamp - ((Entry) a).timestamp;
                return diff < 0 ? -1 : (diff > 0 ? 1 : 0);
            }
        });

        List files = new ArrayList();
        for (Iterator it = sorted.iterator(); it.hasNext();) {
            Entry entry = (Entry) it.next();
            Map file = new LinkedHashMap();
            file.put("path", entry.path);
            file.put("timestamp", new Long(entry.timestamp));
            if (entry.active) {
                file.put("isActive", Boolean.TRUE);
                if (entry.cursorLine > 0) {
                    Map cursor = new LinkedHashMap();
                    cursor.put("line", new Integer(entry.cursorLine));
                    cursor.put("character",
                            new Integer(entry.cursorCharacter > 0
                                    ? entry.cursorCharacter : 1));
                    file.put("cursor", cursor);
                }
                if (entry.selectedText != null) {
                    file.put("selectedText", entry.selectedText);
                }
            }
            files.add(file);
        }

        Map workspaceState = new LinkedHashMap();
        workspaceState.put("openFiles", files);
        workspaceState.put("isTrusted", Boolean.TRUE);
        Map context = new LinkedHashMap();
        context.put("workspaceState", workspaceState);
        return context;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static String editorPath(IWorkbenchPartReference ref) {
        IWorkbenchPart part = ref.getPart(false);
        if (!(part instanceof IEditorPart)) {
            return null;
        }
        return editorPath((IEditorPart) part);
    }

    private static String editorPath(IEditorPart editor) {
        IEditorInput input = editor.getEditorInput();
        if (input instanceof IFileEditorInput) {
            IFile file = ((IFileEditorInput) input).getFile();
            IPath location = file.getLocation();
            return location == null ? null : location.toOSString();
        }
        return null;
    }
}
