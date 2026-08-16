# Excel Global Edition Design

## Summary

The offline Excel Add-in installer will offer two mutually exclusive product
editions:

1. `Molicode`
2. `Molicode for Global`

Both editions use the existing installation directory and Office Add-in ID, so
running the installer again replaces the installed edition. The Global edition
uses distinct icon assets and enables an accounting-report specialist by
default. The standard edition neither registers nor exposes that specialist.

## Goals

- Present an interactive edition choice during normal PowerShell installation.
- Support unattended installation with `-Edition Standard` and
  `-Edition Global`.
- Render edition-specific manifest branding and icons.
- Enable the Global accounting-report specialist by default only for the Global
  edition.
- Give the accounting specialist a dedicated, testable prompt and only the
  Excel tools required to build a report.
- Keep edition metadata and Global-only tool definitions extensible without
  adding edition-specific branches throughout the sidecar.

## Non-goals

- Installing both editions side by side on one Windows account.
- Adding a dedicated accounting button to the task pane.
- Changing the PowerPoint Add-in.
- Giving the accounting specialist shell, web, or arbitrary file access.
- Creating or committing demonstration workbooks or generated report packages.

## Product profiles

`packages/excel-addin/profiles/product-profiles.json` is the authoritative
catalog shared by the installer and sidecar. It contains a schema version,
edition records, and Global-only specialist records.

Each edition record defines:

- stable edition ID (`standard` or `global`);
- installer menu label;
- manifest display name and description;
- icon asset paths for the app and ribbon sizes;
- the Global tool IDs enabled by default.

The standard profile has an empty `defaultGlobalTools` array. The Global profile
contains `accounting-report`. Adding another Global-only specialist requires a
new catalog entry and, if it should be enabled by default, its ID in the Global
profile's `defaultGlobalTools` array.

Each Global tool record defines:

- stable tool ID;
- session-agent name and model-facing description;
- dedicated system prompt;
- an allowlist of tool names;
- optional model and run limits supported by the SDK agent configuration.

Unknown catalog schema versions, duplicate tool IDs, missing required fields,
or an edition referring to an unknown Global tool are installation/runtime
errors rather than silent fallbacks.

## Installer experience

When `-Edition` is omitted, `install.ps1` prints the following menu and reads a
choice before it changes the machine:

```text
설치할 제품을 선택하세요:
  1. Molicode
  2. Molicode for Global
선택 [1-2]:
```

Only `1` and `2` are accepted; invalid input is explained and prompted again.
For unattended deployment, `-Edition Standard` and `-Edition Global` bypass the
prompt. If the host cannot read interactive input and `-Edition` is absent, the
installer fails with instructions to supply the parameter; it does not guess an
edition.

The profile is resolved before certificate, registry, scheduled-task, or file
mutations. A `-PlanOnly` mode resolves the same production profile path and
emits a JSON installation plan without changing the machine. It exists both for
administrative preview and behavioral tests.

The selected installation writes these additional `config.json` fields:

```json
{
  "edition": "global",
  "profileCatalogPath": "profiles/product-profiles.json",
  "enabledGlobalTools": ["accounting-report"]
}
```

For the standard edition, `edition` is `standard` and `enabledGlobalTools` is an
empty array. The installer copies the catalog and both icon sets so that a later
edition switch can render and start without downloading additional files.

## Manifest branding and icon assets

The manifest template gains placeholders for display name, description, and
app/ribbon icon URLs. The installer replaces every placeholder from the chosen
edition profile and rejects a rendered manifest if any `{{...}}` placeholder
remains.

The standard edition keeps the existing Moli assets. The Global edition uses a
new asset family:

- `global-icon-16.png`, `global-icon-32.png`, `global-icon-64.png`,
  `global-icon-80.png`;
- `global-ribbon-16.png`, `global-ribbon-32.png`,
  `global-ribbon-80.png`.

The Global design retains the existing blue Moli tile/mark and adds a legible
globe badge, so it is distinguishable without appearing to be a separate
unrelated product. All files are committed source assets and are copied by the
normal Add-in build/package flow.

## Sidecar configuration and Global-tool isolation

`SidecarConfig` gains:

- `edition: 'standard' | 'global'`;
- `profileCatalogPath: string` resolved relative to `config.json`;
- `enabledGlobalTools: string[]`.

