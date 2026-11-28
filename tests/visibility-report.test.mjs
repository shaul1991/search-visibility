import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { renderReport } from "../skills/seo-orchestrator/scripts/visibility-report.mjs";

function emptyReport() {
  return {
    schemaVersion: 1, generatedAt: "2026-05-01T12:00:00Z", brand: "예시 브랜드",
    site: { pages: [] },
    ai: { sampleSize: 0, mentions: 0, citations: 0, mentionRate: null, citationRate: null, byEngine: [], records: [] },
  };
}

test("empty report is offline HTML, showing unobserved AI metrics separately from site coverage", () => {
  const html = renderReport(emptyReport());
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>예시 브랜드 검색 가시성 보고서/);
  assert.match(html, /대상 0개 · 점검 오류 0개/);
  assert.match(html, /기록한 답변이 없습니다/);
  assert.match(html, /측정 안 됨/);
  assert.doesNotMatch(html, /\b0%|<link\b|<iframe\b|<img\b/i);
});

test("report preserves partial coverage, warnings, failures and action skills", () => {
  const report = emptyReport();
  report.site = {
    pages: [
      { target: "page.html", results: [
        { level: "INFO", channel: "공통", item: "진단 대상", detail: "로컬 문서", skill: "seo-orchestrator" },
        { level: "FAIL", channel: "네이버", item: "사이트 소유 확인", detail: "인증 코드 누락", skill: "naver-search" },
      ] },
      { target: "missing.html", error: "파일을 찾을 수 없음", results: [] },
    ],
    warnings: ["상한은 2개입니다."], truncated: true,
    discoveryErrors: [{ target: "unavailable.xml", error: "HTTP 503" }],
  };
  const html = renderReport(report);
  assert.match(html, /1개<small>대상 2개 · 점검 오류 1개/);
  assert.match(html, /상한은 2개입니다\./);
  assert.match(html, /unavailable\.xml · HTTP 503/);
  assert.match(html, /missing\.html[\s\S]+파일을 찾을 수 없음/);
  assert.match(html, /실패 1건 · 경고 0건/);
  assert.ok(html.indexOf("사이트 소유 확인") < html.indexOf("진단 대상"));
  assert.match(html, /<code>naver-search<\/code>/);
});

test("report shows denominators, missing configuration, and source evidence", () => {
  const report = emptyReport();
  report.ai = {
    sampleSize: 2, mentions: 0, citations: 1, mentionRate: 0, citationRate: 0.5,
    byEngine: [{ engine: "Example", sampleSize: 2, mentions: 0, citations: 1, mentionRate: 0, citationRate: 0.5 }],
    records: [{ engine: "Example", query: "리뷰", observedAt: "2026-05-01", mentioned: false, cited: true,
      matchedSources: ["https://brand.example/one"], sources: ["https://brand.example/one","https://other.example/"] }],
  };
  let html = renderReport(report);
  assert.match(html, /0% \(0\/2\)/);
  assert.match(html, /50% \(1\/2\)/);
  assert.match(html, /href="https:\/\/brand\.example\/one"[^>]*>[^<]+<\/a> · 소유 출처/);
  assert.match(html, /href="https:\/\/other\.example\/"/);
  report.ai.citationRate = null;
  report.ai.byEngine[0].citationRate = null;
  report.ai.records[0].cited = null;
  html = renderReport(report);
  assert.match(html, /인용을 집계할 도메인이나 계정 URL 경로가 지정되지 않았습니다/);
  assert.match(html, /소유 출처 인용 측정 안 됨/);
  assert.doesNotMatch(html, /소유 출처 인용 없음/);
});

