export interface TemplateReportPage {
  section1: { heading: string; bullets: string[] };
  section2: {
    heading: string;
    columns: [string, string, string, string];
    rows: Array<[string, string, string, string]>;
  };
  section3: { heading: string; bullets: string[] };
}

export interface TemplateReportSpec {
  title: string;
  date: string;
  department: string;
  pages: TemplateReportPage[];
}

const MAX_BULLET_CHARS = 90;
const MAX_CELL_CHARS = 90;

export function buildTemplateExtractionPrompt(minutes: string): string {
  return [
    '다음 줄글 회의록을 책임자 제출용 보고서 JSON으로만 변환하세요.',
    '회의록 길이가 900자 이하면 pages 1개, 901~1800자면 2개, 1801자 이상이면 3개로 구성하세요.',
    '최상위 필드는 title, date, department, pages이며 date는 YYYY.MM.DD 형식입니다.',
    '각 페이지의 section1과 section3은 heading과 1~3개 bullets를 가집니다.',
    '각 bullet은 90자 이하이며 section2는 heading, 정확히 4개 columns, 1~4행 rows를 가집니다.',
    '설명, Markdown 코드 펜스, 도구 호출 없이 JSON만 출력하세요.',
    '<meeting_minutes>',
    minutes,
    '</meeting_minutes>',
  ].join('\n');
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function sliceCodePoints(value: string, limit: number): string {
  return Array.from(value).slice(0, limit).join('');
}

function containsDisallowedControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      return true;
    }
  }
  return false;
}

function readString(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    codePointLength(trimmed) > limit ||
    containsDisallowedControl(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value
    .trim()
    .match(
      /^(\d{4})\s*(?:[./-]|년\s*)(\d{1,2})\s*(?:[./-]|월\s*)(\d{1,2})(?:\s*일)?\.?$/,
    );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 9999 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

function readStringArray(
  value: unknown,
  minimum: number,
  maximum: number,
  itemLimit: number,
): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > maximum
  ) {
    return null;
  }
  const strings = value.map((item) => readString(item, itemLimit));
  return strings.every((item): item is string => item !== null)
    ? strings
    : null;
}

function parsePage(value: unknown): TemplateReportPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const page = value as Record<string, unknown>;
  const section1 = page.section1 as Record<string, unknown> | null;
  const section2 = page.section2 as Record<string, unknown> | null;
  const section3 = page.section3 as Record<string, unknown> | null;
  if (
    !section1 ||
    typeof section1 !== 'object' ||
    Array.isArray(section1) ||
    !section2 ||
    typeof section2 !== 'object' ||
    Array.isArray(section2) ||
    !section3 ||
    typeof section3 !== 'object' ||
    Array.isArray(section3)
  ) {
    return null;
  }

  const section1Heading = readString(section1.heading, 60);
  const section1Bullets = readStringArray(
    section1.bullets,
    1,
    3,
    MAX_BULLET_CHARS,
  );
  const section2Heading = readString(section2.heading, 60);
  const columns = readStringArray(section2.columns, 4, 4, 40);
  const section3Heading = readString(section3.heading, 60);
  const section3Bullets = readStringArray(
    section3.bullets,
    1,
    3,
    MAX_BULLET_CHARS,
  );
  if (
    !section1Heading ||
    !section1Bullets ||
    !section2Heading ||
    !columns ||
    !section3Heading ||
    !section3Bullets ||
    !Array.isArray(section2.rows) ||
    section2.rows.length < 1 ||
    section2.rows.length > 4
  ) {
    return null;
  }

  const rows: Array<[string, string, string, string]> = [];
  for (const rawRow of section2.rows) {
    const row = readStringArray(rawRow, 4, 4, MAX_CELL_CHARS);
    if (!row) return null;
    rows.push([row[0], row[1], row[2], row[3]]);
  }

  return {
    section1: { heading: section1Heading, bullets: section1Bullets },
    section2: {
      heading: section2Heading,
      columns: [columns[0], columns[1], columns[2], columns[3]],
      rows,
    },
    section3: { heading: section3Heading, bullets: section3Bullets },
  };
}

