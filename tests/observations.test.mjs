import test from "node:test";
import assert from "node:assert/strict";
import { analyzeObservations } from "../skills/seo-orchestrator/scripts/observations.mjs";

const sample = {
  engine: "ChatGPT", query: "어디에서 확인할 수 있나요?", observedAt: "2026-01-02",
  answer: "공식 안내 페이지를 참고하세요.", sources: [],
};
const config = { brand: "가온", aliases: ["Gaon", "C++"], domains: ["Example.org."] };

test("separates mentions from source citations and gives each observed answer one vote", () => {
  const result = analyzeObservations({ ...config, observations: [
    { ...sample, answer: "가온은 검색 결과를 제공합니다. ＧＡＯＮ도 지원합니다.",
      observedAt: "2026-01-02T13:00:00+09:00", locale: "ko-KR", model: "test", evidenceUrl: "https://records.test/1" },
    { ...sample, engine: "chatgpt", sources: ["https://EXAMPLE.ORG/a", "https://example.org/a", "https://sub.example.org/b"] },
    { ...sample, engine: "다른 엔진", answer: "C++를 지원합니다.", sources: ["https://example.org/b"] },
    { ...sample, engine: "다른 엔진", answer: "다른 브랜드입니다." },
  ] });
  const { byEngine, records, ...totals } = result;
  assert.deepEqual(totals, { sampleSize: 4, mentions: 2, citations: 2, mentionRate: 0.5, citationRate: 0.5 });
  assert.deepEqual(byEngine.map(entry => [entry.engine, entry.sampleSize, entry.mentions, entry.citations]), [
    ["ChatGPT", 2, 1, 1], ["다른 엔진", 2, 1, 1],
  ]);
  assert.deepEqual(records[0].matchedTerms, ["가온", "Gaon"]);
  assert.equal(records[0].evidenceUrl, "https://records.test/1");
  assert.equal(records[0].locale, "ko-KR");
  assert.equal(records[0].model, "test");
  assert.deepEqual(records[1].matchedSources, ["https://example.org/a", "https://sub.example.org/b"]);
  assert.equal(records[1].mentioned, false);
  assert.equal(records[0].cited, false);
  assert.ok(!Object.hasOwn(records[0], "answer"));
});

test("counts visible text and exact hosts/subdomains, with literal aliases", () => {
  const result = analyzeObservations({ ...config, observations: [
    { ...sample, answer: "dagAon! 가온누리와 외가온, CC 그리고 [출처](https://Gaon.example/Gaon).",
      sources: ["https://notexample.org/a", "https://example.org.other.test/", "https://other.test/go?next=example.org"] },
    { ...sample, answer: "가온에서 제공하는 [C++](https://other.test) 문서입니다." },
  ] });
  assert.deepEqual(result.records.map(row => row.mentioned), [false, true]);
  assert.deepEqual(result.records[1].matchedTerms, ["가온", "C++"]);
  assert.equal(result.citations, 0);
  const idn = analyzeObservations({
    brand: "한글", domains: ["예시.한국"], observations: [{ ...sample, sources: ["https://도움.예시.한국/"] }],
  });
  assert.equal(idn.citations, 1);
});

test("distinguishes no observations, no tracked domains, and measured zero", () => {
  const empty = analyzeObservations();
  assert.equal(empty.mentionRate, null);
  assert.equal(empty.citationRate, null);
  const untracked = analyzeObservations({ brand: "가온", observations: [sample] });
  assert.equal(untracked.mentionRate, 0);
  assert.equal(untracked.citationRate, null);
  assert.equal(untracked.byEngine[0].citationRate, null);
  assert.equal(untracked.records[0].cited, null);
  const measured = analyzeObservations({ ...config, observations: [sample] });
  assert.equal(measured.citationRate, 0);
});

test("attributes shared host citations to the exact account or a descendant on the same origin", () => {
  const own = "https://blog.naver.com/my-shop";
  const sources = [own + "?tab=posts#latest", own + "/123", own + "-2/123", own + "%2F123", own + "%3Ftab",
    "https://blog.naver.com/other-shop/123", "https://m.blog.naver.com/my-shop/123",
    "http://blog.naver.com/my-shop", "https://blog.naver.com:8443/my-shop", "https://blog.naver.com/My-Shop"];
  const result = analyzeObservations({
    brand: "가온", ownedUrlPrefixes: [own + "/"],
    observations: sources.map(source => ({ ...sample, sources: [source] })),
  });
  assert.deepEqual(result.records.map(row => row.cited), [true, true, ...Array(8).fill(false)]);
  assert.equal(result.citationRate, 2 / 10);
  assert.equal(result.byEngine[0].citations, 2);
  assert.deepEqual(result.records[1].matchedSources, [own + "/123"]);
  assert.equal(analyzeObservations({brand:"가온", ownedUrlPrefixes:[own]}).citationRate, null);
});

test("combines whole domains with international account URLs while preserving reserved escapes", () => {
  const result = analyzeObservations({
    brand: "가온", domains: ["example.org"],
    ownedUrlPrefixes: ["https://github.com/%61cme", "https://예시.한국/가온", "https://example.net/one%2ftwo"],
    observations: [{ ...sample, sources: [
      "https://api.example.org/a", "https://github.com/acme/manual",
      new URL("https://예시.한국/가온").href.replace(/%[0-9A-F]{2}/g, e => e.toLowerCase()) + "/docs",
      "https://example.net/one%2Ftwo/child", "https://example.net/one/two/child",
      "https://github.com/acme-old", "https://github.com/acme/../elsewhere",
    ] }],
  });
  assert.deepEqual(result.records[0].matchedSources, result.records[0].sources.slice(0, 4));
  assert.equal(result.citations, 1);
});

test("rejects invalid ownership scopes before analyzing any data", () => {
  for (const ownedUrlPrefixes of [
    "https://github.com/acme", [""], ["github.com/acme"], ["https://github.com"], ["https://github.com///"],
    ["https://github.com/acme/.."], ["https://github.com/acme?"], ["https://github.com/acme#"],
    ["https://github.com/acme?tab=repos"], ["https://github.com/acme#section"],
    ["https://user:secret@github.com/acme"], ["https://github.com/acme%2"], ["ftp://github.com/acme"],
  ]) {
    assert.throws(() => analyzeObservations({ ownedUrlPrefixes }), /ownedUrlPrefixes/);
  }
});

test("rejects missing evidence, non-HTTP URLs and impossible or ambiguous observation dates", () => {
  const invalid = [
    ["answer", " "], ["sources", undefined], ["sources", ["javascript:void(0)"]],
    ["sources", ["https://example.org@other.test"]], ["sources", ["//example.org"]],
    ["evidenceUrl", "file:///answer.md"], ["observedAt", "2026-02-29"],
    ["observedAt", "2026-11-21T13:30"], ["observedAt", "yesterday"], ["query", ""],
  ];
  for (const [key, value] of invalid) {
    assert.throws(() => analyzeObservations({ ...config, observations: [sample, { ...sample, [key]: value }] }),
      error => error.message.includes("observations[1]." + key));
  }
  assert.throws(() => analyzeObservations({ observations: [sample] }), /brand/);
  for (const domain of ["example.org/path", "*.example.org", "example.org:44", "com", "a..org"]) {
    assert.throws(() => analyzeObservations({ ...config, domains: [domain] }), /domains/);
  }
});
