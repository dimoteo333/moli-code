package com.moli.code.eclipse.core.diff;

import com.moli.code.eclipse.core.util.Java8Compat;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import org.eclipse.compare.CompareUI;
import org.eclipse.core.runtime.Platform;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.PlatformUI;
import org.osgi.framework.Bundle;

/**
 * 한국어 주석: 파일별 diff 생명주기를 관리하고 accept/reject/close 알림을 MCP 서버로 전달합니다.
 */
public class MoliDiffService {
    private final Map<String, MoliCompareInput> openDiffs = new HashMap<>();
    private Consumer<String> notificationSink;

    public synchronized void setNotificationSink(Consumer<String> notificationSink) {
        this.notificationSink = notificationSink;
    }

    public void openDiff(String filePath, String newContent) {
        String normalized = normalize(filePath);
        String oldContent = readFile(normalized);
        Display.getDefault().asyncExec(() -> {
            synchronized (this) {
                MoliCompareInput existing = openDiffs.get(normalized);
                if (existing != null) {
                    focus(existing);
                    return;
                }
                MoliCompareInput input = new MoliCompareInput(normalized, oldContent, newContent);
                openDiffs.put(normalized, input);
                CompareUI.openCompareEditor(input);
                showNotificationPopup(normalized);
            }
        });
    }

    public String closeDiff(String filePath, boolean suppressNotification) {
        String normalized = normalize(filePath);
        MoliCompareInput input;
        synchronized (this) {
            input = openDiffs.remove(normalized);
        }
        if (input == null) {
            return null;
        }
        String content = input.getModifiedContent();
        Display.getDefault().asyncExec(() -> closeEditor(input));
        if (!suppressNotification) {
            notifyDiff("ide/diffClosed", normalized, content);
        }
        return content;
    }

    public void accept(String filePath) {
        String normalized = normalize(filePath);
        MoliCompareInput input;
        synchronized (this) {
            input = openDiffs.remove(normalized);
        }
        if (input != null) {
            String content = input.getModifiedContent();
            Display.getDefault().asyncExec(() -> closeEditor(input));
            notifyDiff("ide/diffAccepted", normalized, content);
        }
    }

    public void reject(String filePath) {
        String normalized = normalize(filePath);
        MoliCompareInput input;
        synchronized (this) {
            input = openDiffs.remove(normalized);
        }
        if (input != null) {
            Display.getDefault().asyncExec(() -> closeEditor(input));
            notifyDiff("ide/diffRejected", normalized, "");
        }
    }

    private void focus(MoliCompareInput input) {
        IWorkbenchPage page = activePage();
        if (page == null) {
            return;
        }
        IEditorPart editor = page.findEditor(input);
        if (editor != null) {
            page.activate(editor);
        }
    }

    private void closeEditor(MoliCompareInput input) {
        IWorkbenchPage page = activePage();
        if (page == null) {
            return;
        }
        IEditorPart editor = page.findEditor(input);
        if (editor != null) {
            page.closeEditor(editor, false);
        }
    }

    private IWorkbenchPage activePage() {
        if (!PlatformUI.isWorkbenchRunning() || PlatformUI.getWorkbench().getActiveWorkbenchWindow() == null) {
            return null;
        }
        return PlatformUI.getWorkbench().getActiveWorkbenchWindow().getActivePage();
    }

    private void showNotificationPopup(String filePath) {
        try {
            Bundle bundle = Platform.getBundle("com.moli.code.eclipse.ui");
            if (bundle == null || PlatformUI.getWorkbench().getActiveWorkbenchWindow() == null) {
                return;
            }
            Shell shell = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getShell();
            Class<?> popupClass = bundle.loadClass("com.moli.code.eclipse.ui.parts.DiffNotificationPopup");
            Object popup = popupClass.getConstructor(Shell.class, String.class).newInstance(shell, filePath);
            popupClass.getMethod("open").invoke(popup);
        } catch (Exception ignored) {
            // 한국어 주석: UI 번들이 없거나 팝업 생성에 실패해도 diff 에디터 자체는 유지합니다.
        }
    }

    private void notifyDiff(String method, String filePath, String content) {
        Consumer<String> sink;
        synchronized (this) {
            sink = notificationSink;
        }
        if (sink != null) {
            sink.accept("{\"jsonrpc\":\"2.0\",\"method\":\"" + method + "\",\"params\":{\"filePath\":"
                    + quote(filePath) + ",\"content\":" + quote(content) + "}}");
        }
    }

    private String readFile(String filePath) {
        try {
            Path path = new File(filePath).toPath();
            if (Files.exists(path)) {
                return Java8Compat.readString(path, StandardCharsets.UTF_8);
            }
        } catch (IOException ignored) {
            // 한국어 주석: 파일이 없거나 읽을 수 없으면 신규 파일 diff로 취급합니다.
        }
        return "";
    }

    private String normalize(String filePath) {
        return new File(filePath).toPath().toAbsolutePath().normalize().toString();
    }

    private static String quote(String value) {
        if (value == null) {
            return "\"\"";
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
}
