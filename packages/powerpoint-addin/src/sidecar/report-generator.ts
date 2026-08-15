import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LocalFileAttachment } from '../shared/messages.js';

const MAX_BUFFER_BYTES = 1024 * 1024;

function execute(
  executable: string,
  args: string[],
  timeout: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      { timeout, windowsHide: true, maxBuffer: MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
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
    5_000,
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
  if (!Number.isSafeInteger(pid) || pid <= 0 || preexistingPids.has(pid)) {
    return;
  }
  if (!(await listPowerPointPids()).has(pid)) return;
  await execute('taskkill.exe', ['/PID', String(pid), '/T', '/F'], 5_000);
}

export interface ReportAction {
  task: string;
  owner: string;
  due: string;
}

export interface MeetingReportSpec {
  title: string;
  date: string;
  meta: string[];
  purpose: string;
  discussions: string[];
  decisions: string[];
  actions: ReportAction[];
  risks: string[];
  nextMeeting: string[];
}

function section(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(
      `^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
      'im',
    ).exec(markdown)?.[1] ?? ''
  ).trim();
}

function listItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*]|\d+\.)\s+/.test(line))
    .map((line) => line.replace(/^(?:[-*]|\d+\.)\s+/, '').trim())
    .filter(Boolean);
}

export function parseMeetingMarkdown(markdown: string): MeetingReportSpec {
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? '회의 결과 보고';
  const preamble = markdown.split(/^##\s+/m)[0] ?? '';
  const meta = listItems(preamble);
  const date = /회의일\s*:\s*([^\r\n]+)/.exec(preamble)?.[1]?.trim() ?? '';
  const purpose = section(markdown, '회의 목적').replace(/\s+/g, ' ').trim();
  const discussions = listItems(section(markdown, '주요 논의'));
  const decisions = listItems(section(markdown, '결정 사항'));
  const actionLines = section(markdown, '실행 과제')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .slice(2);
  const actions = actionLines
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length >= 3)
    .map(([task, owner, due]) => ({ task, owner, due }));
  const risks = listItems(section(markdown, '위험 및 대응'));
  const nextMeeting = listItems(section(markdown, '다음 회의'));
  return {
    title,
    date,
    meta,
    purpose,
    discussions,
    decisions,
    actions,
    risks,
    nextMeeting,
  };
}

export function isReportCommand(text: string): boolean {
  return /^\/report(?:\s|$)/i.test(text.trim());
}

export function assertReportOutputDir(
  outputDir: string,
  allowedRoot: string,
): string {
  const resolvedOutput = path.resolve(outputDir);
  const resolvedRoot = path.resolve(allowedRoot);
  const relative = path.relative(resolvedRoot, resolvedOutput);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      'Report output directory is outside the configured work root',
    );
  }
  return resolvedOutput;
}

function safeBaseName(name: string): string {
  const base = path.basename(name, path.extname(name));
  return (
    base.replace(/[^0-9A-Za-z가-힣_-]+/g, '-').replace(/^-+|-+$/g, '') ||
    'meeting-report'
  );
}

export async function generatePowerPointReport(
  attachment: LocalFileAttachment,
  outputDir: string,
  allowedRoot: string = outputDir,
): Promise<string> {
  const spec = parseMeetingMarkdown(attachment.content);
  const safeOutputDir = assertReportOutputDir(outputDir, allowedRoot);
  await fs.mkdir(safeOutputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = safeBaseName(attachment.name);
  const specPath = path.join(safeOutputDir, `${base}-${stamp}.json`);
  const outputPath = path.join(safeOutputDir, `${base}-${stamp}.pptx`);
  const runToken = randomUUID();
  const markerPath = path.join(safeOutputDir, `${runToken}.powerpoint.pid`);
  await fs.writeFile(specPath, JSON.stringify(spec, null, 2), 'utf8');

  const scriptPath = path.join(
    path.dirname(process.argv[1]),
    'report-generator.ps1',
  );
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-SpecPath',
    specPath,
    '-OutputPath',
    outputPath,
    '-ProcessMarkerPath',
    markerPath,
    '-RunToken',
    runToken,
  ];
  let preexistingPids = new Set<number>();
  try {
    preexistingPids = await listPowerPointPids();
    args.push(
      '-PreexistingPowerPointPids',
      [...preexistingPids].sort((left, right) => left - right).join(','),
    );
    await execute('powershell.exe', args, 120_000);
    await fs.access(outputPath);
    return outputPath;
  } catch (error) {
    try {
      await terminateAttributedPowerPoint(markerPath, preexistingPids);
    } catch (_cleanupError) {
      // Preserve the original generation error.
    }
    throw error;
  } finally {
    await Promise.all([
      fs.rm(specPath, { force: true }),
      fs.rm(markerPath, { force: true }),
    ]);
  }
}
