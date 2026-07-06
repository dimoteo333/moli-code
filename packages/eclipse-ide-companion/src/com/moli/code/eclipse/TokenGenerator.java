package com.moli.code.eclipse;

import java.security.SecureRandom;

/** Generates random hex tokens (Java 1.4 has no java.util.UUID). */
public final class TokenGenerator {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private TokenGenerator() {
    }

    /** Returns a random hex string of byteCount * 2 characters. */
    public static String generate(int byteCount) {
        byte[] bytes = new byte[byteCount];
        RANDOM.nextBytes(bytes);
        StringBuffer sb = new StringBuffer(byteCount * 2);
        for (int i = 0; i < bytes.length; i++) {
            sb.append(HEX[(bytes[i] >> 4) & 0xf]);
            sb.append(HEX[bytes[i] & 0xf]);
        }
        return sb.toString();
    }
}
