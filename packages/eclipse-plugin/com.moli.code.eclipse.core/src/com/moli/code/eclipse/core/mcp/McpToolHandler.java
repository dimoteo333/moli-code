package com.moli.code.eclipse.core.mcp;

import com.moli.code.eclipse.core.diff.MoliDiffService;

/**
 * 한국어 주석: MCP tools/call 요청을 Eclipse diff 서비스 호출로 변환합니다.
 */
public class McpToolHandler {
    private final MoliDiffService diffService;

    public McpToolHandler(MoliDiffService diffService) {
        this.diffService = diffService;
    }

    public String toolsListResult() {
        return "{\"tools\":["
                + "{\"name\":\"openDiff\",\"description\":\"(IDE Tool) Open a diff view to create or modify a file.\","
                + "\"inputSchema\":{\"type\":\"object\",\"properties\":{\"filePath\":{\"type\":\"string\"},\"newContent\":{\"type\":\"string\"}},\"required\":[\"filePath\",\"newContent\"]}},"
                + "{\"name\":\"closeDiff\",\"description\":\"(IDE Tool) Close an open diff view for a specific file.\","
                + "\"inputSchema\":{\"type\":\"object\",\"properties\":{\"filePath\":{\"type\":\"string\"},\"suppressNotification\":{\"type\":\"boolean\"}},\"required\":[\"filePath\"]}}"
                + "]}";
    }

    public String handleToolCall(String body) {
        String name = Json.field(body, "name");
        String arguments = Json.objectField(body, "arguments");
        if ("openDiff".equals(name)) {
            String filePath = Json.field(arguments, "filePath");
            String newContent = Json.field(arguments, "newContent");
            diffService.openDiff(filePath, newContent);
            return "{\"content\":[]}";
        }
        if ("closeDiff".equals(name)) {
            String filePath = Json.field(arguments, "filePath");
            boolean suppress = Json.booleanField(arguments, "suppressNotification");
            String content = diffService.closeDiff(filePath, suppress);
            return "{\"content\":[{\"type\":\"text\",\"text\":" + Json.quote("{\"content\":" + Json.quote(content == null ? "" : content) + "}") + "}]}";
        }
        return "{\"content\":[{\"type\":\"text\",\"text\":\"Unknown tool\"}],\"isError\":true}";
    }

    /**
     * 한국어 주석: MCP 요청에서 필요한 필드만 읽기 위한 작은 JSON 유틸리티입니다.
     */
    static class Json {
        static String field(String json, String name) {
            int key = findKey(json, name);
            if (key < 0) {
                return "";
            }
            int colon = json.indexOf(':', key);
            int start = skipWhitespace(json, colon + 1);
            if (start >= json.length() || json.charAt(start) != '"') {
                return "";
            }
            return readString(json, start).value;
        }

        static String objectField(String json, String name) {
            int key = findKey(json, name);
            if (key < 0) {
                return "{}";
            }
            int colon = json.indexOf(':', key);
            int start = skipWhitespace(json, colon + 1);
            if (start >= json.length() || json.charAt(start) != '{') {
                return "{}";
            }
            int depth = 0;
            boolean inString = false;
            boolean escaped = false;
            for (int i = start; i < json.length(); i++) {
                char c = json.charAt(i);
                if (inString) {
                    if (escaped) {
                        escaped = false;
                    } else if (c == '\\') {
                        escaped = true;
                    } else if (c == '"') {
                        inString = false;
                    }
                } else if (c == '"') {
                    inString = true;
                } else if (c == '{') {
                    depth++;
                } else if (c == '}') {
                    depth--;
                    if (depth == 0) {
                        return json.substring(start, i + 1);
                    }
                }
            }
            return "{}";
        }

        static boolean booleanField(String json, String name) {
            int key = findKey(json, name);
            if (key < 0) {
                return false;
            }
            int colon = json.indexOf(':', key);
            int start = skipWhitespace(json, colon + 1);
            return json.startsWith("true", start);
        }

        static String id(String json) {
            int key = findKey(json, "id");
            if (key < 0) {
                return "null";
            }
            int colon = json.indexOf(':', key);
            int start = skipWhitespace(json, colon + 1);
            if (start < json.length() && json.charAt(start) == '"') {
                Parsed parsed = readString(json, start);
                return quote(parsed.value);
            }
            int end = start;
            while (end < json.length() && ",}\r\n\t ".indexOf(json.charAt(end)) < 0) {
                end++;
            }
            return json.substring(start, end);
        }

        static String quote(String value) {
            if (value == null) {
                return "null";
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

        private static int findKey(String json, String name) {
            return json == null ? -1 : json.indexOf('"' + name + '"');
        }

        private static int skipWhitespace(String json, int start) {
            int index = Math.max(0, start);
            while (index < json.length() && Character.isWhitespace(json.charAt(index))) {
                index++;
            }
            return index;
        }

        private static Parsed readString(String json, int quoteStart) {
            StringBuilder builder = new StringBuilder();
            boolean escaped = false;
            for (int i = quoteStart + 1; i < json.length(); i++) {
                char c = json.charAt(i);
                if (escaped) {
                    switch (c) {
                        case '"':
                            builder.append('"');
                            break;
                        case '\\':
                            builder.append('\\');
                            break;
                        case '/':
                            builder.append('/');
                            break;
                        case 'b':
                            builder.append('\b');
                            break;
                        case 'f':
                            builder.append('\f');
                            break;
                        case 'n':
                            builder.append('\n');
                            break;
                        case 'r':
                            builder.append('\r');
                            break;
                        case 't':
                            builder.append('\t');
                            break;
                        case 'u':
                            if (i + 4 < json.length()) {
                                builder.append((char) Integer.parseInt(json.substring(i + 1, i + 5), 16));
                                i += 4;
                            }
                            break;
                        default:
                            builder.append(c);
                            break;
                    }
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    return new Parsed(builder.toString(), i + 1);
                } else {
                    builder.append(c);
                }
            }
            return new Parsed(builder.toString(), json.length());
        }

        private static class Parsed {
            final String value;
            final int end;

            Parsed(String value, int end) {
                this.value = value;
                this.end = end;
            }
        }
    }
}
