import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadProductProfileCatalog,
  ProductProfileError,
} from '../src/sidecar/product-profiles.js';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const INSTALLER_PATH = path.join(PACKAGE_ROOT, 'installer', 'install.ps1');

interface InstallPlan {
  edition: string;
  menuLabel: string;
  displayName: string;
  description: string;
  icons: Record<string, string>;
  enabledGlobalTools: string[];
  profileCatalogPath: string;
  addinId: string;
  installDir: string;
  configPath: string;
  manifestOutputPath: string;
  profileCatalogOutputPath: string;
}

describe('edition-aware PowerShell installer', () => {
  const temporaryRoots: string[] = [];

  afterEach(() => {
    for (const temporaryRoot of temporaryRoots.splice(0)) {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  function makeTemporaryRoot(prefix = 'moli-installer-test-'): string {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    temporaryRoots.push(temporaryRoot);
    return temporaryRoot;
  }

  function runInstaller(
    installerPath: string,
    args: string[],
    input?: string,
  ): SpawnSyncReturns<string> {
    return spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        installerPath,
        ...args,
      ],
      { encoding: 'utf8', input },
    );
  }

  function parsePlan(stdout: string): InstallPlan {
    const prefix = 'MOLI_INSTALL_PLAN=';
    const planLine = stdout
      .split(/\r?\n/u)
      .find((line) => line.startsWith(prefix));
    if (!planLine) {
      throw new Error(`Installer plan was not emitted. stdout:\n${stdout}`);
    }
    return JSON.parse(planLine.slice(prefix.length)) as InstallPlan;
  }

  function expectSuccess(result: SpawnSyncReturns<string>): void {
    expect(
      result.status,
      `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    ).toBe(0);
  }

  function makePlanArgs(installDir: string, edition?: string): string[] {
    return [
      '-PlanOnly',
      ...(edition ? ['-Edition', edition] : []),
      '-InstallDir',
      installDir,
    ];
  }

  function copyPlanPayload(): {
    installerPath: string;
    catalogPath: string;
    manifestPath: string;
  } {
    const payloadRoot = makeTemporaryRoot('moli-installer-payload-');
    for (const directory of ['installer', 'manifest', 'profiles']) {
      fs.cpSync(
        path.join(PACKAGE_ROOT, directory),
        path.join(payloadRoot, directory),
        { recursive: true },
      );
    }
    return {
      installerPath: path.join(payloadRoot, 'installer', 'install.ps1'),
      catalogPath: path.join(payloadRoot, 'profiles', 'product-profiles.json'),
      manifestPath: path.join(payloadRoot, 'manifest', 'manifest.template.xml'),
    };
  }

  function loadCatalog(catalogPath: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as Record<
      string,
      unknown
    >;
  }

  function getGlobalToolAgent(
    catalog: Record<string, unknown>,
  ): Record<string, unknown> {
    const globalTools = catalog.globalTools as Array<Record<string, unknown>>;
    return globalTools[0].agent as Record<string, unknown>;
  }

  function expectCatalogRejectedByBothValidators(
    payload: ReturnType<typeof copyPlanPayload>,
  ): void {
    expect(() => loadProductProfileCatalog(payload.catalogPath)).toThrow(
      ProductProfileError,
    );

    const installDir = path.join(path.dirname(payload.installerPath), 'output');
    const result = runInstaller(
      payload.installerPath,
      makePlanArgs(installDir, 'Global'),
    );
    expect(
      result.status,
      `PowerShell validator unexpectedly accepted the catalog.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    ).not.toBe(0);
    expect(fs.existsSync(installDir)).toBe(false);
  }

  function renderManifest(
    payload: ReturnType<typeof copyPlanPayload>,
    edition: 'Standard' | 'Global',
    installDir: string,
  ): string {
    const runnerPath = path.join(
      path.dirname(payload.installerPath),
      'render-manifest.test.ps1',
    );
    fs.writeFileSync(
      runnerPath,
      `param(
  [string]$CatalogPath,
  [string]$TemplatePath,
  [string]$Edition,
  [string]$InstallDir
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'product-profile.psm1') -Force
$catalog = Get-MoliProductProfileCatalog -CatalogPath $CatalogPath
$resolved = Resolve-MoliInstallPlan -Catalog $catalog -Edition $Edition -InstallDir $InstallDir -Port 39215 -Version '0.5.0' -AddinId '51ef4b60-29f7-442c-99b4-93419c6e68e2' -ManifestTemplatePath $TemplatePath
$bytes = [Text.Encoding]::UTF8.GetBytes($resolved.ManifestXml)
Write-Output ('MOLI_MANIFEST_BASE64=' + [Convert]::ToBase64String($bytes))
`,
      'utf8',
    );
    const result = runInstaller(runnerPath, [
      '-CatalogPath',
      payload.catalogPath,
      '-TemplatePath',
      payload.manifestPath,
      '-Edition',
      edition,
      '-InstallDir',
      installDir,
    ]);
    expectSuccess(result);
    const prefix = 'MOLI_MANIFEST_BASE64=';
    const encoded = result.stdout
      .split(/\r?\n/u)
      .find((line) => line.startsWith(prefix));
    expect(encoded, `stdout:\n${result.stdout}`).toBeDefined();
    return Buffer.from(encoded!.slice(prefix.length), 'base64').toString(
      'utf8',
    );
  }

  function deployEditionFiles(
    payload: ReturnType<typeof copyPlanPayload>,
    edition: 'Standard' | 'Global',
    installDir: string,
  ): SpawnSyncReturns<string> {
    const runnerPath = path.join(
      path.dirname(payload.installerPath),
      'deploy-files.test.ps1',
    );
    fs.writeFileSync(
      runnerPath,
      `param(
  [string]$PayloadPath,
  [string]$CatalogPath,
  [string]$TemplatePath,
  [string]$Edition,
  [string]$InstallDir
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'product-profile.psm1') -Force
$catalog = Get-MoliProductProfileCatalog -CatalogPath $CatalogPath
$resolved = Resolve-MoliInstallPlan -Catalog $catalog -Edition $Edition -InstallDir $InstallDir -Port 39215 -Version '0.5.0' -AddinId '51ef4b60-29f7-442c-99b4-93419c6e68e2' -ManifestTemplatePath $TemplatePath
Invoke-MoliFileDeployment -PayloadPath $PayloadPath -Plan $resolved.Plan -RenderedManifest $resolved.ManifestXml -Port 39215 -CertPassphrase 'test-passphrase'
`,
      'utf8',
    );
    return runInstaller(runnerPath, [
      '-PayloadPath',
      path.dirname(path.dirname(payload.installerPath)),
      '-CatalogPath',
      payload.catalogPath,
      '-TemplatePath',
      payload.manifestPath,
      '-Edition',
      edition,
      '-InstallDir',
      installDir,
    ]);
  }

  function getPostInstallGuidance(
    payload: ReturnType<typeof copyPlanPayload>,
    edition: 'Standard' | 'Global',
    installDir: string,
    useCatalog: boolean,
  ): string[] {
    const runnerPath = path.join(
      path.dirname(payload.installerPath),
      'post-install-guidance.test.ps1',
    );
    fs.writeFileSync(
      runnerPath,
      `param(
  [string]$CatalogPath,
  [string]$TemplatePath,
  [string]$Edition,
  [string]$InstallDir,
  [switch]$UseCatalog
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'product-profile.psm1') -Force
$catalog = Get-MoliProductProfileCatalog -CatalogPath $CatalogPath
$resolved = Resolve-MoliInstallPlan -Catalog $catalog -Edition $Edition -InstallDir $InstallDir -Port 39215 -Version '0.5.0' -AddinId '51ef4b60-29f7-442c-99b4-93419c6e68e2' -ManifestTemplatePath $TemplatePath
$lines = @(Get-MoliPostInstallGuidance -Plan $resolved.Plan -UseCatalog:$UseCatalog)
$json = ConvertTo-Json -InputObject $lines -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($json)
Write-Output ('MOLI_GUIDANCE_BASE64=' + [Convert]::ToBase64String($bytes))
`,
      'utf8',
    );
    const result = runInstaller(runnerPath, [
      '-CatalogPath',
      payload.catalogPath,
      '-TemplatePath',
      payload.manifestPath,
      '-Edition',
      edition,
      '-InstallDir',
      installDir,
      ...(useCatalog ? ['-UseCatalog'] : []),
    ]);
    expectSuccess(result);
    const prefix = 'MOLI_GUIDANCE_BASE64=';
    const encoded = result.stdout
      .split(/\r?\n/u)
      .find((line) => line.startsWith(prefix));
    expect(encoded, `stdout:\n${result.stdout}`).toBeDefined();
    return JSON.parse(
      Buffer.from(encoded!.slice(prefix.length), 'base64').toString('utf8'),
    ) as string[];
  }

  function readPowerShellJson(filePath: string): Record<string, unknown> {
    return JSON.parse(
      fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''),
    ) as Record<string, unknown>;
  }

  it('emits the Standard plan without creating the requested install directory', () => {
    const parentRoot = makeTemporaryRoot();
    const installDir = path.join(parentRoot, 'standard-install');
    const result = runInstaller(
      INSTALLER_PATH,
      makePlanArgs(installDir, 'Standard'),
    );

    expectSuccess(result);
    expect(parsePlan(result.stdout)).toMatchObject({
      edition: 'standard',
      menuLabel: 'Molicode',
      displayName: 'Molicode',
      description: 'Offline Molicode AI assistant for Excel.',
      icons: {
        app32: 'assets/icon-32.png',
        app80: 'assets/icon-80.png',
        ribbon16: 'assets/ribbon-16.png',
        ribbon32: 'assets/ribbon-32.png',
        ribbon80: 'assets/ribbon-80.png',
      },
      enabledGlobalTools: [],
      profileCatalogPath: 'profiles/product-profiles.json',
      addinId: '51ef4b60-29f7-442c-99b4-93419c6e68e2',
      installDir,
      configPath: path.join(installDir, 'config.json'),
      manifestOutputPath: path.join(installDir, 'manifest', 'manifest.xml'),
      profileCatalogOutputPath: path.join(
        installDir,
        'profiles',
        'product-profiles.json',
      ),
    });
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it('emits the Global plan with the accounting-report tool enabled', () => {
    const parentRoot = makeTemporaryRoot();
    const installDir = path.join(parentRoot, 'global-install');
    const result = runInstaller(
      INSTALLER_PATH,
      makePlanArgs(installDir, 'Global'),
    );

    expectSuccess(result);
    expect(parsePlan(result.stdout)).toMatchObject({
      edition: 'global',
      menuLabel: 'Molicode for Global',
      displayName: 'Molicode for Global',
      description:
        'Offline Molicode for Global AI assistant for Excel with specialized accounting reporting.',
      icons: {
        app32: 'assets/global-icon-32.png',
        app80: 'assets/global-icon-80.png',
        ribbon16: 'assets/global-ribbon-16.png',
        ribbon32: 'assets/global-ribbon-32.png',
        ribbon80: 'assets/global-ribbon-80.png',
      },
      enabledGlobalTools: ['accounting-report'],
      profileCatalogPath: 'profiles/product-profiles.json',
      addinId: '51ef4b60-29f7-442c-99b4-93419c6e68e2',
      installDir,
      configPath: path.join(installDir, 'config.json'),
      manifestOutputPath: path.join(installDir, 'manifest', 'manifest.xml'),
      profileCatalogOutputPath: path.join(
        installDir,
        'profiles',
        'product-profiles.json',
      ),
    });
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it('accepts the shipped catalog in both runtime and PowerShell validators', () => {
    const payload = copyPlanPayload();
    const installDir = path.join(path.dirname(payload.installerPath), 'output');

    expect(() => loadProductProfileCatalog(payload.catalogPath)).not.toThrow();
    const result = runInstaller(
      payload.installerPath,
      makePlanArgs(installDir, 'Global'),
    );

    expectSuccess(result);
    expect(parsePlan(result.stdout).edition).toBe('global');
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it('rejects widened accounting tools in both validators', () => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    const agent = getGlobalToolAgent(catalog);
    agent.tools = [...(agent.tools as string[]), 'ShellTool'];
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));

    expectCatalogRejectedByBothValidators(payload);
  });

  it('rejects whitespace-only required strings in both validators', () => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    getGlobalToolAgent(catalog).description = ' \t ';
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));

    expectCatalogRejectedByBothValidators(payload);
  });

  it.each([
    '/assets/icon-32.png',
    'assets/../icon-32.png',
    'https://example.test/icon-32.png',
    'assets\\icon-32.png',
    'C:/assets/icon-32.png',
    'icons/icon-32.png',
    'assets//icon-32.png',
  ])('rejects unsafe icon path %s in both validators', (unsafeIconPath) => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    const editions = catalog.editions as Array<Record<string, unknown>>;
    const icons = editions[0].icons as Record<string, unknown>;
    icons.app32 = unsafeIconPath;
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));

    expectCatalogRejectedByBothValidators(payload);
  });

  it('rejects duplicate Global agent names in both validators', () => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    const globalTools = catalog.globalTools as Array<Record<string, unknown>>;
    for (const id of ['future-report-one', 'future-report-two']) {
      const futureTool = structuredClone(globalTools[0]);
      futureTool.id = id;
      (futureTool.agent as Record<string, unknown>).name =
        'future-report-agent';
      globalTools.push(futureTool);
    }
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));

    expectCatalogRejectedByBothValidators(payload);
  });

  it('rejects an altered accounting-report agent name in both validators', () => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    getGlobalToolAgent(catalog).name = 'renamed-accounting-report';
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));

    expectCatalogRejectedByBothValidators(payload);
  });

  it('rejects a replacement ID claiming the reserved accounting agent name in both validators', () => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    const globalTools = catalog.globalTools as Array<Record<string, unknown>>;
    globalTools[0].id = 'replacement-accounting';
    const agent = getGlobalToolAgent(catalog);
    agent.tools = [...(agent.tools as string[]), 'ShellTool'];
    const editions = catalog.editions as Array<Record<string, unknown>>;
    editions[1].defaultGlobalTools = ['replacement-accounting'];
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));

    expectCatalogRejectedByBothValidators(payload);
  });

  it('retries an invalid interactive choice and selects Global from stdin', () => {
    const parentRoot = makeTemporaryRoot();
    const installDir = path.join(parentRoot, 'interactive-install');
    const result = runInstaller(
      INSTALLER_PATH,
      makePlanArgs(installDir),
      '9\r\n2\r\n',
    );

    expectSuccess(result);
    expect(result.stdout).toContain('1. Molicode');
    expect(result.stdout).toContain('2. Molicode for Global');
    expect(parsePlan(result.stdout).edition).toBe('global');
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it.each([
    { choice: '1', edition: 'standard' },
    { choice: '2', edition: 'global' },
  ])(
    'keeps interactive choice $choice ID-stable when catalog editions are reordered',
    ({ choice, edition }) => {
      const payload = copyPlanPayload();
      const catalog = loadCatalog(payload.catalogPath);
      const editions = catalog.editions as Array<Record<string, unknown>>;
      catalog.editions = [...editions].reverse();
      fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));
      const installDir = path.join(
        path.dirname(payload.installerPath),
        `interactive-${edition}`,
      );

      const result = runInstaller(
        payload.installerPath,
        makePlanArgs(installDir),
        `${choice}\r\n`,
      );

      expectSuccess(result);
      expect(result.stdout).toContain('1. Molicode');
      expect(result.stdout).toContain('2. Molicode for Global');
      expect(parsePlan(result.stdout).edition).toBe(edition);
      expect(fs.existsSync(installDir)).toBe(false);
    },
  );

  it('fails clearly when the edition is omitted in a noninteractive host', () => {
    const parentRoot = makeTemporaryRoot();
    const installDir = path.join(parentRoot, 'noninteractive-install');
    const result = runInstaller(INSTALLER_PATH, [
      ...makePlanArgs(installDir),
      '-NonInteractiveHost',
    ]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /edition.+required.+noninteractive/iu,
    );
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it('fails with Korean edition guidance in a real PowerShell NonInteractive host', () => {
    const parentRoot = makeTemporaryRoot();
    const installDir = path.join(parentRoot, 'real-noninteractive-install');
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        INSTALLER_PATH,
        ...makePlanArgs(installDir),
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      '비대화형 PowerShell에서는 제품 에디션을 선택할 수 없습니다. -Edition Standard 또는 -Edition Global을 지정하세요.',
    );
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it.each([
    {
      name: 'unsupported schema versions',
      error: /schemaVersion must be 1/iu,
      mutate(catalog: Record<string, unknown>) {
        catalog.schemaVersion = 2;
      },
    },
    {
      name: 'empty required edition strings',
      error: /displayName.+non-empty/iu,
      mutate(catalog: Record<string, unknown>) {
        const editions = catalog.editions as Array<Record<string, unknown>>;
        editions[0].displayName = '  ';
      },
    },
    {
      name: 'duplicate edition IDs',
      error: /duplicate edition ID/iu,
      mutate(catalog: Record<string, unknown>) {
        const editions = catalog.editions as Array<Record<string, unknown>>;
        editions.push(structuredClone(editions[0]));
      },
    },
    {
      name: 'duplicate Global tool IDs',
      error: /duplicate Global tool ID/iu,
      mutate(catalog: Record<string, unknown>) {
        const globalTools = catalog.globalTools as Array<
          Record<string, unknown>
        >;
        globalTools.push(structuredClone(globalTools[0]));
      },
    },
    {
      name: 'unsafe icon paths',
      error: /icons\.app32.+relative/iu,
      mutate(catalog: Record<string, unknown>) {
        const editions = catalog.editions as Array<Record<string, unknown>>;
        const icons = editions[0].icons as Record<string, unknown>;
        icons.app32 = '../outside.png';
      },
    },
    {
      name: 'unknown default Global tool references',
      error: /unknown Global tool/iu,
      mutate(catalog: Record<string, unknown>) {
        const editions = catalog.editions as Array<Record<string, unknown>>;
        editions[1].defaultGlobalTools = ['unknown-tool'];
      },
    },
  ])(
    'rejects $name before creating the install directory',
    ({ mutate, error }) => {
      const payload = copyPlanPayload();
      const catalog = loadCatalog(payload.catalogPath);
      mutate(catalog);
      fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));
      const installDir = path.join(
        path.dirname(payload.installerPath),
        'output',
      );

      const result = runInstaller(
        payload.installerPath,
        makePlanArgs(installDir, 'Global'),
      );

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(error);
      expect(fs.existsSync(installDir)).toBe(false);
    },
  );

  it.each([
    { field: 'modelConfig', value: 42 },
    { field: 'modelConfig', value: true },
    { field: 'modelConfig', value: null },
    { field: 'modelConfig', value: [] },
    { field: 'runConfig', value: 42 },
    { field: 'runConfig', value: true },
    { field: 'runConfig', value: null },
    { field: 'runConfig', value: [] },
  ])('rejects non-object $field value $value', ({ field, value }) => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    getGlobalToolAgent(catalog)[field] = value;
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));

    expectCatalogRejectedByBothValidators(payload);
  });

  it('accepts optional agent settings with the same field types as the runtime schema', () => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    const agent = getGlobalToolAgent(catalog);
    agent.modelConfig = { model: '', temp: 0.25, top_p: 1 };
    agent.runConfig = { max_time_minutes: 0.5, max_turns: -1 };
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));
    const installDir = path.join(path.dirname(payload.installerPath), 'output');

    expect(() => loadProductProfileCatalog(payload.catalogPath)).not.toThrow();
    const result = runInstaller(
      payload.installerPath,
      makePlanArgs(installDir, 'Global'),
    );

    expectSuccess(result);
    expect(parsePlan(result.stdout).edition).toBe('global');
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it('XML-escapes profile text while validating the manifest plan', () => {
    const payload = copyPlanPayload();
    const catalog = loadCatalog(payload.catalogPath);
    const editions = catalog.editions as Array<Record<string, unknown>>;
    editions[0].displayName = 'Moli & <Code> "Standard"';
    editions[0].description = 'Offline & safe <assistant> "for Excel".';
    fs.writeFileSync(payload.catalogPath, JSON.stringify(catalog));
    const installDir = path.join(path.dirname(payload.installerPath), 'output');

    const result = runInstaller(
      payload.installerPath,
      makePlanArgs(installDir, 'Standard'),
    );

    expectSuccess(result);
    expect(parsePlan(result.stdout)).toMatchObject({
      displayName: 'Moli & <Code> "Standard"',
      description: 'Offline & safe <assistant> "for Excel".',
    });
    const manifest = renderManifest(payload, 'Standard', installDir);
    expect(manifest).toContain(
      'DefaultValue="Moli &amp; &lt;Code&gt; &quot;Standard&quot;"',
    );
    expect(manifest).toContain(
      'DefaultValue="Offline &amp; safe &lt;assistant&gt; &quot;for Excel&quot;."',
    );
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it.each([
    {
      edition: 'Standard' as const,
      displayName: 'Molicode',
      app32: 'assets/icon-32.png',
      app80: 'assets/icon-80.png',
      ribbon16: 'assets/ribbon-16.png',
      ribbon32: 'assets/ribbon-32.png',
      ribbon80: 'assets/ribbon-80.png',
    },
    {
      edition: 'Global' as const,
      displayName: 'Molicode for Global',
      app32: 'assets/global-icon-32.png',
      app80: 'assets/global-icon-80.png',
      ribbon16: 'assets/global-ribbon-16.png',
      ribbon32: 'assets/global-ribbon-32.png',
      ribbon80: 'assets/global-ribbon-80.png',
    },
  ])('renders $edition manifest values and icon URL paths', (expected) => {
    const payload = copyPlanPayload();
    const installDir = path.join(path.dirname(payload.installerPath), 'output');

    const manifest = renderManifest(payload, expected.edition, installDir);

    expect(manifest).toContain(
      `DisplayName DefaultValue="${expected.displayName}"`,
    );
    expect(manifest).toContain(
      `IconUrl DefaultValue="https://localhost:39215/${expected.app32}"`,
    );
    expect(manifest).toContain(
      `HighResolutionIconUrl DefaultValue="https://localhost:39215/${expected.app80}"`,
    );
    expect(manifest).toContain(
      `MoliCode.Icon16" DefaultValue="https://localhost:39215/${expected.ribbon16}"`,
    );
    expect(manifest).toContain(
      `MoliCode.Icon32" DefaultValue="https://localhost:39215/${expected.ribbon32}"`,
    );
    expect(manifest).toContain(
      `MoliCode.Icon80" DefaultValue="https://localhost:39215/${expected.ribbon80}"`,
    );
    expect(manifest).not.toMatch(/\{\{[^{}]+\}\}/u);
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it('deploys the selected profile catalog, config, and rendered manifest through the production file function', () => {
    const payload = copyPlanPayload();
    const installDir = makeTemporaryRoot('moli-installer-output-');

    const result = deployEditionFiles(payload, 'Standard', installDir);

    expectSuccess(result);
    expect(
      readPowerShellJson(path.join(installDir, 'config.json')),
    ).toMatchObject({
      edition: 'standard',
      profileCatalogPath: 'profiles/product-profiles.json',
      enabledGlobalTools: [],
    });
    expect(
      readPowerShellJson(
        path.join(installDir, 'profiles', 'product-profiles.json'),
      ),
    ).toEqual(loadCatalog(payload.catalogPath));
    const manifest = fs.readFileSync(
      path.join(installDir, 'manifest', 'manifest.xml'),
      'utf8',
    );
    expect(manifest).toContain('DisplayName DefaultValue="Molicode"');
    expect(manifest).toContain(
      'IconUrl DefaultValue="https://localhost:39215/assets/icon-32.png"',
    );
    expect(manifest).not.toMatch(/\{\{[^{}]+\}\}/u);
  });

  it('replaces Standard config and manifest with Global in the same install root', () => {
    const payload = copyPlanPayload();
    const installDir = makeTemporaryRoot('moli-installer-output-');
    expectSuccess(deployEditionFiles(payload, 'Standard', installDir));

    const result = deployEditionFiles(payload, 'Global', installDir);

    expectSuccess(result);
    expect(
      readPowerShellJson(path.join(installDir, 'config.json')),
    ).toMatchObject({
      edition: 'global',
      profileCatalogPath: 'profiles/product-profiles.json',
      enabledGlobalTools: ['accounting-report'],
    });
    const manifest = fs.readFileSync(
      path.join(installDir, 'manifest', 'manifest.xml'),
      'utf8',
    );
    expect(manifest).toContain(
      'DisplayName DefaultValue="Molicode for Global"',
    );
    expect(manifest).toContain(
      'IconUrl DefaultValue="https://localhost:39215/assets/global-icon-32.png"',
    );
    expect(manifest).not.toMatch(/\{\{[^{}]+\}\}/u);
  });

  it.each([
    {
      edition: 'Standard' as const,
      displayName: 'Molicode',
      useCatalog: false,
    },
    {
      edition: 'Global' as const,
      displayName: 'Molicode for Global',
      useCatalog: true,
    },
  ])(
    'uses the selected $edition plan displayName in post-install guidance',
    ({ edition, displayName, useCatalog }) => {
      const payload = copyPlanPayload();
      const installDir = path.join(
        path.dirname(payload.installerPath),
        'output',
      );

      const guidance = getPostInstallGuidance(
        payload,
        edition,
        installDir,
        useCatalog,
      ).join('\n');

      expect(guidance).toContain(`"${displayName}" 선택`);
      expect(guidance).not.toContain('"몰리 코드 for Excel" 선택');
    },
  );

  it('rejects an unresolved manifest placeholder before mutation', () => {
    const payload = copyPlanPayload();
    fs.appendFileSync(payload.manifestPath, '\n<!-- {{UNKNOWN_VALUE}} -->\n');
    const installDir = path.join(path.dirname(payload.installerPath), 'output');

    const result = runInstaller(
      payload.installerPath,
      makePlanArgs(installDir, 'Standard'),
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /unresolved manifest placeholder/iu,
    );
    expect(fs.existsSync(installDir)).toBe(false);
  });
});
