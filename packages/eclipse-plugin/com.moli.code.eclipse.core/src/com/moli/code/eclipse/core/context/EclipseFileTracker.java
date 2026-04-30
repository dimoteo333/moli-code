package com.moli.code.eclipse.core.context;

import com.moli.code.eclipse.core.util.Java8Compat;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * 한국어 주석: 열린 파일을 MRU 순서로 보관하고 MCP 컨텍스트 스키마에 맞게 직렬화합니다.
 */
public class EclipseFileTracker {
    private static final int MAX_OPEN_FILES = 10;

    private final List<OpenFileState> openFiles = new ArrayList<>();

    public synchronized void record(OpenFileState state) {
        if (state == null || Java8Compat.isBlank(state.path)) {
            return;
        }
        remove(state.path);
        openFiles.add(0, state);
        trim();
    }

    public synchronized void remove(String path) {
        for (Iterator<OpenFileState> iterator = openFiles.iterator(); iterator.hasNext();) {
            if (iterator.next().path.equals(path)) {
                iterator.remove();
            }
        }
    }

    public synchronized List<OpenFileState> snapshot() {
        return new ArrayList<>(openFiles);
    }

    private void trim() {
        while (openFiles.size() > MAX_OPEN_FILES) {
            openFiles.remove(openFiles.size() - 1);
        }
    }

    /**
     * 한국어 주석: IDE context의 openFiles 배열 원소와 1:1로 대응하는 값 객체입니다.
     */
    public static class OpenFileState {
        public String path;
        public long timestamp;
        public boolean active;
        public String selectedText;
        public int line;
        public int character;

        public String toJson() {
            return "{"
                    + "\"path\":" + quote(path) + ","
                    + "\"timestamp\":" + timestamp + ","
                    + "\"isActive\":" + active + ","
                    + "\"selectedText\":" + quote(selectedText) + ","
                    + "\"cursor\":{\"line\":" + line + ",\"character\":" + character + "}"
                    + "}";
        }

        private static String quote(String value) {
            if (value == null) {
                return "\"\"";
            }
            StringBuilder builder = new StringBuilder(value.length() + 16);
            builder.append('"');
            for (int i = 0; i < value.length(); i++) {
                char c = value.charAt(i);
                switch (c) {
                    case '"':
                        builder.append("\\\"");
                        break;
                    case '\\':
                        builder.append("\\\\");
                        break;
                    case '\b':
                        builder.append("\\b");
                        break;
                    case '\f':
                        builder.append("\\f");
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
                        if (c < 0x20) {
                            builder.append(String.format("\\u%04x", (int) c));
                        } else {
                            builder.append(c);
                        }
                        break;
                }
            }
            builder.append('"');
            return builder.toString();
        }
    }
}
