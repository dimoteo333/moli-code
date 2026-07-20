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
  const slot = details.match(/TEMPLATE_SLOT_NOT_FOUND:[A-Za-z0-9_-]+/i)?.[0];
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
  const reports = requireInside(root, outputDir);
  if (path.extname(template).toLowerCase() !== '.pptx') {
    throw new Error('REPORT_TEMPLATE_INVALID');
  }
  await fs.mkdir(reports, { recursive: true });
  const [realRoot, realTemplate, realReports] = await Promise.all([
    fs.realpath(root),
    fs.realpath(template),
    fs.realpath(reports),
  ]);
  if (!isInside(realRoot, realTemplate) || !isInside(realRoot, realReports)) {
    throw new Error('REPORT_PATH_OUTSIDE_WORKDIR');
  }

  const unique = `${Date.now()}-${randomUUID()}`;
  const specFile = requireInside(
    realRoot,
    path.join(realReports, `${unique}.json`),
  );
  const outputPath = requireInside(
    realRoot,
    path.join(realReports, `template-report-${unique}.pptx`),
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
  ];
  try {
    await execute('powershell.exe', args, {
      windowsHide: true,
      timeout: REPORT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
    });
    await fs.access(outputPath);
    return outputPath;
  } catch (error) {
    throw mapProcessError(error);
  }
}