test("user-controlled fields stay text and hazardous source protocols never become links", () => {
  const report = emptyReport();
  const payload = '\"><img src=x onerror=alert(1)>';
  report.brand = payload;
  report.generatedAt = payload;
  report.site.pages = [{ target: payload, results: [{ level: payload, item: payload, channel: payload, detail: payload, skill: payload }] }];
  report.ai = {
    sampleSize: 1, mentions: 1, citations: 0, mentionRate: 1, citationRate: 0,
    byEngine: [{ engine: payload, sampleSize: 1, mentions: 1, citations: 0, mentionRate: 1, citationRate: 0 }],
    records: [{ engine: payload, query: payload, observedAt: payload, mentioned: true, cited: false,
      matchedSources: [], sources: ["javascript:alert(1)", "file:///etc/hosts", "https://example.org/a?x=1&y=2"], evidenceUrl: "data:text/html,<script>alert(1)</script>" }],
  };
  const html = renderReport(report);
  assert.doesNotMatch(html, /<img\b|href="(?:javascript|file|data):/i);
  assert.equal([...html.matchAll(/<script\b/g)].length, 1);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /href="https:\/\/example\.org\/a\?x=1&amp;y=2"/);
});

test("Search Console shows CSV totals and the ten most-visible rows; no impressions has no CTR", () => {
  const report = emptyReport();
  assert.match(renderReport(report), /Search Console 실적 CSV를 추가/);
  report.searchPerformance = { dimension: "date", rowCount: 0, rows: [], clicks: 0, impressions: 0, ctr: null };
  assert.match(renderReport(report), /가져온 CSV에 집계할 행이 없습니다/);

  const rows = Array.from({ length: 11 }, (_, index) => ({
    label: index === 10 ? "<strong>최대 노출</strong>" : `query-${index}`,
    clicks: index, impressions: index * 2,
  }));
  report.searchPerformance = { dimension: "query", rowCount: 11, rows, clicks: 55, impressions: 110, ctr: 0.5 };
  let html = renderReport(report);
  assert.match(html, /검색어별 11개 행/);
  assert.match(html, /노출 순 검색어 10개/);
  assert.match(html, /<dt>노출<\/dt><dd>110회/);
  assert.match(html, /<dt>클릭률<\/dt><dd>50%/);
  assert.ok(html.indexOf("&lt;strong&gt;최대 노출") < html.indexOf("query-9"));
  assert.doesNotMatch(html, /query-0|<strong>최대 노출<\/strong>/);
  report.searchPerformance = { dimension: "page", rowCount: 1, rows: [{ label: "/p", clicks: 0, impressions: 0 }], clicks: 0, impressions: 0, ctr: null };
  html = renderReport(report);
  assert.match(html, /<dt>클릭률<\/dt><dd>측정 안 됨/);
});

test("marks synthetic example data in the header only when sample is true", () => {
  const report = emptyReport();
  assert.doesNotMatch(renderReport(report), /합성 예시 데이터/);
  assert.doesNotMatch(renderReport({ ...report, sample: false }), /합성 예시 데이터/);
  assert.match(renderReport({ ...report, sample: true }), /<\/h1>\s*<p class="sample">이 보고서는 합성 예시 데이터로 생성했습니다\.<\/p>/);
});

test("bilingual report exposes severity totals and targeted actions with one CSP-authorized offline script", () => {
  const report = emptyReport();
  report.site.pages = [
    { target: "first", results: [{ level: "WARN", item: "meta description" }] },
    { target: "second", results: [{ level: "FAIL", item: "og:image 응답" }, { level: "PASS", item: "<h1>" }] },
  ];
  const en = renderReport({ ...report, locale: "en" });
  assert.match(en, /FAIL 1.+WARN 1.+INFO 0.+PASS 1/);
  assert.match(en, /data-fails="1" data-warnings="0"/);
  assert.match(en, /data-level="FAIL"[\s\S]+absolute public HTTPS image URL/);
  assert.match(en, /<textarea[^>]+readonly[^>]*>[\s\S]+FAIL 1 · WARN 1 · INFO 0 · PASS 1/);
  assert.match(renderReport(report), /이미지 요청이 200을 반환하는지/);
  const [script] = [...en.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const hash = createHash("sha256").update(script[1]).digest("base64");
  assert.ok(en.includes(`script-src 'sha256-${hash}'`));
  assert.doesNotMatch(en, /<script[^>]*\bsrc=|script-src[^;]*'unsafe-inline'/);
});
