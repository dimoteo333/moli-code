package com.moli.code.eclipse.ui.views;

/**
 * 한국어 주석: 채팅 뷰에 표시할 단일 메시지 모델입니다.
 */
public class ChatMessage {
    public enum Role {
        USER,
        ASSISTANT,
        SYSTEM
    }

    private final Role role;
    private final StringBuilder text = new StringBuilder();

    public ChatMessage(Role role, String text) {
        this.role = role;
        append(text);
    }

    public Role getRole() {
        return role;
    }

    public String getText() {
        return text.toString();
    }

    public void append(String chunk) {
        if (chunk != null) {
            text.append(chunk);
        }
    }
}
