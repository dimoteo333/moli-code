import { describe, expect, it } from 'vitest';
import { buildExpenseDemoData } from '../addin-performance/excel-demo-data.mjs';

describe('buildExpenseDemoData', () => {
  it('creates 36 realistic rows with exactly eight auditable exceptions', () => {
    const demo = buildExpenseDemoData();

    expect(demo.headers).toEqual([
      '거래일',
      '카드번호',
      '부서',
      '사용자',
      '가맹점',
      '비용구분',
      '금액',
      '영수증',
      '승인한도',
      '검증결과',
    ]);
    expect(demo.rows).toHaveLength(36);
    expect(demo.oracle.normalCount).toBe(28);
    expect(demo.oracle.exceptionCount).toBe(8);
    expect(Object.keys(demo.oracle.byDepartment)).toEqual([
      '프로덕트운영팀',
      '영업기획부',
      '고객지원팀',
      '경영지원팀',
    ]);
    expect(
      Object.values(demo.oracle.byDepartment).reduce(
        (sum, item) => sum + item.amount,
        0,
      ),
    ).toBe(demo.oracle.totalAmount);
  });
});
