import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as report from '../src/sidecar/report-generator.js';

const { isReportCommand, parseMeetingMarkdown } = report;

describe('deterministic PowerPoint report generator', () => {
  it('parses the fixed report schema from meeting Markdown', () => {
    const spec = parseMeetingMarkdown(`# 2026년 7월 19일 회의록
- 회의일: 2026-07-19
## 회의 목적
제출 속도를 높인다.
## 주요 논의
1. 공통 구조를 쓴다.
## 결정 사항
- A4 PPTX로 제출한다.
## 실행 과제
| 실행 과제 | 담당자 | 완료 예정일 |
| --- | --- | --- |
| 시안 검토 | 이가람 | 2026-07-23 |
## 위험 및 대응
- 위험: 누락
  - 대응: 검증
## 다음 회의
- 일시: 2026-07-24`);
    expect(spec.date).toBe('2026-07-19');
    expect(spec.decisions).toEqual(['A4 PPTX로 제출한다.']);
    expect(spec.actions).toEqual([
      { task: '시안 검토', owner: '이가람', due: '2026-07-23' },
    ]);
    expect(spec.risks).toEqual(['위험: 누락', '대응: 검증']);
    expect(spec.nextMeeting).toEqual(['일시: 2026-07-24']);
  });

  it('recognizes only the explicit report command', () => {
    expect(isReportCommand('/report @minutes.md')).toBe(true);
    expect(isReportCommand('report this')).toBe(false);
  });

  it('rejects report output directories outside the configured work root', () => {
    expect(report.assertReportOutputDir).toBeTypeOf('function');
    expect(() =>
      report.assertReportOutputDir('C:\\safe\\reports', 'C:\\safe'),
    ).not.toThrow();
    expect(() =>
      report.assertReportOutputDir('C:\\escape', 'C:\\safe'),
    ).toThrow(/outside/i);
  });

  it('fails explicitly when the required font is not registered', async () => {
    const source = await readFile('src/sidecar/report-generator.ps1', 'utf8');
    expect(source).toContain('FONT_NOT_FOUND');
    expect(source).toContain('CurrentUser');
    expect(source).toContain('LocalMachine');
  });
});
