# Excel Global Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Standard and Global Excel add-in editions, with an installer choice and a Global-only accounting-report specialist that is enabled by default.

**Architecture:** A single versioned product-profile catalog is the source of truth for installer branding and sidecar agent registration. The installer resolves an edition before making changes, renders the existing manifest template with profile-specific branding, and writes the selected edition plus enabled Global tool IDs to sidecar configuration. The sidecar validates both the config and catalog, resolves Global-only agents only when the selected edition permits them, and supplies those agents to the SDK session.

**Tech Stack:** Windows PowerShell 5.1, TypeScript/Node.js 20, Zod, Codex SDK session subagents, Vitest, Office Add-in XML manifests, PNG assets.

**Spec:** `docs/superpowers/specs/2026-08-15-excel-global-edition-design.md`

## Global Constraints

- Keep the existing Excel add-in ID and install directory so Standard and Global replace each other.
- Treat absent edition/tool fields as Standard with no Global tools for backward compatibility.
- Never enable a Global tool from its ID alone: the config edition must also be `global`.
- Reject unknown tool IDs and malformed catalogs; do not silently fall back to a less-restricted session.
- Keep the Global accounting specialist limited to the approved Excel MCP allowlist. Do not grant shell, web, filesystem, workbook-clearing, or PowerPoint tools.
- Preserve the existing write-permission gate and avoid any new taskpane button or protocol.
- Do not add demonstration packages or generated deployment archives to Git.
- Use TDD for every behavior change: first add a focused failing test, observe the expected failure, implement the minimum change, then rerun the focused test.
- Commit after each green task. Do not mix unrelated workspace changes into this branch.

## Task 1: Add edition-aware sidecar configuration

**Files:**

- Modify: `packages/excel-addin/src/sidecar/config.ts`
- Modify: `packages/excel-addin/test/config.test.ts`

- [ ] Add failing configuration tests for legacy defaults, explicit Global settings, invalid editions, non-string Global tool IDs, duplicate-ID normalization, and catalog paths resolved relative to `config.json`.

```ts
const legacyPath = writeConfig('{}');
expect(loadConfig(legacyPath)).toMatchObject({
  edition: 'standard',
  enabledGlobalTools: [],
});

const globalPath = writeConfig(
  JSON.stringify({
    edition: 'global',
    enabledGlobalTools: ['accounting-report'],
  }),
);
expect(loadConfig(globalPath)).toMatchObject({
  edition: 'global',
  enabledGlobalTools: ['accounting-report'],
});
```

- [ ] Run the focused test and confirm it fails because the new fields do not exist yet.

```powershell
npm test --workspace=packages/excel-addin -- test/config.test.ts
```

- [ ] Add `ProductEdition`, `edition`, `profileCatalogPath`, and `enabledGlobalTools` to the validated configuration. Resolve `profileCatalogPath` relative to the loaded `config.json`, not the current working directory.

```ts
export type ProductEdition = 'standard' | 'global';

const configSchema = z.object({
  edition: z.enum(['standard', 'global']).default('standard'),
  profileCatalogPath: z.string().min(1).optional(),
  enabledGlobalTools: z.array(z.string().min(1)).default([]),
});
```

- [ ] Normalize duplicate enabled IDs while preserving their first-seen order, and keep malformed values as hard validation errors.
- [ ] Rerun the focused test and confirm it passes.
- [ ] Commit the configuration contract.

```powershell
git add packages/excel-addin/src/sidecar/config.ts packages/excel-addin/test/config.test.ts
git commit -m "feat(excel-addin): add edition sidecar config"
```

## Task 2: Add the authoritative product-profile catalog and resolver

**Files:**

- Create: `packages/excel-addin/profiles/product-profiles.json`
- Create: `packages/excel-addin/src/sidecar/product-profiles.ts`
- Create: `packages/excel-addin/test/product-profiles.test.ts`

- [ ] Add failing resolver tests for schema validation, duplicate edition/tool IDs, unknown default tool IDs, Standard isolation, Global resolution, unknown configured IDs, and the exact accounting specialist contract.

```ts
expect(
  resolveEnabledGlobalAgents(catalog, {
    edition: 'standard',
    enabledGlobalTools: ['accounting-report'],
  }),
).toEqual([]);

expect(
  resolveEnabledGlobalAgents(catalog, {
    edition: 'global',
    enabledGlobalTools: ['accounting-report'],
  }),
).toEqual([
  expect.objectContaining({
    name: 'global-accounting-report',
    description: expect.stringContaining('accounting'),
    tools: ACCOUNTING_TOOL_ALLOWLIST,
    level: 'session',
  }),
]);
```

