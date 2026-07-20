import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TemplateReportSpec } from './template-report-spec.js';

const REPORT_TIMEOUT_MS = 15_000;
const MAX_BUFFER_BYTES = 1024 * 1024;

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function requireInside(root: string, candidate: string): string {
  const resolved = path.resolve(candidate);
  if (!isInside(root, resolved)) {
    throw new Error('REPORT_PATH_OUTSIDE_WORKDIR');
  }
  return resolved;
}

function execute(
  executable: string,
  args: string[],
  options: { windowsHide: boolean; timeout: number; maxBuffer: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function mapProcessError(error: unknown): Error {
  const failure = error as {
    code?: string | number;
    killed?: boolean;
    message?: string;
    stderr?: string | Buffer;
  };
  if (
    failure.killed ||
    failure.code === 'ETIMEDOUT' ||
    /timed?\s*out/i.test(failure.message ?? '')
  ) {
    return new Error('REPORT_GENERATION_TIMEOUT');
  }
  const details = `${String(failure.stderr ?? '')}\n${failure.message ?? ''}`;
  const slot = details.match(
    /TEMPLATE_SLOT_(?:NOT_FOUND|AMBIGUOUS):[A-Za-z0-9_-]+/i,
  )?.[0];
  if (slot) return new Error(slot);
  if (/FONT_(?:MISMATCH|NOT_FOUND)/i.test(details)) {
    return new Error('REPORT_FONT_MISMATCH');
  }
  if (/TEMPLATE_OPEN_FAILED/i.test(details)) {
    return new Error('REPORT_TEMPLATE_OPEN_FAILED');
  }
  if (/REPORT_SAVE_FAILED/i.test(details))
    return new Error('REPORT_SAVE_FAILED');
  if (/REPORT_REOPEN_FAILED/i.test(details)) {
    return new Error('REPORT_REOPEN_FAILED');
  }
  if (/REPORT_OVERFLOW/i.test(details)) return new Error('REPORT_OVERFLOW');
  return new Error('REPORT_GENERATION_FAILED');
}

async function assertNoReparseComponents(
  realRoot: string,
  lexicalCandidate: string,
): Promise<void> {
  const relative = path.relative(realRoot, lexicalCandidate);
  if (!isInside(realRoot, lexicalCandidate)) {
    throw new Error('REPORT_PATH_OUTSIDE_WORKDIR');
  }
  let current = realRoot;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const info = await fs.lstat(current);
      if (info.isSymbolicLink()) {
        throw new Error('REPORT_PATH_OUTSIDE_WORKDIR');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

async function nearestExistingAncestor(candidate: string): Promise<string> {
  let current = candidate;
  for (;;) {
    try {
      await fs.lstat(current);
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

async function prepareOutputDirectory(
  root: string,
  realRoot: string,
  outputDir: string,
): Promise<string> {
  const lexicalReports = requireInside(root, outputDir);
  const ancestor = await nearestExistingAncestor(lexicalReports);
  await assertNoReparseComponents(realRoot, ancestor);
  const realAncestor = await fs.realpath(ancestor);
  if (!isInside(realRoot, realAncestor)) {
    throw new Error('REPORT_PATH_OUTSIDE_WORKDIR');
  }

  await fs.mkdir(lexicalReports, { recursive: true });
  await assertNoReparseComponents(realRoot, lexicalReports);
  const [revalidatedRoot, realReports] = await Promise.all([
    fs.realpath(root),
    fs.realpath(lexicalReports),
  ]);
  if (
    revalidatedRoot !== realRoot ||
    !isInside(realRoot, realReports) ||
    (await fs.lstat(lexicalReports)).isSymbolicLink()
  ) {
    throw new Error('REPORT_PATH_OUTSIDE_WORKDIR');
  }
  return realReports;
}

function parsePowerPointPids(stdout: string): Set<number> {
  const pids = new Set<number>();
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^"POWERPNT\.EXE","([0-9]+)"/i);
    if (match) pids.add(Number(match[1]));
  }
  return pids;
}

async function listPowerPointPids(): Promise<Set<number>> {
  const { stdout } = await execute(
    'tasklist.exe',
    ['/FI', 'IMAGENAME eq POWERPNT.EXE', '/FO', 'CSV', '/NH'],
    { windowsHide: true, timeout: 5_000, maxBuffer: MAX_BUFFER_BYTES },
  );
  return parsePowerPointPids(stdout);
}

async function terminateAttributedPowerPoint(
  markerPath: string,
  preexistingPids: Set<number>,
): Promise<void> {
  let pid: number;
  try {
    pid = Number((await fs.readFile(markerPath, 'ascii')).trim());
  } catch (_error) {
    return;
  }
  if (!Number.isSafeInteger(pid) || pid <= 0 || preexistingPids.has(pid))
    return;
  const currentPids = await listPowerPointPids();
  if (!currentPids.has(pid)) return;
  await execute('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    windowsHide: true,
    timeout: 5_000,
    maxBuffer: MAX_BUFFER_BYTES,
  });
}

async function removeRunFiles(
  reports: string,
  runToken: string,
  preservedOutput: string | null,
): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(reports);
  } catch (_error) {
    return;
  }
  await Promise.all(
    names
      .filter((name) => name.includes(runToken))
      .map(async (name) => {
        const candidate = requireInside(reports, path.join(reports, name));
        if (preservedOutput && candidate === preservedOutput) return;
        await fs.rm(candidate, { force: true });
      }),
  );
}

function scriptPath(): string {
  const candidates = [
    path.join(
      path.dirname(process.argv[1] ?? ''),
      'template-report-generator.ps1',
    ),
    path.join(process.cwd(), 'src', 'sidecar', 'template-report-generator.ps1'),
    path.join(
      process.cwd(),
      'packages',
      'powerpoint-addin',
      'src',
      'sidecar',
      'template-report-generator.ps1',
    ),
  ];
  const existing = candidates.find((candidate) => existsSync(candidate));
  if (!existing) throw new Error('REPORT_ENGINE_NOT_FOUND');
  return existing;
}

/** Fill one A4 template into a one-to-three-page report through PowerPoint COM. */
export async function generateTemplateReport(
  templatePath: string,
  spec: TemplateReportSpec,
  outputDir: string,
  allowedRoot: string,
): Promise<string> {
  const root = path.resolve(allowedRoot);
  const template = requireInside(root, templatePath);
  if (path.extname(template).toLowerCase() !== '.pptx') {
    throw new Error('REPORT_TEMPLATE_INVALID');
  }
  const [realRoot, realTemplate] = await Promise.all([
    fs.realpath(root),
    fs.realpath(template),
  ]);
  if (!isInside(realRoot, realTemplate)) {
    throw new Error('REPORT_PATH_OUTSIDE_WORKDIR');
  }
  const realReports = await prepareOutputDirectory(root, realRoot, outputDir);

  const unique = randomUUID();
  const specFile = requireInside(
    realRoot,
    path.join(realReports, `${unique}.json`),
  );
  const outputPath = requireInside(
    realRoot,
    path.join(realReports, `template-report-${unique}.pptx`),
  );
  const markerPath = requireInside(
    realRoot,
    path.join(realReports, `${unique}.powerpoint.pid`),
  );
  await fs.writeFile(specFile, `${JSON.stringify(spec, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });

  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath(),
    '-AllowedRoot',
    realRoot,
    '-TemplatePath',
    realTemplate,
    '-SpecPath',
    specFile,
    '-OutputPath',
    outputPath,
    '-RunToken',
    unique,
    '-ProcessMarkerPath',
    markerPath,
  ];
  let preexistingPids = new Set<number>();
  let succeeded = false;
  try {
    preexistingPids = await listPowerPointPids();
    await execute('powershell.exe', args, {
      windowsHide: true,
      timeout: REPORT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
    });
    await fs.access(outputPath);
    succeeded = true;
    return outputPath;
  } catch (error) {
    try {
      await terminateAttributedPowerPoint(markerPath, preexistingPids);
    } catch (_cleanupError) {
      // Never replace the original stable generation failure with cleanup noise.
    }
    throw mapProcessError(error);
  } finally {
    await removeRunFiles(realReports, unique, succeeded ? outputPath : null);
  }
}
