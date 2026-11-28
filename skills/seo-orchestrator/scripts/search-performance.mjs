import { t, currentLocale } from "./locale.mjs";
const HEADER_NAMES = new Map(Object.entries({
  page: ["page", "pages", "top pages", "페이지", "인기 페이지", "상위 페이지", "ページ", "上位のページ", "上位ページ", "seiten", "top-seiten", "beliebteste seiten", "häufigste seiten", "die häufigsten seiten", "pages les plus populaires", "meilleures pages", "página", "páginas", "páginas principales", "páginas con mejor rendimiento"],
  query: ["query", "queries", "top queries", "검색어", "인기 검색어", "상위 검색어", "クエリ", "上位のクエリ", "上位クエリ", "検索キーワード", "suchanfragen", "top-suchanfragen", "beliebteste suchanfragen", "häufigste suchanfragen", "die häufigsten suchanfragen", "requêtes", "requêtes les plus fréquentes", "meilleures requêtes", "consulta", "consultas", "consultas principales", "consultas con mejor rendimiento"],
  date: ["date", "dates", "날짜", "日付", "datum", "fecha", "fechas"],
  clicks: ["clicks", "클릭", "클릭수", "클릭 수", "クリック数", "クリック", "klicks", "clics", "clics totaux"],
  impressions: ["impressions", "노출", "노출수", "노출 수", "表示回数", "インプレッション", "インプレッション数", "impressionen", "impresiones"],
}).flatMap(([key, headers]) => headers.map(name => [name, key])));

function* csvRecords(text, delimiter) {
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
    if (char === delimiter) {
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
      if (closedQuote || char === '"') throw new Error((currentLocale() === "en" ? `Invalid quoting in CSV record ${recordNumber}.` : `CSV ${recordNumber}번째 레코드의 따옴표 형식이 잘못되었습니다.`));
      field += char;
    }
  }
  if (quoted) throw new Error((currentLocale() === "en" ? `Unclosed quote in CSV record ${recordNumber}.` : `CSV ${recordNumber}번째 레코드에 닫히지 않은 따옴표가 있습니다.`));
  if (row.length || field.trim()) yield { fields: [...row, field], recordNumber };
}

function columnIndexes(fields) {
  const indexes = new Map();
  for (const [index, field] of fields.entries()) {
    const key = HEADER_NAMES.get(field.trim().normalize("NFC").toLowerCase().replace(/\s+/g, " "));
    if (!key) continue;
    if (indexes.has(key)) throw new Error((currentLocale() === "en" ? `Duplicate CSV column: ${key}.` : `CSV에 ${key} 열이 중복됩니다.`));
    indexes.set(key, index);
  }
  const dimensions = ["page", "query", "date"].filter(key => indexes.has(key));
  if (dimensions.length !== 1 || !indexes.has("clicks") || !indexes.has("impressions")) {
    throw new Error(t("CSV에 페이지·검색어·날짜 중 한 차원과 클릭수·노출수 열이 각각 하나씩 필요합니다.", "CSV requires one dimension (page, query or date) and one column each for clicks and impressions."));
  }
  const [dimension] = dimensions;
  return { dimension, label: indexes.get(dimension), clicks: indexes.get("clicks"), impressions: indexes.get("impressions") };
}

function openTable(text) {
  const candidates = [];
  let error;
  let widestHeader = 0;
  for (const delimiter of [",", ";"]) {
    const records = csvRecords(text, delimiter);
    let header;
    try {
      header = records.next().value;
      if (!header) throw new Error(t("CSV 헤더가 비어 있습니다.", "The CSV header is empty."));
      candidates.push({ records, header, indexes: columnIndexes(header.fields) });
    } catch (failure) {
      const width = header?.fields.length ?? 0;
      if (!error || width > widestHeader) {
        error = failure;
        widestHeader = width;
      }
    }
  }
  if (!candidates.length) throw error;
  if (candidates.length > 1) {
    throw new Error(t("CSV 헤더의 구분자를 하나로 통일하세요.", "Use one delimiter throughout the CSV header."));
  }
  return candidates[0];
}

function count(field, name, row) {
  const text = field.trim();
  if (!/^(?:\d+|[1-9]\d{0,2}([,. \u00A0\u202F])\d{3}(?:\1\d{3})*)$/.test(text)) {
    throw new Error((currentLocale() === "en" ? `CSV record ${row}, ${name}: enter a nonnegative integer.` : `CSV ${row}번째 레코드의 ${name}에 0 이상의 정수를 입력하세요.`));
  }
  const value = Number(text.replace(/[,. \u00A0\u202F]/g, ""));
  if (!Number.isSafeInteger(value)) throw new Error((currentLocale() === "en" ? `CSV record ${row}, ${name}: value exceeds the safe integer range.` : `CSV ${row}번째 레코드의 ${name}가 안전한 정수 범위를 넘습니다.`));
  return value;
}

// 합계와 CTR은 가져온 표 안의 행만 대상으로 계산한다.
export function parseSearchPerformance(csv) {
  if (typeof csv !== "string") throw new Error(t("Search Console CSV 문자열이 필요합니다.", "Provide Search Console CSV text."));
  const { records, header, indexes } = openTable(csv.replace(/^\uFEFF/, ""));
  const rows = [];
  const labels = new Set();
  let clicks = 0;
  let impressions = 0;
  for (const { fields, recordNumber } of records) {
    if (fields.length !== header.fields.length) throw new Error((currentLocale() === "en" ? `CSV record ${recordNumber} has a different number of fields from the header.` : `CSV ${recordNumber}번째 레코드의 열 수가 헤더와 다릅니다.`));
    const label = fields[indexes.label].trim();
    if (!label) throw new Error((currentLocale() === "en" ? `CSV record ${recordNumber} has an empty ${indexes.dimension} value.` : `CSV ${recordNumber}번째 레코드의 ${indexes.dimension} 값이 비었습니다.`));
    if (labels.has(label)) throw new Error((currentLocale() === "en" ? `CSV record ${recordNumber} has a duplicate ${indexes.dimension} value.` : `CSV ${recordNumber}번째 레코드의 ${indexes.dimension} 값이 중복됩니다.`));
    labels.add(label);
    const rowClicks = count(fields[indexes.clicks], t("클릭수", "Clicks"), recordNumber);
    const rowImpressions = count(fields[indexes.impressions], t("노출수", "Impressions"), recordNumber);
    clicks += rowClicks;
    impressions += rowImpressions;
    if (!Number.isSafeInteger(clicks) || !Number.isSafeInteger(impressions)) throw new Error(t("CSV 합계가 안전한 정수 범위를 넘습니다.", "CSV totals exceed the safe integer range."));
    rows.push({ label, clicks: rowClicks, impressions: rowImpressions });
  }
  rows.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  return { dimension: indexes.dimension, rowCount: rows.length, clicks, impressions, ctr: impressions ? clicks / impressions : null, rows };
}