- [ ] Run the focused test and confirm it fails because the catalog and resolver are absent.

```powershell
npm test --workspace=packages/excel-addin -- test/product-profiles.test.ts
```

- [ ] Create the versioned catalog with these editions and defaults:

```json
{
  "schemaVersion": 1,
  "editions": [
    {
      "id": "standard",
      "menuLabel": "Molicode",
      "displayName": "Molicode",
      "description": "Offline Molicode AI assistant for Excel.",
      "icons": {
        "app16": "assets/icon-16.png",
        "app32": "assets/icon-32.png",
        "app64": "assets/icon-64.png",
        "app80": "assets/icon-80.png",
        "ribbon16": "assets/ribbon-16.png",
        "ribbon32": "assets/ribbon-32.png",
        "ribbon80": "assets/ribbon-80.png"
      },
      "defaultGlobalTools": []
    },
    {
      "id": "global",
      "menuLabel": "Molicode for Global",
      "displayName": "Molicode for Global",
      "description": "Offline Molicode for Global AI assistant for Excel with specialized accounting reporting.",
      "icons": {
        "app16": "assets/global-icon-16.png",
        "app32": "assets/global-icon-32.png",
        "app64": "assets/global-icon-64.png",
        "app80": "assets/global-icon-80.png",
        "ribbon16": "assets/global-ribbon-16.png",
        "ribbon32": "assets/global-ribbon-32.png",
        "ribbon80": "assets/global-ribbon-80.png"
      },
      "defaultGlobalTools": ["accounting-report"]
    }
  ]
}
```

- [ ] Add the `accounting-report` catalog entry with agent name `global-accounting-report`, the approved proactive description, optional SDK-compatible `modelConfig`/`runConfig` fields, and exactly this tool allowlist:

```ts
const ACCOUNTING_TOOL_ALLOWLIST = [
  'mcp__excel__excel_get_workbook_overview',
  'mcp__excel__excel_read_range',
  'mcp__excel__excel_find',
  'mcp__excel__excel_get_selection',
  'mcp__excel__excel_add_worksheet',
  'mcp__excel__excel_write_range',
  'mcp__excel__excel_set_formulas',
  'mcp__excel__excel_format_range',
] as const;
```

- [ ] Store the approved accounting prompt as ordered `systemPromptLines`. It must require source inspection, precise clarification before writes when ambiguous, no invented or repaired values, non-overwriting `회계보고서`, `회계보고서 (2)`, … worksheet names, report metadata/totals/summaries/anomalies/reconciliation/source references, traceable formulas, accounting formatting, source-sheet preservation, and the existing permission flow.
- [ ] Implement Zod-backed `loadProductProfileCatalog()` and `resolveEnabledGlobalAgents()`, returning SDK `SubagentConfig[]` values with `level: 'session'` and throwing a stable `ProductProfileError` for invalid schemas, duplicate IDs, invalid defaults, or unknown configured IDs.
- [ ] Ensure configured IDs are validated before the Standard-edition capability check, then return no agents for a valid known ID in a tampered Standard config.
- [ ] Rerun the focused test and confirm it passes.
- [ ] Commit the catalog and resolver.

```powershell
git add packages/excel-addin/profiles packages/excel-addin/src/sidecar/product-profiles.ts packages/excel-addin/test/product-profiles.test.ts
git commit -m "feat(excel-addin): define Global product profile"
```

## Task 3: Register Global specialists with each sidecar session

**Files:**

- Modify: `packages/excel-addin/src/sidecar/session.ts`
- Modify: `packages/excel-addin/test/session.test.ts`
- Modify if needed: `packages/excel-addin/src/sidecar/ws-server.ts`
- Modify if needed: `packages/excel-addin/test/session.test.ts`

- [ ] Add failing session tests showing Standard sessions omit SDK agents, Global sessions expose `global-accounting-report`, and profile errors emit `PRODUCT_PROFILE_INVALID` without starting a query.

```ts
expect(mockQuery).toHaveBeenCalledWith(
  expect.objectContaining({
    options: expect.not.objectContaining({ agents: expect.anything() }),
  }),
);

expect(mockQuery).toHaveBeenCalledWith(
  expect.objectContaining({
    options: expect.objectContaining({
      agents: expect.arrayContaining([
        expect.objectContaining({ name: 'global-accounting-report' }),
      ]),
    }),
  }),
);
```

