import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({ execFile: execFileMock }));

import { generateTemplateReport } from '../src/sidecar/template-report-generator.js';
import type { TemplateReportSpec } from '../src/sidecar/template-report-spec.js';

const spec: TemplateReportSpec = {
  title: '회의 결과 보고',
  date: '2026.07.19',
  department: '디지털사업부',
  pages: [
    {
      section1: {
        heading: '회의 개요',
        bullets: ['자동화 방안을 논의했습니다.'],
      },
      section2: {
        heading: '실행 과제',
        columns: ['담당자', '과제', '기한', '상태'],
        rows: [['김민수', '시안 검토', '2026.07.23', '진행']],
      },
      section3: {
        heading: '리스크 및 요청',
        bullets: ['책임자 승인이 필요합니다.'],
      },
    },
  ],
};

describe('template report generator wrapper', () => {
  let workRoot: string;
  let templatePath: string;
  let outputDir: string;
  let capturedSpec: TemplateReportSpec | undefined;
  let generatorFailure: (Error & { stderr?: string; killed?: boolean }) | null;
  let timeoutMode: boolean;
  let tasklistCalls: number;

  beforeEach(async () => {
    workRoot = await mkdtemp(path.join(tmpdir(), 'moli-template-report-'));
    templatePath = path.join(workRoot, 'templates', 'template.pptx');
    outputDir = path.join(workRoot, 'reports');
    await mkdir(path.dirname(templatePath), { recursive: true });
    await writeFile(templatePath, Buffer.from('PK\x03\x04fixture'));
    capturedSpec = undefined;
    generatorFailure = null;
    timeoutMode = false;
    tasklistCalls = 0;
    execFileMock.mockReset();
    execFileMock.mockImplementation((file, args, _options, callback) => {
      if (file === 'tasklist.exe') {
        tasklistCalls += 1;
        const rows =
          timeoutMode && tasklistCalls > 1
            ? '"POWERPNT.EXE","101"\r\n"POWERPNT.EXE","202"\r\n'
            : '"POWERPNT.EXE","101"\r\n';
        callback(null, rows, '');
        return;
      }
      if (file === 'taskkill.exe') {
        callback(null, 'SUCCESS', '');
        return;
      }
      const outputIndex = args.indexOf('-OutputPath');
      const outputPath = args[outputIndex + 1];
      const specPath = args[args.indexOf('-SpecPath') + 1];
      const markerPath = args[args.indexOf('-ProcessMarkerPath') + 1];
      const runToken = args[args.indexOf('-RunToken') + 1];
      void readFile(specPath, 'utf8').then(async (raw) => {
        capturedSpec = JSON.parse(raw);
        if (timeoutMode) {
          await writeFile(markerPath, '202\n', 'ascii');
          await writeFile(
            path.join(outputDir, `orphan.${runToken}.tmp.pptx`),
            'temporary',
          );
          callback(
            Object.assign(new Error('timed out'), {
              code: 'ETIMEDOUT',
              killed: true,
              stderr: '',
            }),
            '',
            '',
          );
          return;
        }
        if (generatorFailure) {
          callback(generatorFailure, '', generatorFailure.stderr ?? '');
          return;
        }
        await writeFile(outputPath, Buffer.from('PK\x03\x04result'));
        callback(null, outputPath, '');
      });
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(workRoot, { recursive: true, force: true });
  });

  it('rejects a template or output outside the work root', async () => {
    await expect(
      generateTemplateReport(
        'C:\\outside\\template.pptx',
        spec,
        outputDir,
        workRoot,
      ),
    ).rejects.toThrow('REPORT_PATH_OUTSIDE_WORKDIR');

    await expect(
      generateTemplateReport(templatePath, spec, 'C:\\outside', workRoot),
    ).rejects.toThrow('REPORT_PATH_OUTSIDE_WORKDIR');
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('passes a UTF-8 JSON spec to a hidden PowerShell process', async () => {
    const result = await generateTemplateReport(
      templatePath,
      spec,
      outputDir,
      workRoot,
    );

    expect(result).toMatch(/\.pptx$/i);
    const [executable, args, options] = execFileMock.mock.calls.find(
      ([file, callArgs]) =>
        file === 'powershell.exe' && callArgs.includes('-OutputPath'),
    );
    expect(executable).toBe('powershell.exe');
    expect(args).toEqual(
      expect.arrayContaining([
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-AllowedRoot',
        path.resolve(workRoot),
        '-PreexistingPowerPointPids',
        '101',
      ]),
    );
    expect(options).toMatchObject({
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });
    const specPath = args[args.indexOf('-SpecPath') + 1];
    expect(capturedSpec).toEqual(spec);
    await expect(access(specPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(path.basename(args[args.indexOf('-File') + 1])).toBe(
      'template-report-generator.ps1',
    );
  });

  it('maps process failures to stable report error codes', async () => {
    for (const [stderr, code] of [
      ['TEMPLATE_SLOT_NOT_FOUND:table', 'TEMPLATE_SLOT_NOT_FOUND:table'],
      ['FONT_MISMATCH:원신한', 'REPORT_FONT_MISMATCH'],
      ['TEMPLATE_OPEN_FAILED:bad template', 'REPORT_TEMPLATE_OPEN_FAILED'],
      ['REPORT_SAVE_FAILED:disk', 'REPORT_SAVE_FAILED'],
      ['REPORT_REOPEN_FAILED:bad output', 'REPORT_REOPEN_FAILED'],
    ]) {
      generatorFailure = Object.assign(new Error('failed'), { stderr });
      await expect(
        generateTemplateReport(templatePath, spec, outputDir, workRoot),
      ).rejects.toThrow(code);
      expect(
        (await readdir(outputDir)).filter((name) => name.endsWith('.json')),
      ).toEqual([]);
    }
  });

  it('rejects an output junction before creating any directory through it', async () => {
    if (process.platform !== 'win32') return;
    const outside = await mkdtemp(path.join(tmpdir(), 'moli-ppt-outside-'));
    const junction = path.join(workRoot, 'junction');
    try {
      await symlink(outside, junction, 'junction');
      await expect(
        generateTemplateReport(
          templatePath,
          spec,
          path.join(junction, 'reports'),
          workRoot,
        ),
      ).rejects.toThrow('REPORT_PATH_OUTSIDE_WORKDIR');
      await expect(access(path.join(outside, 'reports'))).rejects.toMatchObject(
        {
          code: 'ENOENT',
        },
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('removes run files and terminates only the attributed new PowerPoint on timeout', async () => {
    timeoutMode = true;
    await expect(
      generateTemplateReport(templatePath, spec, outputDir, workRoot),
    ).rejects.toThrow('REPORT_GENERATION_TIMEOUT');

    const generatorCall = execFileMock.mock.calls.find(
      ([file, args]) => file === 'powershell.exe' && args.includes('-RunToken'),
    );
    const runToken =
      generatorCall[1][generatorCall[1].indexOf('-RunToken') + 1];
    expect(
      (await readdir(outputDir)).filter((name) => name.includes(runToken)),
    ).toEqual([]);
    const killCalls = execFileMock.mock.calls.filter(
      ([file]) => file === 'taskkill.exe',
    );
    expect(killCalls).toHaveLength(1);
    expect(killCalls[0][1]).toEqual(expect.arrayContaining(['/PID', '202']));
    expect(killCalls[0][1]).not.toContain('101');
  });
});
