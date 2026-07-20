import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
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

  beforeEach(async () => {
    workRoot = await mkdtemp(path.join(tmpdir(), 'moli-template-report-'));
    templatePath = path.join(workRoot, 'templates', 'template.pptx');
    outputDir = path.join(workRoot, 'reports');
    await mkdir(path.dirname(templatePath), { recursive: true });
    await writeFile(templatePath, Buffer.from('PK\x03\x04fixture'));
    execFileMock.mockReset();
    execFileMock.mockImplementation((_file, args, _options, callback) => {
      const outputIndex = args.indexOf('-OutputPath');
      const outputPath = args[outputIndex + 1];
      void writeFile(outputPath, Buffer.from('PK\x03\x04result')).then(() =>
        callback(null, outputPath, ''),
      );
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    const [executable, args, options] = execFileMock.mock.calls[0];
    expect(executable).toBe('powershell.exe');
    expect(args).toEqual(
      expect.arrayContaining([
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-AllowedRoot',
        path.resolve(workRoot),
      ]),
    );
    expect(options).toMatchObject({
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });
    const specPath = args[args.indexOf('-SpecPath') + 1];
    expect(JSON.parse(await readFile(specPath, 'utf8'))).toEqual(spec);
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
      execFileMock.mockImplementationOnce((_file, _args, _options, callback) =>
        callback(Object.assign(new Error('failed'), { stderr }), '', stderr),
      );
      await expect(
        generateTemplateReport(templatePath, spec, outputDir, workRoot),
      ).rejects.toThrow(code);
    }
  });
});
