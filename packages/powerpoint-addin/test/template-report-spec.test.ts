import { describe, expect, it } from 'vitest';
import {
  buildTemplateExtractionPrompt,
  fallbackTemplateReport,
  parseTemplateReportOutput,
  type TemplateReportSpec,
} from '../src/sidecar/template-report-spec.js';

function validSpec(
  overrides: Partial<TemplateReportSpec> = {},
): TemplateReportSpec {
  return {
    title: '신규 서비스 준비 회의 결과',
    date: '2026-07-19',
    department: '디지털사업부',
    pages: [
      {
        section1: {
          heading: '회의 개요',
          bullets: ['출시 준비 현황을 점검함'],
        },
        section2: {
          heading: '조치 계획',
          columns: ['담당자', '업무', '기한', '상태'],
          rows: [['김민준', '검수 완료', '2026.07.24', '진행']],
        },
        section3: {
          heading: '승인 요청',
          bullets: ['추가 예산 승인이 필요함'],
        },
      },
    ],
    ...overrides,
  };
}

function proseOfLength(length: number): string {
  const prefix =
    '2026-07-19 디지털사업부 회의에서 김민준 책임자가 준비 현황을 공유했습니다. ';
  const sentence =
    '담당자는 정해진 기한까지 결과를 확인하고 위험 사항을 보고하기로 했습니다. ';
  let prose = prefix;
  while (Array.from(prose).length < length) prose += sentence;
  return Array.from(prose).slice(0, length).join('');
}

function expectBounded(spec: TemplateReportSpec, pages: number): void {
  expect(spec.pages).toHaveLength(pages);
  expect(spec.date).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  for (const page of spec.pages) {
    for (const section of [page.section1, page.section3]) {
      expect(section.bullets.length).toBeGreaterThanOrEqual(1);
      expect(section.bullets.length).toBeLessThanOrEqual(3);
      expect(
        section.bullets.every((bullet) => Array.from(bullet).length <= 90),
      ).toBe(true);
    }
    expect(page.section2.columns).toHaveLength(4);
    expect(page.section2.rows.length).toBeGreaterThanOrEqual(1);
    expect(page.section2.rows.length).toBeLessThanOrEqual(4);
    expect(page.section2.rows.every((row) => row.length === 4)).toBe(true);
  }
}

describe('buildTemplateExtractionPrompt', () => {
  it('requires bounded JSON and includes only the supplied prose, never binary data', () => {
    const minutes = '2026-07-19 전략기획팀 회의 내용입니다.';
    const prompt = buildTemplateExtractionPrompt(minutes);

    expect(prompt).toContain('JSON만 출력');
    expect(prompt).toContain('1~3');
    expect(prompt).toContain('90자 이하');
    expect(prompt).toContain('1~4행');
    expect(prompt).toContain('<meeting_minutes>\n' + minutes);
    expect(prompt).not.toContain('UEsDB');
    expect(prompt).not.toContain('base64');
  });
});

describe('parseTemplateReportOutput', () => {
  it('accepts one optional JSON fence and normalizes the date', () => {
    const parsed = parseTemplateReportOutput(
      '```json\n' + JSON.stringify(validSpec()) + '\n```',
      'unused minutes',
    );
    expect(parsed).toEqual({ ...validSpec(), date: '2026.07.19' });
  });

  it.each([
    ['zero pages', validSpec({ pages: [] })],
    [
      'more than three pages',
      validSpec({ pages: Array(4).fill(validSpec().pages[0]) }),
    ],
    [
      'zero bullets',
      validSpec({
        pages: [
          {
            ...validSpec().pages[0],
            section1: { heading: '개요', bullets: [] },
          },
        ],
      }),
    ],
    [
      'more than three bullets',
      validSpec({
        pages: [
          {
            ...validSpec().pages[0],
            section3: { heading: '요청', bullets: ['1', '2', '3', '4'] },
          },
        ],
      }),
    ],
    [
      'bullet longer than 90 characters',
      validSpec({
        pages: [
          {
            ...validSpec().pages[0],
            section1: { heading: '개요', bullets: ['가'.repeat(91)] },
          },
        ],
      }),
    ],
    [
      'zero table rows',
      validSpec({
        pages: [
          {
            ...validSpec().pages[0],
            section2: { ...validSpec().pages[0].section2, rows: [] },
          },
        ],
      }),
    ],
    [
      'more than four table rows',
      validSpec({
        pages: [
          {
            ...validSpec().pages[0],
            section2: {
              ...validSpec().pages[0].section2,
              rows: Array(5).fill(['담당', '업무', '기한', '상태']),
            },
          },
        ],
      }),
    ],
    [
      'wrong table column count',
      validSpec({
        pages: [
          {
            ...validSpec().pages[0],
            section2: {
              ...validSpec().pages[0].section2,
              columns: ['담당', '업무', '기한'] as unknown as [
                string,
                string,
                string,
                string,
              ],
            },
          },
        ],
      }),
    ],
    ['invalid calendar date', validSpec({ date: '2026-02-30' })],
  ])('uses deterministic fallback for %s', (_label, invalid) => {
    const minutes = proseOfLength(700);
    const parsed = parseTemplateReportOutput(JSON.stringify(invalid), minutes);
    expect(parsed).toEqual(fallbackTemplateReport(minutes));
  });

  it('uses deterministic fallback for invalid JSON', () => {
    const minutes =
      '2026년 7월 19일 전략기획팀에서 승인 요청 사항을 논의했습니다.';
    expect(parseTemplateReportOutput('{broken', minutes)).toEqual(
      fallbackTemplateReport(minutes),
    );
  });
});

describe('fallbackTemplateReport', () => {
  it.each([
    ['short', 900, 1],
    ['medium', 901, 2],
    ['medium upper bound', 1800, 2],
    ['long', 1801, 3],
  ])('creates a bounded %s report', (_label, length, pages) => {
    const spec = fallbackTemplateReport(proseOfLength(length));
    expectBounded(spec, pages);
    expect(spec.date).toBe('2026.07.19');
    expect(spec.department).toBe('디지털사업부');
  });

  it('detects a Korean date and department suffix', () => {
    const spec = fallbackTemplateReport(
      '2026년 7월 9일 전략기획팀 회의에서 운영 방안을 확정했습니다.',
    );
    expect(spec.date).toBe('2026.07.09');
    expect(spec.department).toBe('전략기획팀');
  });
});
