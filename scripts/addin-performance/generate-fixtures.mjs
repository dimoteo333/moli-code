/**
 * Writes stable benchmark inputs for the Excel and PowerPoint Add-ins.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ARTIFACT_ROOT,
  generateReceipts,
  writeJsonWithHash,
  writeTextWithHash,
} from './lib.mjs';

const MEETING_MARKDOWN = `# 2026년 7월 19일 디지털 운영 개선 회의록

- 회의일: 2026-07-19
- 회의시간: 14:00~15:20
- 장소: 본점 12층 프로젝트룸
- 참석자: 김신한 책임자, 이가람 팀장, 박나래 과장, 최도윤 대리
- 작성자: 최도윤 대리

## 회의 목적

7월 수납 업무의 수기 집계 시간을 줄이고, 책임자 보고 자료의 정확도와 제출 속도를 높이기 위한 실행 방안을 확정한다.

## 주요 논의

1. 일별 수납 자료는 공통 열 구조로 관리하고, 주별 및 월별 합계는 동일한 원천 자료에서 계산한다.
2. 오류가 잦은 수기 복사 절차를 줄이기 위해 검증 규칙과 재처리 담당자를 명확히 지정한다.
3. 책임자 제출 보고서는 A4 세로형으로 통일하고 결정 사항, 실행 과제, 위험 요소를 한눈에 확인할 수 있게 구성한다.

## 결정 사항

- 2026년 7월 자료부터 수납 원장의 날짜, 수납처, 세입 구분, 금액, 수납 방법을 표준 열로 관리한다.
- 주별 집계는 월요일부터 일요일까지로 정의하며 월 경계에서는 해당 월의 날짜만 포함한다.
- 책임자 보고서는 원신한 글꼴과 신한 CI 색상을 사용한 A4 세로형 PPTX로 제출한다.
- 자동 생성 결과는 담당자가 원천 합계와 대조한 뒤 책임자에게 제출한다.

## 실행 과제

| 실행 과제 | 담당자 | 완료 예정일 |
| --- | --- | --- |
| 7월 수납 원장 표준 열 적용 | 박나래 과장 | 2026-07-21 |
| 주별·월별 합계 검증표 작성 | 최도윤 대리 | 2026-07-22 |
| 책임자 보고서 시안 검토 | 이가람 팀장 | 2026-07-23 |
| 최종 운영 승인 | 김신한 책임자 | 2026-07-24 |

## 위험 및 대응

- 위험: 원천 자료의 세입 구분 누락으로 합계가 달라질 수 있음
  - 대응: 빈 값과 비정상 금액을 저장 전에 검사하고 오류 목록을 별도로 남긴다.
- 위험: 소형 언어 모델이 보고서 구조를 누락할 수 있음
  - 대응: 고정 스키마 검증과 Markdown 결정론적 폴백을 사용한다.
- 위험: PowerPoint 파일 잠금으로 저장이 실패할 수 있음
  - 대응: 고유한 임시 파일에 저장하고 재열기 검증 후 최종 파일로 승격한다.

## 다음 회의

- 일시: 2026-07-24 10:00
- 안건: 시범 운영 결과와 책임자 보고서 최종 승인
`;

const EXCEL_PROMPT = `첨부된 2026-07-receipts.json의 rows 전체를 현재 Excel 통합 문서에 입력해 주세요.
1. '수납원장' 시트에 receiptId, date, payer, category, amount, method, note 열을 만듭니다.
2. '주별집계' 시트에 JSON의 weeks와 정확히 일치하는 주차, 시작일, 종료일, 세입금액을 만듭니다.
3. '월별집계' 시트에 2026-07 월 세입금액을 만듭니다.
4. 금액은 정수 및 천 단위 구분 형식으로 표시합니다.
5. 마지막에 주별 합계와 월 합계가 18,417,000원으로 일치하는지 검증합니다.
`;

const POWERPOINT_PROMPT = `/report @2026-07-19-meeting-minutes.md

첨부 회의록을 기반으로 책임자 제출용 A4 세로형 PPTX 보고서를 생성해 주세요. 모든 보고서 텍스트에는 설치된 원신한 글꼴을 사용하고, 결과는 PPTX만 저장해 주세요.
`;

export async function generateFixtureFiles(root = path.join(ARTIFACT_ROOT, 'fixtures')) {
  const receipts = generateReceipts(20260719);
  const files = [
    'excel/2026-07-receipts.json',
    'excel/prompt.txt',
    'powerpoint/2026-07-19-meeting-minutes.md',
    'powerpoint/prompt.txt',
  ];

  await writeJsonWithHash(path.join(root, files[0]), receipts);
  await writeTextWithHash(path.join(root, files[1]), EXCEL_PROMPT);
  await writeTextWithHash(path.join(root, files[2]), MEETING_MARKDOWN);
  await writeTextWithHash(path.join(root, files[3]), POWERPOINT_PROMPT);

  return { receipts, files };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  const result = await generateFixtureFiles(root);
  process.stdout.write(
    `${JSON.stringify({ root: root ?? path.join(ARTIFACT_ROOT, 'fixtures'), files: result.files }, null, 2)}\n`,
  );
}

export { MEETING_MARKDOWN };
