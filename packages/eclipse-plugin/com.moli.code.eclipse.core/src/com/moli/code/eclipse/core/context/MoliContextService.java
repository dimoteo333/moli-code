package com.moli.code.eclipse.core.context;

import java.net.URI;
import java.nio.file.Paths;
import org.eclipse.core.resources.IFile;
import org.eclipse.jface.text.BadLocationException;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.jface.viewers.ISelectionChangedListener;
import org.eclipse.jface.viewers.ISelectionProvider;
import org.eclipse.swt.widgets.Display;
import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IPartListener2;
import org.eclipse.ui.IWorkbenchPartReference;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.texteditor.ITextEditor;

/**
 * 한국어 주석: 활성 에디터, 선택 텍스트, 커서 정보를 수집해 ide/contextUpdate로 보낼 JSON을 만듭니다.
 */
public class MoliContextService {
    private static final int MAX_SELECTED_TEXT = 16 * 1024;
    private static final long DEBOUNCE_MS = 50L;

    private final EclipseFileTracker tracker = new EclipseFileTracker();
    private Runnable onDidChange;
    private IPartListener2 partListener;
    private ISelectionChangedListener selectionListener;
    private ISelectionProvider selectionProvider;
    private volatile boolean started;
    private long debounceGeneration;

    public void start(Runnable onDidChange) {
        this.onDidChange = onDidChange;
        if (started) {
            return;
        }
        started = true;
        Display.getDefault().asyncExec(() -> {
            IWorkbenchWindow window = activeWindow();
            if (window == null) {
                return;
            }
            partListener = new IPartListener2() {
                @Override
                public void partActivated(IWorkbenchPartReference partRef) {
                    collectActiveEditor();
                }

                @Override
                public void partBroughtToTop(IWorkbenchPartReference partRef) {
                    collectActiveEditor();
                }

                @Override
                public void partClosed(IWorkbenchPartReference partRef) {
                    fireWithDebounce();
                }

                @Override
                public void partDeactivated(IWorkbenchPartReference partRef) {
                    // 한국어 주석: 비활성화만으로는 컨텍스트 변경이 없으므로 처리하지 않습니다.
                }

                @Override
                public void partOpened(IWorkbenchPartReference partRef) {
                    collectActiveEditor();
                }

                @Override
                public void partHidden(IWorkbenchPartReference partRef) {
                    fireWithDebounce();
                }

                @Override
                public void partVisible(IWorkbenchPartReference partRef) {
                    collectActiveEditor();
                }

                @Override
                public void partInputChanged(IWorkbenchPartReference partRef) {
                    collectActiveEditor();
                }
            };
            window.getPartService().addPartListener(partListener);
            attachSelectionListener(window.getActivePage() == null ? null : window.getActivePage().getActiveEditor());
            collectActiveEditor();
        });
    }

    public void stop() {
        Display.getDefault().asyncExec(() -> {
            IWorkbenchWindow window = activeWindow();
            if (window != null && partListener != null) {
                window.getPartService().removePartListener(partListener);
            }
            if (selectionProvider != null && selectionListener != null) {
                selectionProvider.removeSelectionChangedListener(selectionListener);
            }
            started = false;
        });
    }

    public String currentContextJson() {
        StringBuilder builder = new StringBuilder();
        builder.append("{\"workspaceState\":{\"openFiles\":[");
        boolean first = true;
        for (EclipseFileTracker.OpenFileState state : tracker.snapshot()) {
            if (!first) {
                builder.append(',');
            }
            builder.append(state.toJson());
            first = false;
        }
        builder.append("],\"isTrusted\":true}}");
        return builder.toString();
    }

    private void collectActiveEditor() {
        IWorkbenchWindow window = activeWindow();
        if (window == null || window.getActivePage() == null) {
            return;
        }
        IEditorPart editorPart = window.getActivePage().getActiveEditor();
        attachSelectionListener(editorPart);
        EclipseFileTracker.OpenFileState state = stateFromEditor(editorPart);
        if (state != null) {
            tracker.record(state);
            fireWithDebounce();
        }
    }

    private void attachSelectionListener(IEditorPart editorPart) {
        if (!(editorPart instanceof ITextEditor)) {
            return;
        }
        ITextEditor textEditor = (ITextEditor) editorPart;
        ISelectionProvider provider = textEditor.getSelectionProvider();
        if (provider == null || provider == selectionProvider) {
            return;
        }
        if (selectionProvider != null && selectionListener != null) {
            selectionProvider.removeSelectionChangedListener(selectionListener);
        }
        selectionProvider = provider;
        selectionListener = event -> collectActiveEditor();
        selectionProvider.addSelectionChangedListener(selectionListener);
    }

    private EclipseFileTracker.OpenFileState stateFromEditor(IEditorPart editorPart) {
        if (!(editorPart instanceof ITextEditor)) {
            return null;
        }
        ITextEditor textEditor = (ITextEditor) editorPart;
        String path = pathFromInput(textEditor.getEditorInput());
        if (path == null) {
            return null;
        }
        EclipseFileTracker.OpenFileState state = new EclipseFileTracker.OpenFileState();
        state.path = path;
        state.timestamp = System.currentTimeMillis();
        state.active = true;
        ISelection selection = textEditor.getSelectionProvider() == null ? null : textEditor.getSelectionProvider().getSelection();
        if (selection instanceof ITextSelection) {
            ITextSelection textSelection = (ITextSelection) selection;
            state.selectedText = truncate(textSelection.getText());
            state.line = Math.max(0, textSelection.getStartLine());
            state.character = computeCharacter(textEditor, textSelection);
        }
        return state;
    }

    private int computeCharacter(ITextEditor textEditor, ITextSelection selection) {
        try {
            IDocument document = textEditor.getDocumentProvider().getDocument(textEditor.getEditorInput());
            int lineOffset = document.getLineOffset(Math.max(0, selection.getStartLine()));
            return Math.max(0, selection.getOffset() - lineOffset);
        } catch (BadLocationException | RuntimeException ex) {
            return 0;
        }
    }

    private String pathFromInput(IEditorInput input) {
        IFile file = input.getAdapter(IFile.class);
        if (file != null && file.getLocation() != null) {
            return file.getLocation().toOSString();
        }
        // 한국어 주석: IURIEditorInput은 access restriction이므로 리플렉션 없이 FileStoreEditorInput을 우회합니다.
        try {
            Object fileStoreInput = input;
            if (fileStoreInput.getClass().getName().contains("FileStoreEditorInput")) {
                java.lang.reflect.Method getURI = fileStoreInput.getClass().getMethod("getURI");
                URI uri = (URI) getURI.invoke(fileStoreInput);
                if (uri != null && "file".equalsIgnoreCase(uri.getScheme())) {
                    return Paths.get(uri).toString();
                }
            }
        } catch (Exception ignored) {
            // 한국어 주석: FileStoreEditorInput 접근 실패 시 null 반환
        }
        return null;
    }

    private String truncate(String text) {
        if (text == null || text.length() <= MAX_SELECTED_TEXT) {
            return text == null ? "" : text;
        }
        return text.substring(0, MAX_SELECTED_TEXT);
    }

    private void fireWithDebounce() {
        long generation = ++debounceGeneration;
        Display.getDefault().timerExec((int) DEBOUNCE_MS, () -> {
            if (generation == debounceGeneration && onDidChange != null) {
                onDidChange.run();
            }
        });
    }

    private IWorkbenchWindow activeWindow() {
        return PlatformUI.isWorkbenchRunning() ? PlatformUI.getWorkbench().getActiveWorkbenchWindow() : null;
    }
}
