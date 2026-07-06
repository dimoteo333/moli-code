package com.moli.code.eclipse.json;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Minimal JSON reader/writer, written against Java 1.4 so the plugin runs on
 * the JVMs that ship with legacy Eclipse 3.2.2 installs.
 *
 * Values map to: Map (object), List (array), String, Double (number),
 * Boolean, and null.
 */
public final class Json {

    private Json() {
    }

    // ------------------------------------------------------------------
    // Writing
    // ------------------------------------------------------------------

    public static String write(Object value) {
        StringBuffer sb = new StringBuffer();
        writeValue(value, sb);
        return sb.toString();
    }

    private static void writeValue(Object value, StringBuffer sb) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof String) {
            writeString((String) value, sb);
        } else if (value instanceof Boolean || value instanceof Integer
                || value instanceof Long) {
            sb.append(value.toString());
        } else if (value instanceof Number) {
            double d = ((Number) value).doubleValue();
            if (d == Math.floor(d) && !Double.isInfinite(d)
                    && Math.abs(d) < 9.007199254740992E15) {
                sb.append(Long.toString((long) d));
            } else {
                sb.append(Double.toString(d));
            }
        } else if (value instanceof Map) {
            writeObject((Map) value, sb);
        } else if (value instanceof List) {
            writeArray((List) value, sb);
        } else {
            writeString(value.toString(), sb);
        }
    }

    private static void writeObject(Map map, StringBuffer sb) {
        sb.append('{');
        boolean first = true;
        for (Iterator it = map.entrySet().iterator(); it.hasNext();) {
            Map.Entry entry = (Map.Entry) it.next();
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeString(String.valueOf(entry.getKey()), sb);
            sb.append(':');
            writeValue(entry.getValue(), sb);
        }
        sb.append('}');
    }

    private static void writeArray(List list, StringBuffer sb) {
        sb.append('[');
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            writeValue(list.get(i), sb);
        }
        sb.append(']');
    }

    private static void writeString(String s, StringBuffer sb) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
            case '"':
                sb.append("\\\"");
                break;
            case '\\':
                sb.append("\\\\");
                break;
            case '\n':
                sb.append("\\n");
                break;
            case '\r':
                sb.append("\\r");
                break;
            case '\t':
                sb.append("\\t");
                break;
            case '\b':
                sb.append("\\b");
                break;
            case '\f':
                sb.append("\\f");
                break;
            default:
                if (c < 0x20) {
                    String hex = Integer.toHexString(c);
                    sb.append("\\u");
                    for (int p = hex.length(); p < 4; p++) {
                        sb.append('0');
                    }
                    sb.append(hex);
                } else {
                    sb.append(c);
                }
            }
        }
        sb.append('"');
    }

    // ------------------------------------------------------------------
    // Parsing
    // ------------------------------------------------------------------

    /**
     * Parses a JSON document. Throws IllegalArgumentException on malformed
     * input.
     */
    public static Object parse(String text) {
        Parser p = new Parser(text);
        Object value = p.parseValue();
        p.skipWhitespace();
        if (!p.atEnd()) {
            throw new IllegalArgumentException(
                    "Trailing characters at offset " + p.pos);
        }
        return value;
    }

    private static final class Parser {
        private final String text;
        private int pos;

        Parser(String text) {
            this.text = text;
            this.pos = 0;
        }

        boolean atEnd() {
            return pos >= text.length();
        }

        void skipWhitespace() {
            while (!atEnd()) {
                char c = text.charAt(pos);
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                    pos++;
                } else {
                    break;
                }
            }
        }

        private char peek() {
            if (atEnd()) {
                throw new IllegalArgumentException("Unexpected end of input");
            }
            return text.charAt(pos);
        }

        private void expect(char c) {
            if (atEnd() || text.charAt(pos) != c) {
                throw new IllegalArgumentException(
                        "Expected '" + c + "' at offset " + pos);
            }
            pos++;
        }

        Object parseValue() {
            skipWhitespace();
            char c = peek();
            switch (c) {
            case '{':
                return parseObject();
            case '[':
                return parseArray();
            case '"':
                return parseString();
            case 't':
                expectWord("true");
                return Boolean.TRUE;
            case 'f':
                expectWord("false");
                return Boolean.FALSE;
            case 'n':
                expectWord("null");
                return null;
            default:
                return parseNumber();
            }
        }

        private void expectWord(String word) {
            if (!text.startsWith(word, pos)) {
                throw new IllegalArgumentException(
                        "Invalid literal at offset " + pos);
            }
            pos += word.length();
        }

        private Map parseObject() {
            expect('{');
            java.util.LinkedHashMap map = new java.util.LinkedHashMap();
            skipWhitespace();
            if (peek() == '}') {
                pos++;
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                expect(':');
                Object value = parseValue();
                map.put(key, value);
                skipWhitespace();
                char c = peek();
                if (c == ',') {
                    pos++;
                } else if (c == '}') {
                    pos++;
                    return map;
                } else {
                    throw new IllegalArgumentException(
                            "Expected ',' or '}' at offset " + pos);
                }
            }
        }

        private List parseArray() {
            expect('[');
            ArrayList list = new ArrayList();
            skipWhitespace();
            if (peek() == ']') {
                pos++;
                return list;
            }
            while (true) {
                Object value = parseValue();
                list.add(value);
                skipWhitespace();
                char c = peek();
                if (c == ',') {
                    pos++;
                } else if (c == ']') {
                    pos++;
                    return list;
                } else {
                    throw new IllegalArgumentException(
                            "Expected ',' or ']' at offset " + pos);
                }
            }
        }

        private String parseString() {
            expect('"');
            StringBuffer sb = new StringBuffer();
            while (true) {
                if (atEnd()) {
                    throw new IllegalArgumentException(
                            "Unterminated string at offset " + pos);
                }
                char c = text.charAt(pos++);
                if (c == '"') {
                    return sb.toString();
                }
                if (c == '\\') {
                    if (atEnd()) {
                        throw new IllegalArgumentException(
                                "Unterminated escape at offset " + pos);
                    }
                    char esc = text.charAt(pos++);
                    switch (esc) {
                    case '"':
                        sb.append('"');
                        break;
                    case '\\':
                        sb.append('\\');
                        break;
                    case '/':
                        sb.append('/');
                        break;
                    case 'n':
                        sb.append('\n');
                        break;
                    case 'r':
                        sb.append('\r');
                        break;
                    case 't':
                        sb.append('\t');
                        break;
                    case 'b':
                        sb.append('\b');
                        break;
                    case 'f':
                        sb.append('\f');
                        break;
                    case 'u':
                        if (pos + 4 > text.length()) {
                            throw new IllegalArgumentException(
                                    "Bad unicode escape at offset " + pos);
                        }
                        String hex = text.substring(pos, pos + 4);
                        pos += 4;
                        sb.append((char) Integer.parseInt(hex, 16));
                        break;
                    default:
                        throw new IllegalArgumentException(
                                "Bad escape '\\" + esc + "' at offset " + pos);
                    }
                } else {
                    sb.append(c);
                }
            }
        }

        private Object parseNumber() {
            int start = pos;
            while (!atEnd()) {
                char c = text.charAt(pos);
                if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.'
                        || c == 'e' || c == 'E') {
                    pos++;
                } else {
                    break;
                }
            }
            if (start == pos) {
                throw new IllegalArgumentException(
                        "Unexpected character at offset " + pos);
            }
            String token = text.substring(start, pos);
            try {
                return Double.valueOf(token);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException(
                        "Invalid number '" + token + "' at offset " + start);
            }
        }
    }
}
