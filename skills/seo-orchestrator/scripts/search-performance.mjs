const HEADER_NAMES = new Map(Object.entries({
  page: ["page", "pages", "top pages", "페이지", "인기 페이지", "상위 페이지"],
  query: ["query", "queries", "top queries", "검색어", "인기 검색어", "상위 검색어"],
  date: ["date", "dates", "날짜"],
  clicks: ["clicks", "클릭", "클릭수", "클릭 수"],
  impressions: ["impressions", "노출", "노출수", "노출 수"],
}).flatMap(([key, headers]) => headers.map(name => [name, key])));

function* csvRecords(text) {
  let row = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let recordNumber = 1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closedQuote = true;
      }
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.length > 1 || field.trim()) yield { fields: row, recordNumber };
      row = [];
      field = "";
      closedQuote = false;
      recordNumber++;
    } else if (char === '"' && field === "" && !closedQuote) {
      quoted = true;
    } else {
      if (closedQuote || char === '"') throw new Error(`CSV ${recordNumber}번째 레코드의 따옴표 형식이 잘못되었습니다.`);
      field += char;
    }
  }
  if (quoted) throw new Error(`CSV ${recordNumber}번째 레코드에 닫히지 않은 따옴표가 있습니다.`);
  if (row.length || field.trim()) yield { fields: [...row, field], recordNumber };
}

function columnIndexes(fields) {
  const indexes = new Map();
  for (const [index, field] of fields.entries()) {
    const key = HEADER_NAMES.get(field.trim().toLowerCase().replace(/\s+/g, " "));
    if (!key) continue;
    if (indexes.has(key)) throw new Error(`CSV에 ${key} 열이 중복됩니다.`);
    indexes.set(key, index);
  }
  const dimensions = ["page", "query", "date"].filter(key => indexes.has(key));
  if (dimensions.length !== 1 || !indexes.has("clicks") || !indexes.has("impressions")) {
    throw new Error("CSV에 페이지·검색어·날짜 중 한 차원과 클릭수·노출수 열이 각각 하나씩 필요합니다.");
  }
  const [dimension] = dimensions;
  return { dimension, label: indexes.get(dimension), clicks: indexes.get("clicks"), impressions: indexes.get("impressions") };
}

function count(field, name, row) {
  const text = field.trim();
  if (!/^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)$/.test(text)) {
    throw new Error(`CSV ${row}번째 레코드의 ${name}에 0 이상의 정수를 입력하세요.`);
  }
  const value = Number(text.replaceAll(",", ""));
  if (!Number.isSafeInteger(value)) throw new Error(`CSV ${row}번째 레코드의 ${name}가 안전한 정수 범위를 넘습니다.`);
  return value;
}

// 합계와 CTR은 가져온 표 안의 행만 대상으로 계산한다.
export function parseSearchPerformance(csv) {
  if (typeof csv !== "string") throw new Error("Search Console CSV 문자열이 필요합니다.");
  const records = csvRecords(csv.replace(/^\uFEFF/, ""));
  const header = records.next().value;
  if (!header) throw new Error("CSV 헤더가 비어 있습니다.");
  const indexes = columnIndexes(header.fields);
  const rows = [];
  const labels = new Set();
  let clicks = 0;
  let impressions = 0;
  for (const { fields, recordNumber } of records) {
    if (fields.length !== header.fields.length) throw new Error(`CSV ${recordNumber}번째 레코드의 열 수가 헤더와 다릅니다.`);
    const label = fields[indexes.label].trim();
    if (!label) throw new Error(`CSV ${recordNumber}번째 레코드의 ${indexes.dimension} 값이 비었습니다.`);
    if (labels.has(label)) throw new Error(`CSV ${recordNumber}번째 레코드의 ${indexes.dimension} 값이 중복됩니다.`);
    labels.add(label);
    const rowClicks = count(fields[indexes.clicks], "클릭수", recordNumber);
    const rowImpressions = count(fields[indexes.impressions], "노출수", recordNumber);
    clicks += rowClicks;
    impressions += rowImpressions;
    if (!Number.isSafeInteger(clicks) || !Number.isSafeInteger(impressions)) throw new Error("CSV 합계가 안전한 정수 범위를 넘습니다.");
    rows.push({ label, clicks: rowClicks, impressions: rowImpressions });
  }
  rows.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  return { dimension: indexes.dimension, rowCount: rows.length, clicks, impressions, ctr: impressions ? clicks / impressions : null, rows };
}
