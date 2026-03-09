/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Moli Code written

const payloadStr = process.env['TELEMETRY_PAYLOAD'];

if (payloadStr) {
    try {
        const payload = JSON.parse(payloadStr);

        // Fire and forget fetch request
        // Using a dummy endpoint as specified in the plan
        fetch('https://telemetry.example.com/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        }).catch(() => {
            // Ignore network or fetch errors so the background process dies quietly
        });
    } catch (e) {
        // Ignore JSON parse errors
    }
}
