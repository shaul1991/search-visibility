import test from "node:test";
import assert from "node:assert/strict";
import { parseSearchPerformance } from "../skills/seo-orchestrator/scripts/search-performance.mjs";

test("reads Korean and English CSV, sums the imported rows and ranks them by clicks then impressions", () => {
  const data = '\uFEFFCTR,인기 페이지,노출수,클릭수\r\n1%,https://example.org/a,100,1\r\n\r\n' +
    '2%,https://example.org/b,"1,000",5\r\n0.5%,https://example.org/c,300,5\r\n';
  const table = parseSearchPerformance(data);
  assert.deepEqual(table, {
    dimension: "page", rowCount: 3, clicks: 11, impressions: 1400, ctr: 11 / 1400,
    rows: [
      { label: "https://example.org/b", clicks: 5, impressions: 1000 },
      { label: "https://example.org/c", clicks: 5, impressions: 300 },
      { label: "https://example.org/a", clicks: 1, impressions: 100 },
    ],
  });
  assert.equal(parseSearchPerformance(" Top Pages ,Clicks,Impressions\na,5,10").ctr, 0.5);
});

test("keeps commas, literal quotes and line breaks inside quoted query labels", () => {
  const query = parseSearchPerformance('Top queries,Clicks,Impressions,Position\n"what, ""when""\nand where?",0,100,1.5');
  assert.deepEqual(query.rows, [{ label: 'what, "when"\nand where?', clicks: 0, impressions: 100 }]);
  assert.equal(query.ctr, 0);
  for (const header of ["상위 검색어", "인기 검색어", "검색어"]) {
    assert.equal(parseSearchPerformance(`${header},클릭 수,노출 수\n무료 검색,1,20`).dimension, "query");
  }
});

test("accepts date tables and represents zero impressions or header-only exports with null CTR", () => {
  for (const header of ["Date", "날짜"]) {
    const table = parseSearchPerformance(`${header},Clicks,Impressions\n2026-01-01,0,0`);
    assert.equal(table.dimension, "date");
    assert.equal(table.ctr, null);
  }
  assert.deepEqual(parseSearchPerformance("Date,Clicks,Impressions\n"), {
    dimension: "date", rowCount: 0, clicks: 0, impressions: 0, ctr: null, rows: [],
  });
});

test("rejects incomplete, mixed-dimension, duplicate and malformed records without turning them into zeros", () => {
  for (const input of [null, "", "\r\n", "Country,Clicks,Impressions", "Date,Clicks", "Pages,Date,Clicks,Impressions",
    "Top queries,Clicks,클릭수,Impressions"]) assert.throws(() => parseSearchPerformance(input), /CSV/);
  const badRows = [
    "a,1", "a,1,200,000", "a,,50", ",,", "a,3,n/a", "a,1.5,100", "a,-1,100", 'a,"2,00",100',
    'a,"1,000"000,200', '"not closed,1,2', 'bad"quote,2,3', "a,1,2\na,3,4",
    "a,9007199254740992,0", "a,9007199254740991,0\nb,1,0",
  ];
  for (const row of badRows) assert.throws(() => parseSearchPerformance("Pages,Clicks,Impressions\n" + row), /CSV/);
});

test("recognizes Japanese, German, French and Spanish dimensions and metrics", () => {
  for (const [headers, clicks, impressions] of [
    [["上位のページ", "上位のクエリ", "日付"], "クリック数", "表示回数"],
    [["Die häufigsten Seiten", "Häufigste Suchanfragen", "Datum"], "Klicks", "Impressionen"],
    [["Pages les plus populaires", "Requêtes les plus fréquentes", "Date"], "Clics", "Impressions"],
    [["Páginas principales", "Consultas principales", "Fechas"], "Clics", "Impresiones"],
  ]) {
    for (const [index, dimension] of ["page", "query", "date"].entries()) {
      const table = parseSearchPerformance(`${headers[index].normalize("NFD")},${clicks},${impressions}\nラベル,1,20`);
      assert.equal(table.dimension, dimension);
      assert.equal(table.ctr, 0.05);
    }
  }
});

test("imports BOM-prefixed semicolon exports with European grouping and decimal percentages", () => {
  const table = parseSearchPerformance('\uFEFF\r\n"Häufigste Suchanfragen";"Klicks";"Impressionen";CTR;Position\r\n' +
    '"KEDA; CPU, ""RAM""\nSkalierung";1.200;10.000;12,00 %;2,5\r\n' +
    'HPA;1 000;20\u202F000;5,00%;1,4\r\nVPA;100;2\u00A0000;5,00%;3,4');
  assert.deepEqual(table, {
    dimension: "query", rowCount: 3, clicks: 2300, impressions: 32000, ctr: 2300 / 32000,
    rows: [
      { label: 'KEDA; CPU, "RAM"\nSkalierung', clicks: 1200, impressions: 10000 },
      { label: "HPA", clicks: 1000, impressions: 20000 },
      { label: "VPA", clicks: 100, impressions: 2000 },
    ],
  });
  assert.equal(parseSearchPerformance('Pages,Clicks,Impressions,"extra; heading"\na,1,50,NA').impressions, 50);
});

test("rejects invalid grouping, percentages in counts and ambiguous or malformed headers", () => {
  for (const value of ["1.25", "1.000,00", "1.234 567", "1  200", "1,20%", "0.000", "9.007.199.254.740.992"]) {
    assert.throws(() => parseSearchPerformance(`Datum;Klicks;Impressionen\n2026-01-01;${value};100`), /CSV/);
  }
  for (const input of [
    "Date,Clicks,Impressions,x;Date;Clicks;Impressions",
    'Date;"Clicks"unexpected;Impressions',
    "Pages;Clics;Klicks;Impressions",
    "Date;Clicks;Impressions\n2026-01-01,1,20",
  ]) assert.throws(() => parseSearchPerformance(input), /CSV/);
});