- [ ] Run the focused tests and confirm they fail for the missing integration.

```powershell
npm test --workspace=packages/excel-addin -- test/session.test.ts
```

- [ ] Load and validate the catalog once during sidecar startup, resolve enabled agents once from the validated config, and inject them through the SDK `QueryOptions.agents` only when non-empty.
- [ ] Keep the existing SDK `task` tool available so the parent agent can delegate matching natural-language requests to the specialist.
- [ ] Map `ProductProfileError` to `PRODUCT_PROFILE_INVALID`, surface a useful message, and abort session/query construction instead of silently falling back.
- [ ] Rerun the focused tests and confirm they pass.
- [ ] Commit the session integration.

```powershell
git add packages/excel-addin/src/sidecar/session.ts packages/excel-addin/src/sidecar/ws-server.ts packages/excel-addin/test/session.test.ts
git commit -m "feat(excel-addin): register Global accounting agent"
```

## Task 4: Make the PowerShell installer edition-aware

**Files:**

- Create: `packages/excel-addin/installer/product-profile.psm1`
- Create: `packages/excel-addin/test/installer-profile.test.ts`
- Modify: `packages/excel-addin/installer/install.ps1`
- Modify: `packages/excel-addin/manifest/manifest.template.xml`

- [ ] Add Node tests that execute PowerShell in a temporary install root and assert the Standard plan, Global plan, explicit `-Edition`, invalid interactive retry, and omitted edition in a noninteractive host.

```js
const result = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    installer,
    '-PlanOnly',
    '-Edition',
    'Global',
    '-InstallDir',
    tempRoot,
  ],
  { encoding: 'utf8' },
);

expect(parsePlan(result.stdout)).toMatchObject({
  edition: 'global',
  displayName: 'Molicode for Global',
  enabledGlobalTools: ['accounting-report'],
});
```

- [ ] Run the installer test and confirm it fails because the new parameters and resolver do not exist.

```powershell
npm test --workspace=packages/excel-addin -- test/installer-profile.test.ts
```

- [ ] Implement pure catalog loading and edition resolution in `product-profile.psm1`. Validate catalog version, required strings, unique IDs, icon paths, and default tool references before returning an install plan.
- [ ] Add `-Edition Standard|Global` and `-PlanOnly` to `install.ps1`. If `-Edition` is absent and input is interactive, present:

```text
1. Molicode
2. Molicode for Global
```

- [ ] Retry invalid interactive choices. For testability, add a private `-NonInteractiveHost` switch that simulates unavailable input; fail clearly when edition is omitted in that mode.
- [ ] Resolve and validate the complete plan before certificate, registry, manifest, or filesystem mutation. In plan-only mode emit one machine-readable line as `MOLI_INSTALL_PLAN=<compressed JSON>` and exit without mutation.
- [ ] Parameterize display name, description, and app/ribbon icon URLs in `manifest.template.xml`; render those values from the selected profile while preserving the existing add-in ID. Test Standard and Global output paths and fail if any `{{...}}` placeholder remains.
- [ ] Write `edition`, `profileCatalogPath`, and selected `enabledGlobalTools` into sidecar config. Reinstallation at the same path must replace the prior edition.
- [ ] Rerun the installer tests and confirm they pass.
- [ ] Commit the installer behavior.

```powershell
git add packages/excel-addin/installer packages/excel-addin/manifest/manifest.template.xml packages/excel-addin/test/installer-profile.test.ts
git commit -m "feat(excel-addin): add installer edition selection"
```

## Task 5: Add Global branding assets and deployment packaging

**Files:**

- Create: `packages/excel-addin/src/assets/global-icon-master.png`
- Create: `packages/excel-addin/src/assets/global-icon-16.png`
- Create: `packages/excel-addin/src/assets/global-icon-32.png`
- Create: `packages/excel-addin/src/assets/global-icon-64.png`
- Create: `packages/excel-addin/src/assets/global-icon-80.png`
- Create: `packages/excel-addin/src/assets/global-ribbon-16.png`
- Create: `packages/excel-addin/src/assets/global-ribbon-32.png`
- Create: `packages/excel-addin/src/assets/global-ribbon-80.png`
- Create: `packages/excel-addin/scripts/generate-global-icons.ps1`
- Create: `packages/excel-addin/test/global-assets.test.ts`
- Modify: `packages/excel-addin/scripts/package-deploy.js`
- Modify if needed: `packages/excel-addin/package.json`

