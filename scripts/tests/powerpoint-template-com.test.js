import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const sourceTemplate = path.resolve(
  repositoryRoot,
  '..',
  '..',
  'template.pptx',
);
const scriptPath = path.join(
  repositoryRoot,
  'packages',
  'powerpoint-addin',
  'src',
  'sidecar',
  'template-report-generator.ps1',
);

function page(index) {
  return {
    section1: {
      heading: `회의 개요 ${index}`,
      bullets: [`${index}페이지 주요 논의 내용입니다.`],
    },
    section2: {
      heading: `실행 과제 ${index}`,
      columns: ['담당자', '실행 과제', '기한', '상태'],
      rows: [
        [`담당${index}`, `시안 검토 ${index}`, '2026.07.23', '진행'],
        [`검토${index}`, `품질 확인 ${index}`, '2026.07.24', '예정'],
      ],
    },
    section3: {
      heading: `리스크 및 승인 요청 ${index}`,
      bullets: [`책임자 승인 요청 ${index}`],
    },
  };
}

function buildSpec(count) {
  return {
    title: '자동화 추진 회의 결과 보고',
    date: '2026.07.19',
    department: '디지털사업부',
    pages: Array.from({ length: count }, (_, index) => page(index + 1)),
  };
}

async function probePowerPoint() {
  if (process.platform !== 'win32') return false;
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "$t=[type]::GetTypeFromProgID('PowerPoint.Application');if($null-eq$t){'ABSENT'}else{'PRESENT'}",
  ]);
  if (stdout.trim() === 'PRESENT') return true;
  if (stdout.trim() === 'ABSENT') return false;
  throw new Error(`POWERPOINT_COM_PROBE_INVALID:${stdout}`);
}

const comAvailable = await probePowerPoint();
const comIt = comAvailable ? it : it.skip;

describe('PowerPoint template COM generator', () => {
  let scratchRoot;
  let templatePath;

  beforeAll(async () => {
    scratchRoot = await mkdtemp(path.join(tmpdir(), 'moli-ppt-template-com-'));
    await mkdir(path.join(scratchRoot, 'templates'));
    await mkdir(path.join(scratchRoot, 'specs'));
    await mkdir(path.join(scratchRoot, 'reports'));
    templatePath = path.join(scratchRoot, 'templates', 'template.pptx');
    await copyFile(sourceTemplate, templatePath);
  });

  afterAll(async () => {
    if (scratchRoot) {
      await rm(scratchRoot, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 250,
      });
    }
  });

  comIt(
    'creates and reopens A4 one-, two-, and three-page reports without overflow',
    async () => {
      const pageCounts = [];
      const missingRequiredText = [];
      let offSlideObjects = 0;
      let overflowShapes = 0;
      let reopened = true;
      let a4 = true;

      const templateHashBefore = createHash('sha256')
        .update(await readFile(templatePath))
        .digest('hex');
      for (const count of [1, 2, 3]) {
        const spec = buildSpec(count);
        const specPath = path.join(scratchRoot, 'specs', `spec-${count}.json`);
        const outputPath = path.join(
          scratchRoot,
          'reports',
          `report-${count}.pptx`,
        );
        await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
        const { stdout } = await execFileAsync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            scriptPath,
            '-AllowedRoot',
            scratchRoot,
            '-TemplatePath',
            templatePath,
            '-SpecPath',
            specPath,
            '-OutputPath',
            outputPath,
          ],
          { windowsHide: true, timeout: 60_000, maxBuffer: 1024 * 1024 },
        );
        const resultLine = stdout
          .trim()
          .split(/\r?\n/)
          .findLast((line) => line.startsWith('{'));
        const verification = JSON.parse(resultLine);
        pageCounts.push(verification.slideCount);
        reopened &&= verification.reopened;
        a4 &&= verification.a4;
        missingRequiredText.push(...verification.missingRequiredText);
        offSlideObjects += verification.offSlideObjects;
        overflowShapes += verification.overflowShapes;
        expect(Buffer.from(await readFile(outputPath)).subarray(0, 4)).toEqual(
          Buffer.from('PK\x03\x04'),
        );
        const artifactDirectory = process.env.MOLI_PPT_COM_ARTIFACT_DIR;
        if (artifactDirectory) {
          await mkdir(artifactDirectory, { recursive: true });
          await copyFile(
            outputPath,
            path.join(artifactDirectory, `task-3-report-${count}-pages.pptx`),
          );
          await writeFile(
            path.join(
              artifactDirectory,
              `task-3-report-${count}-verification.json`,
            ),
            `${JSON.stringify(verification, null, 2)}\n`,
            'utf8',
          );
        }
      }

      expect({
        pageCounts,
        a4,
        reopened,
        missingRequiredText,
        offSlideObjects,
        overflowShapes,
      }).toMatchObject({
        pageCounts: [1, 2, 3],
        a4: true,
        reopened: true,
        missingRequiredText: [],
        offSlideObjects: 0,
        overflowShapes: 0,
      });
      expect(
        createHash('sha256')
          .update(await readFile(templatePath))
          .digest('hex'),
      ).toBe(templateHashBefore);
    },
    180_000,
  );

  comIt(
    'rejects body text that exceeds the template bounds instead of shrinking the font',
    async () => {
      const spec = buildSpec(1);
      spec.pages[0].section1.bullets = Array.from(
        { length: 3 },
        (_, index) => `${index + 1}${'가나다라마바사'.repeat(12)}`,
      );
      const specPath = path.join(scratchRoot, 'specs', 'overflow.json');
      const outputPath = path.join(scratchRoot, 'reports', 'overflow.pptx');
      await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
      await expect(
        execFileAsync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            scriptPath,
            '-AllowedRoot',
            scratchRoot,
            '-TemplatePath',
            templatePath,
            '-SpecPath',
            specPath,
            '-OutputPath',
            outputPath,
          ],
          { windowsHide: true, timeout: 60_000, maxBuffer: 1024 * 1024 },
        ),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining('REPORT_OVERFLOW'),
      });
    },
    60_000,
  );
});
