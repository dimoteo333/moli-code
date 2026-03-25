/**
 * @license
 * Copyright 2025 Moli Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { INSIGHT_JS, INSIGHT_CSS } from '@dobby/web-templates';
import type { InsightData } from '../types/StaticInsightTypes.js';

export class TemplateRenderer {
  // Render the complete HTML file
  async renderInsightHTML(insights: InsightData): Promise<string> {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Moli Code Insights</title>
    <style>
      ${INSIGHT_CSS}
    </style>
  </head>
  <body>
    <div class="min-h-screen" id="container">
      <div class="mx-auto max-w-6xl px-6 py-10 md:py-12">
        <div id="react-root"></div>
      </div>
    </div>

    <!-- Application Data -->
    <script>
      window.INSIGHT_DATA = ${JSON.stringify(insights)};
    </script>

    <!-- App Script (includes React/ReactDOM bundled for offline support) -->
    <script>
      ${INSIGHT_JS}
    </script>
  </body>
</html>`;

    return html;
  }
}