- [ ] Add a failing asset test that reads each PNG IHDR and checks the exact required dimensions. Add a deployment test that confirms `profiles/product-profiles.json` is copied into the package layout without creating or committing an archive.

```js
expect(readPngSize('global-icon-64.png')).toEqual({ width: 64, height: 64 });
expect(readPngSize('global-ribbon-80.png')).toEqual({ width: 80, height: 80 });
```

- [ ] Run the asset/package tests and confirm they fail because the assets and profile copy are absent.

```powershell
npm test --workspace=packages/excel-addin -- test/global-assets.test.ts
```

- [ ] Read the image-generation skill before producing the new raster asset. If it permits this established-brand extension, use the current icon as a reference with this prompt; otherwise create the globe-badge extension deterministically from the existing asset while preserving the same visual contract:

```text
Create a clean square application icon for “Molicode for Global”. Preserve the
existing blue-to-violet rounded-square tile and the exact white Moli mascot
silhouette as the dominant mark. Add a compact, high-contrast globe badge in
the lower-right corner, using simple white longitude/latitude lines on a teal
circle with a thin dark-blue outline. Flat vector-like shapes, no text, no
shadows outside the tile, transparent outside the rounded square, centered,
and recognizable when reduced to 16×16 pixels.
```

- [ ] Add a deterministic PowerShell resize script using `System.Drawing` to create all app and ribbon sizes from the approved master. Visually inspect every 16, 32, 64, and 80 pixel output for mascot legibility and badge contrast.
- [ ] Update the deployment script to copy the profile catalog alongside the installer, sidecar, manifest, and assets. Keep generated deployment directories and archives ignored/uncommitted.
- [ ] Rerun the asset and packaging tests, then build/package to verify that all referenced paths exist.

```powershell
npm run build --workspace=packages/excel-addin
npm run package:deploy --workspace=packages/excel-addin -- --skip-node
```

- [ ] Commit only source assets, the generator, tests, and packaging code.

```powershell
git add packages/excel-addin/src/assets/global-* packages/excel-addin/scripts/generate-global-icons.ps1 packages/excel-addin/test/global-assets.test.ts packages/excel-addin/scripts/package-deploy.js packages/excel-addin/package.json
git commit -m "feat(excel-addin): add Global branding assets"
```

## Task 6: Document, verify, review, and prepare the PR

**Files:**

- Modify: `packages/excel-addin/README.md`
- Modify if relevant: root `README.md`

- [ ] Document interactive selection, `-Edition Standard|Global`, replacement behavior, `-PlanOnly`, sidecar config fields, Global accounting scope, output-sheet naming, clarification behavior, and the fact that no demo package is stored in Git.
- [ ] Run focused tests first, then the complete Excel add-in verification suite.

```powershell
npm test --workspace=packages/excel-addin
npm run typecheck --workspace=packages/excel-addin
npm run build --workspace=packages/excel-addin
npm run package:deploy --workspace=packages/excel-addin -- --skip-node
npx eslint packages/excel-addin/src packages/excel-addin/test packages/excel-addin/scripts
npx prettier --check packages/excel-addin docs/superpowers/specs/2026-08-15-excel-global-edition-design.md docs/superpowers/plans/2026-08-15-excel-global-edition.md
powershell.exe -NoProfile -ExecutionPolicy Bypass -File packages/excel-addin/installer/install.ps1 -PlanOnly -Edition Standard
powershell.exe -NoProfile -ExecutionPolicy Bypass -File packages/excel-addin/installer/install.ps1 -PlanOnly -Edition Global
git diff --check
```

- [ ] Inspect the generated deployment directory only to confirm the manifest, profile catalog, sidecar files, and all Standard/Global icon paths are present; do not stage it.
- [ ] Audit the implementation line-by-line against the approved spec and this plan, especially Standard isolation, error handling, agent allowlist, report prompt, no-overwrite naming, permission gating, and replacement install semantics.
- [ ] Use `superpowers:requesting-code-review` for an independent code review and resolve all material findings with focused tests.
- [ ] Use `superpowers:verification-before-completion`, rerun the required commands from a clean working state, and record the fresh outputs before claiming completion.
- [ ] Commit documentation and any final verified fixes.

```powershell
git add packages/excel-addin/README.md README.md
git commit -m "docs(excel-addin): document Global edition"
```

- [ ] Confirm `git status --short` contains no generated package, demo archive, or unrelated files. Summarize commits and verification results before requesting approval to push/create or merge a PR.