function stripOptionalFence(raw: string): string {
  const fence = raw.match(/^\s*```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
  return fence ? fence[1].trim() : raw.trim();
}

function parseValidatedSpec(raw: string): TemplateReportSpec | null {
  let value: unknown;
  try {
    value = JSON.parse(stripOptionalFence(raw));
  } catch (_error) {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const title = readString(source.title, 120);
  const date = normalizeDate(source.date);
  const department = readString(source.department, 60);
  if (
    !title ||
    !date ||
    !department ||
    !Array.isArray(source.pages) ||
    source.pages.length < 1 ||
    source.pages.length > 3
  ) {
    return null;
  }
  const pages = source.pages.map(parsePage);
  if (pages.some((page) => page === null)) return null;
  return { title, date, department, pages: pages as TemplateReportPage[] };
}

function splitLongText(text: string, limit: number): string[] {
  const points = Array.from(text.trim());
  const chunks: string[] = [];
  for (let offset = 0; offset < points.length; offset += limit) {
    const chunk = points
      .slice(offset, offset + limit)
      .join('')
      .trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function sentenceChunks(minutes: string): string[] {
  const sentences =
    minutes
      .replace(/\r\n?/g, '\n')
      .match(/[^.!?。！？\n]+[.!?。！？]?/gu)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];
  const chunks = sentences.flatMap((sentence) =>
    codePointLength(sentence) <= MAX_BULLET_CHARS
      ? [sentence]
      : splitLongText(sentence, MAX_BULLET_CHARS),
  );
  return chunks.length > 0
    ? chunks
    : ['회의록 내용을 확인해 보고서를 보완해야 합니다.'];
}

function selectDistributed<T>(items: T[], maximum: number): T[] {
  if (items.length <= maximum) return items.slice();
  if (maximum === 1) return [items[0]];
  const selected: T[] = [];
  for (let index = 0; index < maximum; index += 1) {
    selected.push(
      items[Math.round((index * (items.length - 1)) / (maximum - 1))],
    );
  }
  return selected;
}

function detectedDate(minutes: string): string {
  const candidate = minutes.match(
    /\d{4}\s*(?:[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}|년\s*\d{1,2}\s*월\s*\d{1,2}\s*일)/,
  )?.[0];
  return normalizeDate(candidate) ?? '1970.01.01';
}

function detectedDepartment(minutes: string): string {
  const match = minutes.match(
    /([가-힣A-Za-z0-9·&]{2,20}(?:사업부|본부|부서|센터|팀|실|부))(?=\s|에서|가|은|는|의|,|\.|$)/,
  );
  return match?.[1] ?? '담당부서';
}

function detectedOwner(text: string): string {
  return (
    text.match(/([가-힣]{2,4})\s*(?:책임자|담당자|팀장|과장|대리|주임)/)?.[1] ??
    '담당자'
  );
}

/** Deterministic, model-free fallback used for invalid or unavailable JSON. */
export function fallbackTemplateReport(minutes: string): TemplateReportSpec {
  const characterCount = codePointLength(minutes);
  const pageCount = characterCount <= 900 ? 1 : characterCount <= 1800 ? 2 : 3;
  const allChunks = sentenceChunks(minutes);
  const chunks = selectDistributed(allChunks, pageCount * 6);
  const department = detectedDepartment(minutes);
  const date = detectedDate(minutes);
  const pages: TemplateReportPage[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const start = Math.floor((pageIndex * chunks.length) / pageCount);
    const end = Math.floor(((pageIndex + 1) * chunks.length) / pageCount);
    const pageChunks = chunks.slice(start, end).slice(0, 6);
    if (pageChunks.length === 0) pageChunks.push(allChunks[0]);
    const section1Bullets = pageChunks.slice(0, 3);
    const section3Bullets = pageChunks.slice(3, 6);
    if (section3Bullets.length === 0) {
      section3Bullets.push(pageChunks[pageChunks.length - 1]);
    }
    const rowSources = pageChunks.slice(0, 4);
    pages.push({
      section1: { heading: '회의 개요 및 주요 내용', bullets: section1Bullets },
      section2: {
        heading: '실행 과제 및 담당',
        columns: ['담당자', '실행 과제', '기한', '상태'],
        rows: rowSources.map((chunk) => [
          detectedOwner(chunk),
          sliceCodePoints(chunk, 90),
          date,
          '확인 필요',
        ]),
      },
      section3: { heading: '위험 및 승인 요청', bullets: section3Bullets },
    });
  }

  return {
    title: `${department} 회의 결과 보고`,
    date,
    department,
    pages,
  };
}

export function parseTemplateReportOutput(
  raw: string,
  minutes: string,
): TemplateReportSpec {
  return parseValidatedSpec(raw) ?? fallbackTemplateReport(minutes);
}
