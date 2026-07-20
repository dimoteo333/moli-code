const MISSING_RECEIPT_INDEXES = new Set([4, 17, 29]);
const OVER_LIMIT_INDEXES = new Set([8, 22, 34]);
const DUPLICATE_PAIRS = [
  [11, 12],
  [25, 26],
];

const HEADERS = [
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
];

const DEPARTMENTS = ['프로덕트운영팀', '영업기획부', '고객지원팀', '경영지원팀'];

const ROW_DETAILS = [
  ['김민지', '스타벅스 강남점', '식대', 9800],
  ['김민지', '카카오T', '교통비', 15400],
  ['박준호', '쿠팡', '사무용품', 42800],
  ['박준호', 'GS25 역삼점', '식대', 6300],
  ['이서연', '교보문고', '도서구입', 27500],
  ['이서연', '오늘의집', '사무용품', 73400],
  ['김민지', '메가커피 선릉점', '식대', 5200],
  ['박준호', '서울교통공사', '교통비', 1400],
  ['이서연', '삼성스토어', '소모품', 128000],
  ['최도윤', '이마트24 본사점', '식대', 8100],
  ['최도윤', 'KTX', '교통비', 59800],
  ['한지우', '호텔신라', '숙박비', 187000],
  ['한지우', '호텔신라', '숙박비', 187000],
  ['최도윤', '빽다방 을지로점', '식대', 4700],
  ['한지우', '롯데렌터카', '교통비', 86000],
  ['정하늘', '네이버 예약', '회의비', 64000],
  ['정하늘', '배달의민족', '식대', 23800],
  ['오세진', '다이소 시청점', '사무용품', 19400],
  ['오세진', '롯데시네마', '문화비', 15000],
  ['정하늘', '투썸플레이스 종로점', '식대', 7600],
  ['오세진', 'SK에너지', '교통비', 68000],
  ['윤서진', '알라딘 중고서점', '도서구입', 31200],
  ['윤서진', '롯데호텔', '숙박비', 265000],
  ['문채원', '우체국', '배송비', 5300],
  ['문채원', '스타벅스 홍대점', '식대', 11800],
  ['윤서진', '서울택시', '교통비', 12700],
  ['윤서진', '서울택시', '교통비', 12700],
  ['문채원', '쿠팡', '사무용품', 48200],
  ['장현우', '오피스디포', '사무용품', 93500],
  ['장현우', '세븐일레븐 여의도점', '식대', 6900],
  ['서유진', '대한항공', '교통비', 214000],
  ['서유진', '파리바게뜨', '회의비', 34600],
  ['장현우', '네이버 클라우드', '소프트웨어', 99000],
  ['서유진', '한국도로공사', '교통비', 18700],
  ['장현우', '애플스토어', '소모품', 245000],
  ['서유진', 'GS칼텍스', '교통비', 72100],
];

function buildFixedRows() {
  return ROW_DETAILS.map(([user, merchant, category, amount], index) => {
    const pair = DUPLICATE_PAIRS.find(([first, second]) => index === second);
    const duplicateOf = pair?.[0];
    const original = duplicateOf === undefined ? null : ROW_DETAILS[duplicateOf];
    const day = duplicateOf === undefined ? (index % 18) + 1 : (duplicateOf % 18) + 1;

    return {
      date: `2026-07-${String(day).padStart(2, '0')}`,
      card: `1234-56**-**${String(1000 + (index % 9)).slice(-4)}`,
      department: DEPARTMENTS[Math.floor(index / 9)],
      user: original?.[0] ?? user,
      merchant: original?.[1] ?? merchant,
      category: original?.[2] ?? category,
      amount: original?.[3] ?? amount,
      receipt: MISSING_RECEIPT_INDEXES.has(index) ? '미제출' : '제출',
      limit: OVER_LIMIT_INDEXES.has(index) ? 100000 : 300000,
    };
  });
}

export function classifyExpense(row, allRows, index) {
  if (row.receipt === '미제출') return '영수증 누락';
  if (row.amount > row.limit) return '한도 초과';
  const signature = [row.date, row.user, row.merchant, row.amount].join('|');
  const duplicateSeenEarlier = allRows
    .slice(0, index)
    .some(
      (candidate) =>
        [candidate.date, candidate.user, candidate.merchant, candidate.amount].join('|') ===
        signature,
    );
  return duplicateSeenEarlier ? '중복 지출' : '정상';
}

function buildOracle(rows) {
  const byDepartment = Object.fromEntries(
    DEPARTMENTS.map((department) => [
      department,
      { amount: 0, normalCount: 0, exceptionCount: 0, exceptionAmount: 0 },
    ]),
  );
  let totalAmount = 0;
  let normalCount = 0;
  let exceptionCount = 0;
  let exceptionAmount = 0;

  for (const row of rows) {
    const department = byDepartment[row.department];
    totalAmount += row.amount;
    department.amount += row.amount;
    if (row.result === '정상') {
      normalCount += 1;
      department.normalCount += 1;
    } else {
      exceptionCount += 1;
      exceptionAmount += row.amount;
      department.exceptionCount += 1;
      department.exceptionAmount += row.amount;
    }
  }

  return { totalAmount, normalCount, exceptionCount, exceptionAmount, byDepartment };
}

export function buildExpenseDemoData() {
  const sourceRows = buildFixedRows();
  const classified = sourceRows.map((row, index) => ({
    ...row,
    result: classifyExpense(row, sourceRows, index),
  }));

  return {
    headers: HEADERS,
    rows: classified.map((row) => [
      row.date,
      row.card,
      row.department,
      row.user,
      row.merchant,
      row.category,
      row.amount,
      row.receipt,
      row.limit,
      '',
    ]),
    oracle: buildOracle(classified),
  };
}
