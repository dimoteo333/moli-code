---
name: report
description: Convert a draft into a Shinhan Bank branded Korean report as an editable .pptx. Usage - /report <draft text or path to a draft file>.
---

# /report — Shinhan Bank Report PPT Tool

The user's draft follows this instruction block (the text after `/report`, possibly a file path or an `@file` reference — read it if so). Use that draft as the sole source of content. If no draft was provided at all, ask the user for one and stop.

## Role

Convert the user's plain-text, Markdown, or document draft into a concise, executive-ready Korean report delivered as an editable PowerPoint (`.pptx`).

## Input Review

Read the full draft before working. Ask brief, specific questions only if essential information—such as the title, date, purpose, audience, facts, figures, or requested decision—is missing, unclear, or contradictory. Otherwise proceed without asking. Never invent facts, numbers, sources, decisions, or approvals.

Before production, confirm that `~/temp/ci.png` and the WonShinhan (`원신한`) Bold, Medium, and Light fonts are available. Do not substitute missing assets or fonts; tell the user what is missing and stop.

## Content

- Write the report in Korean.
- Preserve the source's meaning and level of certainty.
- Use concise, formal language suitable for a responsible executive.
- Prioritize conclusions, key issues, risks, recommendations, and requested decisions.
- Remove repetition and use short bullets or tables when they improve clarity.
- Clearly distinguish facts, analysis, and recommendations.

## PPT Requirements

- Deliver one editable `.pptx` file.
- Use A4 portrait slides (210 × 297 mm); each slide is one report page.
- Keep margins, spacing, alignment, and layout consistent.
- Place `~/temp/ci.png` flush in the upper-right corner of every slide — touching the top and right edges with no margin — at the same size and position, with its width about one third of the slide width (≈70 mm on A4). Preserve its aspect ratio; do not crop, recolor, distort, rotate, or decorate it.
- Set body text at about 11.5–12 pt, with headings and table text sized proportionally.
- Fill each page before starting the next: lay out content so each page's content area is substantially used (roughly 90%), and only the final page may run short. Never leave a page largely empty while content continues on the next page.
- Put the page number at the bottom center of every slide as the bare page digit only (e.g. `1`) — no `/`, totals, symbols, or decorations.
- Use only WonShinhan across all text, including English, numbers, tables, and page numbers:
  - Bold: report title and main section headings
  - Medium: subheadings, emphasis, and table headers
  - Light: body text, notes, and page numbers

Use only these core colors:

- Title and body: `#000000`
- Emphasis and section headings: `#1C47F5`
- Table fills and subtle highlights: `#E7ECFE`
- Section number box: `#1C47F5` fill, `#E7ECFE` outline, `#FFFFFF` text

Do not use unrelated colors, gradients, shadows, fallback fonts, or decorative effects.

## First Slide

In the upper-center area of slide 1, place:

1. The centered report title in black using WonShinhan Bold
2. The centered report date directly below it in `YYYY.MM.DD` format
3. A thin horizontal line below the title and date

Position the title block as close to the top of the page as possible while keeping it clear of the CI image: anchor the CI near the top edge and start the title immediately below the CI's bottom edge. The title must never overlap the CI.

## Section and Table Styling

Number main sections `1`, `2`, `3`, and so on. Put each number in a square box with blue fill, light-blue outline, and white Bold text. Place the section heading beside it in `#1C47F5` using WonShinhan Bold, vertically centered with the number box so the number and heading sit on exactly the same line.

For tables, use `#E7ECFE` for header or emphasis cells, Medium for headers, Light for body text, thin borders, clear units, and consistent numerical alignment. Never fill missing values with invented data.

## Workflow and QA

1. Review the draft and clarify essential gaps.
2. Restructure and edit it into concise Korean.
3. Create the branded A4 portrait PowerPoint.
4. Render every slide to an image and inspect it visually.
5. Fix all clipping, overflow, overlap, font, color, alignment, image, and consistency issues.
6. Deliver the final `.pptx` and briefly state any assumptions or unresolved items.

Do not deliver until every slide contains the CI image, uses only the approved fonts and colors, meets the first-slide requirements, and renders without clipped, overflowing, overlapping, or off-slide content.
