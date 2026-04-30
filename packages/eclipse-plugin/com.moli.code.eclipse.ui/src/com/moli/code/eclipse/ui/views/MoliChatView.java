package com.moli.code.eclipse.ui.views;

import com.moli.code.eclipse.core.Activator;
import com.moli.code.eclipse.core.acp.MoliAcpClientService;
import java.util.ArrayList;
import java.util.List;
import org.eclipse.swt.SWT;
import org.eclipse.swt.custom.ScrolledComposite;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Text;
import org.eclipse.ui.part.ViewPart;

/**
 * 한국어 주석: SWT 기반 채팅 ViewPart이며 ACP 스트리밍 응답을 실시간으로 누적 표시합니다.
 */
public class MoliChatView extends ViewPart implements MoliAcpClientService.ChatEventListener {
    public static final String ID = "com.moli.code.eclipse.ui.views.MoliChatView";

    private final List<ChatMessage> messages = new ArrayList<>();
    private ScrolledComposite scroller;
    private Composite messageArea;
    private Text input;
    private Button sendButton;
    private Label statusLabel;
    private ChatMessage streamingMessage;
    private final Object streamLock = new Object();
    private final StringBuilder pendingStreamText = new StringBuilder();
    private boolean streamFlushScheduled;

    @Override
    public void createPartControl(Composite parent) {
        Composite root = new Composite(parent, SWT.NONE);
        root.setLayout(new GridLayout(1, false));

        scroller = new ScrolledComposite(root, SWT.V_SCROLL | SWT.BORDER);
        scroller.setExpandHorizontal(true);
        scroller.setExpandVertical(true);
        scroller.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));

        messageArea = new Composite(scroller, SWT.NONE);
        messageArea.setLayout(new GridLayout(1, false));
        scroller.setContent(messageArea);

        Composite inputRow = new Composite(root, SWT.NONE);
        inputRow.setLayout(new GridLayout(2, false));
        inputRow.setLayoutData(new GridData(SWT.FILL, SWT.BOTTOM, true, false));

        input = new Text(inputRow, SWT.BORDER | SWT.MULTI | SWT.WRAP | SWT.V_SCROLL);
        input.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, false));
        input.addTraverseListener(event -> {
            if (event.detail == SWT.TRAVERSE_RETURN && (event.stateMask & SWT.MOD1) == 0) {
                event.doit = false;
                sendCurrentPrompt();
            }
        });

        sendButton = new Button(inputRow, SWT.PUSH);
        sendButton.setText("Send");
        sendButton.setLayoutData(new GridData(SWT.RIGHT, SWT.FILL, false, false));
        sendButton.addListener(SWT.Selection, event -> sendCurrentPrompt());

        statusLabel = new Label(root, SWT.WRAP);
        statusLabel.setText("Ready");
        statusLabel.setLayoutData(new GridData(SWT.FILL, SWT.BOTTOM, true, false));

        Activator.getDefault().getAcpSessionManager().client().addListener(this);
        renderMessages();
    }

    @Override
    public void setFocus() {
        if (input != null && !input.isDisposed()) {
            input.setFocus();
        }
    }

    @Override
    public void dispose() {
        if (Activator.getDefault() != null) {
            Activator.getDefault().getAcpSessionManager().client().removeListener(this);
        }
        super.dispose();
    }

    @Override
    public void onTextChunk(String text) {
        if (text == null || text.isEmpty()) {
            return;
        }
        synchronized (streamLock) {
            pendingStreamText.append(text);
            if (streamFlushScheduled) {
                return;
            }
            streamFlushScheduled = true;
        }
        Display.getDefault().asyncExec(() -> Display.getDefault().timerExec(60, this::flushPendingStreamText));
    }

    @Override
    public void onPromptFinished() {
        Display.getDefault().asyncExec(() -> {
            flushPendingStreamText();
            streamingMessage = null;
            setInputEnabled(true);
            setStatus("Ready");
        });
    }

    @Override
    public void onError(String message) {
        Display.getDefault().asyncExec(() -> {
            flushPendingStreamText();
            messages.add(new ChatMessage(ChatMessage.Role.SYSTEM, message == null ? "Unknown ACP error" : message));
            streamingMessage = null;
            setInputEnabled(true);
            setStatus("Error");
            renderMessages();
        });
    }

    @Override
    public void onLog(String message) {
        Display.getDefault().asyncExec(() -> {
            if (!isBlank(message)) {
                setStatus(message);
            }
        });
    }

    private void sendCurrentPrompt() {
        String prompt = input.getText().trim();
        if (prompt.isEmpty()) {
            return;
        }
        messages.add(new ChatMessage(ChatMessage.Role.USER, prompt));
        input.setText("");
        setInputEnabled(false);
        setStatus("Moli is responding...");
        streamingMessage = new ChatMessage(ChatMessage.Role.ASSISTANT, "");
        messages.add(streamingMessage);
        renderMessages();
        Activator.getDefault().getAcpSessionManager().sendPrompt(prompt);
    }

    private void setInputEnabled(boolean enabled) {
        if (input != null && !input.isDisposed()) {
            input.setEnabled(enabled);
        }
        if (sendButton != null && !sendButton.isDisposed()) {
            sendButton.setEnabled(enabled);
        }
    }

    private void setStatus(String text) {
        if (statusLabel != null && !statusLabel.isDisposed()) {
            statusLabel.setText(text == null ? "" : text);
            statusLabel.getParent().layout(true, true);
        }
    }

    private void flushPendingStreamText() {
        String chunk;
        synchronized (streamLock) {
            chunk = pendingStreamText.toString();
            pendingStreamText.setLength(0);
            streamFlushScheduled = false;
        }
        if (chunk.isEmpty() || messageArea == null || messageArea.isDisposed()) {
            return;
        }
        if (streamingMessage == null) {
            streamingMessage = new ChatMessage(ChatMessage.Role.ASSISTANT, "");
            messages.add(streamingMessage);
        }
        streamingMessage.append(chunk);
        renderMessages();
    }

    private void renderMessages() {
        if (messageArea == null || messageArea.isDisposed()) {
            return;
        }
        for (org.eclipse.swt.widgets.Control child : messageArea.getChildren()) {
            child.dispose();
        }
        for (ChatMessage message : messages) {
            Label label = new Label(messageArea, SWT.WRAP);
            label.setText(prefix(message) + message.getText());
            label.setLayoutData(new GridData(SWT.FILL, SWT.TOP, true, false));
        }
        messageArea.layout(true, true);
        scroller.setMinSize(messageArea.computeSize(SWT.DEFAULT, SWT.DEFAULT));
        scroller.setOrigin(0, Math.max(0, messageArea.getSize().y));
    }

    private String prefix(ChatMessage message) {
        if (message.getRole() == ChatMessage.Role.USER) {
            return "You\n";
        }
        if (message.getRole() == ChatMessage.Role.ASSISTANT) {
            return "Moli\n";
        }
        return "System\n";
    }

    private static boolean isBlank(String value) {
        if (value == null) {
            return true;
        }
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isWhitespace(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }
}
