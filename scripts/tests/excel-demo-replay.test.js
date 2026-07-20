/**
 * @license
 * Copyright 2026 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildExpenseDemoData } from '../addin-performance/excel-demo-data.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const scriptPath = path.join(
  repositoryRoot,
  'scripts',
  'addin-performance',
  'replay-excel-demo-operations.ps1',
);
const fixtureWorkbookPath = path.join(
  repositoryRoot,
  'artifacts',
  'addin-demo',
  '2026-07-20',
  'excel',
  '법인카드-자동점검-시연.xlsx',
);

function buildOperations() {
  const resultFormulas = Array.from({ length: 36 }, (_, index) => {
    const row = index + 2;
    return [
      `=IF(H${row}="미제출","영수증 누락",IF(G${row}>I${row},"한도 초과",IF(COUNTIFS($A$2:A${row},A${row},$D$2:D${row},D${row},$E$2:E${row},E${row},$G$2:G${row},G${row})>1,"중복 의심","정상")))`,
    ];
  });
  const departments = [
    '프로덕트운영팀',
    '영업기획부',
    '고객지원팀',
    '경영지원팀',
  ];

  return [
    {
      runIndex: 1,
      kind: 'deterministic-test',
      operations: [
        {
          op: 'set_formulas',
          args: {
            sheet: '원천자료',
            range: 'J2:J37',
            formulas: resultFormulas,
          },
        },
        {
          op: 'set_formulas',
          args: {
            sheet: '자동화결과',
            range: 'B3:B6',
            formulas: [
              ["=SUM('원천자료'!G2:G37)"],
              ['=COUNTIF(\'원천자료\'!J2:J37,"정상")'],
              ["=COUNTA('원천자료'!J2:J37)-B4"],
              ["=SUMIF('원천자료'!J2:J37,\"<>정상\",'원천자료'!G2:G37)"],
            ],
          },
        },
        {
          op: 'set_formulas',
          args: {
            sheet: '자동화결과',
            range: 'B10:C13',
            formulas: departments.map((_, index) => {
              const row = index + 10;
              return [
                `=SUMIF('원천자료'!$C$2:$C$37,A${row},'원천자료'!$G$2:$G$37)`,
                `=COUNTIFS('원천자료'!$C$2:$C$37,A${row},'원천자료'!$J$2:$J$37,"<>정상")`,
              ];
            }),
          },
        },
      ],
    },
  ];
}

function replayArguments(paths, operationsPath = paths.operationsPath) {
  return [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-AllowedRoot',
    paths.outputRoot,
    '-BaseWorkbook',
    paths.baseWorkbookPath,
    '-OperationsPath',
    operationsPath,
    '-OraclePath',
    paths.oraclePath,
    '-OutputWorkbook',
    paths.outputWorkbook,
    '-VerificationPath',
    paths.verificationPath,
  ];
}

function parseResult(stdout) {
  const line = stdout
    .trim()
    .split(/\r?\n/)
    .findLast((candidate) => candidate.startsWith('{'));
  return JSON.parse(line);
}

const windowsDescribe = process.platform === 'win32' ? describe : describe.skip;
let excelComAvailable = false;
if (process.platform === 'win32') {
  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "if ([type]::GetTypeFromProgID('Excel.Application')) { exit 0 } else { exit 1 }",
    ]);
    excelComAvailable = true;
  } catch {
    excelComAvailable = false;
  }
}
const excelIt = excelComAvailable ? it : it.skip;

windowsDescribe('Excel demo operation replay', () => {
  let scratchDirectory;
  let paths;

  beforeEach(async () => {
    scratchDirectory = await mkdtemp(
      path.join(tmpdir(), 'moli-excel-demo-replay-'),
    );
    const inputRoot = path.join(scratchDirectory, 'inputs');
    const outputRoot = path.join(scratchDirectory, 'outputs');
    await Promise.all([
      mkdir(inputRoot, { recursive: true }),
      mkdir(outputRoot, { recursive: true }),
    ]);
    paths = {
      outputRoot,
      baseWorkbookPath: path.join(inputRoot, 'base.xlsx'),
      operationsPath: path.join(inputRoot, 'excel-operations.json'),
      oraclePath: path.join(inputRoot, 'oracle.json'),
      outputWorkbook: path.join(outputRoot, 'excel-demo-final.xlsx'),
      verificationPath: path.join(outputRoot, 'office-com-verification.json'),
    };
    await Promise.all([
      copyFile(fixtureWorkbookPath, paths.baseWorkbookPath),
      writeFile(
        paths.operationsPath,
        `${JSON.stringify(buildOperations(), null, 2)}\n`,
        'utf8',
      ),
      writeFile(
        paths.oraclePath,
        `${JSON.stringify(buildExpenseDemoData().oracle, null, 2)}\n`,
        'utf8',
      ),
    ]);
  });

  afterEach(async () => {
    if (scratchDirectory) {
      await rm(scratchDirectory, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 250,
      });
    }
  });

  it('rejects an unsupported operation before Excel opens the workbook', async () => {
    const source = await readFile(scriptPath, 'utf8');
    expect(source).toContain('switch ([string]$operation.op)');
    expect(source).not.toMatch(/Invoke-Expression|\biex\b/i);

    const invalidOperationsPath = path.join(
      path.dirname(paths.operationsPath),
      'unsupported-operations.json',
    );
    await Promise.all([
      writeFile(paths.baseWorkbookPath, 'not an Excel workbook', 'utf8'),
      writeFile(
        invalidOperationsPath,
        `${JSON.stringify([
          {
            runIndex: 1,
            kind: 'invalid-test',
            operations: [{ op: 'launch_macro', args: {} }],
          },
        ])}\n`,
        'utf8',
      ),
    ]);

    await expect(
      execFileAsync(
        'powershell.exe',
        replayArguments(paths, invalidOperationsPath),
        { windowsHide: true },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('UNSUPPORTED_OPERATION:launch_macro'),
    });
    await expect(access(paths.outputWorkbook)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects separator-prefix escapes and unsafe broad allowed roots', async () => {
    const siblingRoot = `${paths.outputRoot}-sibling`;
    await mkdir(siblingRoot);
    const escapedPaths = {
      ...paths,
      outputWorkbook: path.join(siblingRoot, 'excel-demo-final.xlsx'),
    };

    await expect(
      execFileAsync(
        'powershell.exe',
        [...replayArguments(escapedPaths), '-ValidationOnly'],
        { windowsHide: true },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('OUTPUT_OUTSIDE_ALLOWED_ROOT'),
    });

    await expect(
      execFileAsync(
        'powershell.exe',
        [
          ...replayArguments({
            ...paths,
            outputRoot: path.parse(paths.outputRoot).root,
          }),
          '-ValidationOnly',
        ],
        { windowsHide: true },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('UNSAFE_ALLOWED_ROOT'),
    });

    await expect(
      execFileAsync(
        'powershell.exe',
        [
          ...replayArguments({ ...paths, outputRoot: homedir() }),
          '-ValidationOnly',
        ],
        { windowsHide: true },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('UNSAFE_ALLOWED_ROOT'),
    });
  });

  it('rejects reparse-point escapes and output path collisions', async () => {
    const outsideRoot = path.join(scratchDirectory, 'outside');
    const junctionPath = path.join(paths.outputRoot, 'junction');
    await mkdir(outsideRoot);
    await symlink(outsideRoot, junctionPath, 'junction');

    await expect(
      execFileAsync(
        'powershell.exe',
        [
          ...replayArguments({
            ...paths,
            outputWorkbook: path.join(junctionPath, 'excel-demo-final.xlsx'),
          }),
          '-ValidationOnly',
        ],
        { windowsHide: true },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('OUTPUT_REPARSE_POINT'),
    });

    for (const [overrides, errorCode] of [
      [
        { outputWorkbook: path.join(paths.outputRoot, 'final.xls') },
        'OUTPUT_WORKBOOK_MUST_BE_XLSX',
      ],
      [{ verificationPath: paths.outputWorkbook }, 'OUTPUT_PATH_COLLISION'],
      [
        {
          baseWorkbookPath: path.join(paths.outputRoot, 'input.xlsx'),
          outputWorkbook: path.join(paths.outputRoot, 'input.xlsx'),
        },
        'INPUT_OUTPUT_PATH_COLLISION',
      ],
    ]) {
      if (overrides.baseWorkbookPath) {
        await copyFile(paths.baseWorkbookPath, overrides.baseWorkbookPath);
      }
      await expect(
        execFileAsync(
          'powershell.exe',
          [...replayArguments({ ...paths, ...overrides }), '-ValidationOnly'],
          { windowsHide: true },
        ),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining(errorCode),
      });
    }
  });

  it('requires the grouped run array operation-log shape', async () => {
    await writeFile(
      paths.operationsPath,
      `${JSON.stringify(buildOperations()[0], null, 2)}\n`,
      'utf8',
    );

    await expect(
      execFileAsync(
        'powershell.exe',
        [...replayArguments(paths), '-ValidationOnly'],
        { windowsHide: true },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'INVALID_OPERATION_LOG:top_level_array_required',
      ),
    });
  });

  excelIt(
    'recalculates, saves, and reopens the populated workbook through Excel COM',
    async () => {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        replayArguments(paths),
        {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 120_000,
          windowsHide: true,
        },
      );
      const result = parseResult(stdout);
      const savedVerification = JSON.parse(
        await readFile(paths.verificationPath, 'utf8'),
      );

      expect(result).toMatchObject({
        ok: true,
        outputWorkbook: paths.outputWorkbook,
        verificationPath: paths.verificationPath,
        verification: {
          reopened: true,
          rows: 36,
          exceptionCount: 8,
          chartCount: 1,
          formulaErrors: 0,
        },
      });
      expect(savedVerification).toEqual(result.verification);
      expect(savedVerification).toMatchObject({
        application: 'Microsoft Excel COM',
        chartSourceNonblank: true,
        resultFormulaCount: 36,
        summaryFormulaCount: 12,
      });
      await expect(access(paths.outputWorkbook)).resolves.toBeUndefined();
    },
    120_000,
  );
});
