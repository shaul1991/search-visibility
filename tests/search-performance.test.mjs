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