Missing fields preserve backward compatibility by loading the standard edition
with no Global tools.

The sidecar loads and validates the product catalog once per pane session. A
resolver converts enabled Global tool records into SDK `SubagentConfig` values.
It enforces both conditions below:

1. `config.edition === 'global'`;
2. the tool ID is present in `config.enabledGlobalTools`.

If either condition is false, no Global specialist is returned. Consequently,
manually adding `accounting-report` to a standard configuration does not expose
the specialist. The resolved agents are passed through `QueryOptions.agents`.
The CLI's existing `task` tool then advertises the specialist to the main model,
whose description instructs it to use the specialist proactively for accounting
report requests. No task-pane button or separate UI protocol is required.

## Accounting-report specialist

The catalog tool ID is `accounting-report`; the session-agent name is
`global-accounting-report`. Its description tells the main model to use it for
accounting, ledger, close, reconciliation, expense, trial-balance, and financial
summary report requests.

The specialist receives only these embedded Excel MCP tools:

- `mcp__excel__excel_get_workbook_overview`;
- `mcp__excel__excel_read_range`;
- `mcp__excel__excel_find`;
- `mcp__excel__excel_get_selection`;
- `mcp__excel__excel_add_worksheet`;
- `mcp__excel__excel_write_range`;
- `mcp__excel__excel_set_formulas`;
- `mcp__excel__excel_format_range`.

The dedicated system prompt requires the specialist to:

1. inspect workbook structure and locate the accounting source range;
2. stop before any write and return a precise clarification question to the
   parent agent when required columns, reporting period, currency, or
   accounting basis are ambiguous;
3. never invent, estimate, silently repair, or overwrite source accounting
   values;
4. create a new `회계보고서` worksheet, using `회계보고서 (2)`,
   `회계보고서 (3)`, and so on when needed;
5. include report scope/as-of metadata, primary totals, account/category
   summaries, anomalous or incomplete entries, reconciliation results, and
   source sheet/range references;
6. use Excel formulas instead of copied constants when a result can remain
   traceable to source cells;
7. apply readable accounting number formats, headings, and exception emphasis;
8. preserve the workbook's language where identifiable and otherwise use the
   user's language;
9. leave existing worksheets unchanged except for user-approved operations;
10. report completion or the precise clarification/blocker to the parent agent.

All workbook writes continue through the existing permission gate. The
specialist cannot bypass approval because it receives the same embedded Excel
MCP server and no alternate write channel.

## Error handling

- Installer catalog or edition errors occur before machine mutation.
- A rendered manifest with unresolved placeholders aborts installation.
- Runtime catalog validation errors prevent Global agents from registering and
  are logged with a user-visible session startup error; the sidecar does not
  silently expose a partial specialist.
- Unknown IDs in `enabledGlobalTools` are reported as configuration errors.
- A standard edition always resolves to zero Global agents, even if its config
  contains Global IDs.
- Ambiguous workbook/accounting data produces a clarification response and no
  new worksheet.
- Existing report sheets are never cleared or overwritten.

## Testing and verification

Behavioral tests will cover:

- PowerShell menu choices `1` and `2`, invalid-choice retry, noninteractive
  `-Edition`, and noninteractive missing-edition failure through the production
  profile resolver;
- `-PlanOnly` output for Standard and Global, including branding and default
  Global-tool IDs, with no filesystem/registry/certificate/task mutation;
- standard and Global manifest rendering, asset references, and absence of
  unresolved placeholders;
- backward-compatible config defaults and relative catalog-path resolution;
- catalog schema validation, unknown IDs, and edition/tool mismatches;
- zero Global agents for standard configurations, including a tampered standard
  config that names `accounting-report`;
- one correctly constrained accounting specialist for the default Global
  configuration;
- the specialist's dedicated prompt contract and exact Excel-tool allowlist;
- session query options receiving agents only for Global sessions;
- build/package output containing the profile catalog and both icon families.

Verification also includes Excel Add-in unit tests, sidecar/task-pane typecheck,
production build with ES5 validation, lint/format checks, a package assembly
inspection, PowerShell 5.1 `-PlanOnly` runs for both editions, and visual
inspection of every Global icon size.
