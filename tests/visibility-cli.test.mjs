import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawnSync } from "node:child_process";

import { promisify } from "node:util";
import { startHttpFixture } from "./loopback.mjs";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../skills/seo-orchestrator/scripts/visibility.mjs", import.meta.url));
const demo = fileURLToPath(new URL("../examples/demo/config.json", import.meta.url));

function run(cwd, ...args) {
  return spawnSync(process.execPath, [cli, ...args], {cwd, encoding:"utf8", timeout:15000});
}

test("offline demonstration produces both formats, gates findings and preserves previous output", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-demo-"));
  t.after(() => rm(cwd, {recursive:true, force:true}));
  const first = run(cwd, demo, "--out", "report");
  assert.equal(first.status, 0, first.stderr);
  const json = await readFile(join(cwd, "report", "report.json"), "utf8");
  const report = JSON.parse(json);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.sample, true);
  assert.equal(report.site.pages.length, 2);
  assert.deepEqual([report.ai.sampleSize, report.ai.mentions, report.ai.citations], [3,2,1]);
  assert.deepEqual([report.searchPerformance.clicks, report.searchPerformance.impressions], [20,350]);
  assert.match(await readFile(join(cwd, "report", "index.html"), "utf8"), /합성 예시/);
  assert.equal(run(cwd, demo, "--out", "report").status, 2);
  assert.equal(await readFile(join(cwd, "report", "report.json"), "utf8"), json);
  assert.equal(run(cwd, demo, "--out", "strict", "--fail-on-findings").status, 1);
});

test("collection failures retain partial results, invalid configuration creates no report", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-partial-"));
  t.after(() => rm(cwd, {recursive:true, force:true}));
  await writeFile(join(cwd, "page.html"), "<title>Test</title>");
  await writeFile(join(cwd, "site.json"), JSON.stringify({targets:["missing.html","page.html"]}));
  assert.equal(run(cwd, "site.json", "--out", "partial").status, 2);
  const report = JSON.parse(await readFile(join(cwd, "partial/report.json"), "utf8"));
  assert.ok(report.site.pages[0].error);
  assert.ok(report.site.pages[1].results.length);
  assert.equal(report.ai.mentionRate, null);
  await writeFile(join(cwd, "broken.json"), JSON.stringify({serchConsole:"typo.csv"}));
  assert.equal(run(cwd, "broken.json", "--out", "invalid").status, 2);
  await assert.rejects(readFile(join(cwd, "invalid/index.html")), {code:"ENOENT"});
});

test("CLI attributes citations to the selected account on a shared international host", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-account-"));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  const account = "https://bücher.example/링킵";
  const config = {
    brand: "lnkib",
    ownedUrlPrefixes: [account],
    observations: [account + "/guide", account + "-other/guide"].map(source => ({
      engine: "Example", locale: "de-DE", query: "Hilfe", observedAt: "2026-11-26",
      answer: "Ein Leitfaden.", sources: [source],
    })),
  };
  await writeFile(join(cwd, "config.json"), JSON.stringify(config));
  const result = run(cwd, "config.json", "--out", "report");
  assert.equal(result.status, 0, result.stderr);
  const {ai} = JSON.parse(await readFile(join(cwd, "report/report.json"), "utf8"));
  assert.equal(ai.citationRate, 0.5);
  assert.deepEqual(ai.records.map(row => row.cited), [true, false]);
  assert.equal(ai.records[0].matchedSources[0], new URL(account + "/guide").href);
  const html = await readFile(join(cwd, "report/index.html"), "utf8");
  assert.match(html, /소유 출처 인용률/);
});

test("both CLIs run through a symlinked skill directory", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-installed-"));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  const skillLink = join(cwd, "seo-orchestrator");
  await symlink(dirname(dirname(cli)), skillLink, "junction");

  const report = spawnSync(process.execPath, [
    join(skillLink, "scripts", "visibility.mjs"), demo, "--out", "report",
  ], {cwd, encoding: "utf8", timeout: 15000});
  assert.equal(report.status, 0, report.stderr);
  assert.equal(JSON.parse(await readFile(join(cwd, "report", "report.json"), "utf8")).sample, true);

  const page = fileURLToPath(new URL("./fixtures/good.html", import.meta.url));
  const audit = spawnSync(process.execPath, [
    join(skillLink, "scripts", "seo-check.mjs"), page, "--json", "--lang", "en",
  ], {cwd, encoding: "utf8", timeout: 15000});
  assert.equal(audit.status, 0, audit.stderr);
  const { results } = JSON.parse(audit.stdout);
  assert.ok(results.some(finding => finding.channel === "General" && finding.item === "Scope"));
});

test("language precedence localizes output while preserving measurements and input text", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-language-"));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  await writeFile(join(cwd, "page.html"), "<html lang=ko><title>쿠버네티스</title>");
  await writeFile(join(cwd, "search.csv"), "\uFEFF검색어,클릭수,노출수\n쿠버네티스,123,1234\n");
  await writeFile(join(cwd, "config.json"), JSON.stringify({
    locale: "en", targets: ["page.html"], searchConsole: "search.csv",
  }));

  const reports = [];
  for (const lang of ["en", "ko"]) {
    const flags = lang === "en" ? [] : ["--lang=ko"];
    const result = run(cwd, "config.json", "--out", lang, ...flags);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, lang === "en" ? /Pages: 1/ : /페이지 1개/);
    const json = JSON.parse(await readFile(join(cwd, lang, "report.json"), "utf8"));
    const html = await readFile(join(cwd, lang, "index.html"), "utf8");
    assert.equal(json.locale, lang);
    assert.match(html, new RegExp(`<html lang="${lang}">`));
    assert.match(html, lang === "en" ? /Technical checks by page/ : /페이지별 기술 진단/);
    assert.match(html, /1,234/);
    assert.match(html, /쿠버네티스/);
    const image = json.site.pages[0].results.find(finding => finding.item === "og:image");
    assert.equal(image.detail, lang === "en" ? "Missing" : "없음");
    const canonical = json.site.pages[0].results.find(finding => finding.item === "canonical");
    assert.equal(canonical.channel, lang === "en" ? "General" : "공통");
    assert.equal(canonical.detail, lang === "en" ? "Missing" : "없음");
    reports.push(json);
  }

  assert.deepEqual(reports[0].searchPerformance, reports[1].searchPerformance);
  assert.deepEqual(reports[0].ai, reports[1].ai);
  const levels = report => report.site.pages[0].results.map(finding => [finding.level, finding.skill]);
  assert.deepEqual(levels(reports[0]), levels(reports[1]));
});

test("language help and validation work before collecting inputs", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-language-validation-"));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  assert.match(run(cwd, "--help").stdout, /사용법/);
  assert.match(run(cwd, "--help", "--lang", "en").stdout, /Usage:/);
  assert.equal(run(cwd, "--help", "--lang", "de").status, 2);
  await writeFile(join(cwd, "config.json"), JSON.stringify({locale: null}));
  assert.match(run(cwd, "config.json").stderr, /Language must be en or ko/);
  await writeFile(join(cwd, "config.json"), JSON.stringify({locale: "en", searchConsole: 42}));
  assert.match(run(cwd, "config.json").stderr, /searchConsole must be a CSV file path/);
  assert.match(run(cwd, "config.json", "--lang", "ko").stderr, /CSV 파일 경로가 필요합니다/);
});

test("URL audit modes follow redirects and publish the same findings as a config", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-url-"));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  const {origin, tcp} = await startHttpFixture(t, url => {
    if (url.pathname === "/old") return {status: 302, headers: {Location: "/guide"}};
    if (url.pathname === "/guide") {
      return {headers: {"Content-Type": "text/html"}, body: '<title>Guide</title><meta name="robots" content="noindex">'};
    }
    return {status: 404};
  });
  if (!tcp) return t.skip("CLI subprocess needs a loopback server.");

  const url = origin + "/old";
  await writeFile(join(cwd, "config.json"), JSON.stringify({targets: [url], expectIndexable: true, locale: "en"}));
  const reports = [];
  for (const [folder, args] of [["direct", [url]], ["flag", ["--url", url]], ["config", ["config.json"]]]) {
    const command = exec(process.execPath, [cli, ...args, "--out", folder, "--lang", "en", "--fail-on-findings"], {cwd, timeout: 15000});
    await assert.rejects(command, error => error.code === 1 && /Pages: 1/.test(error.stdout));
    const report = JSON.parse(await readFile(join(cwd, folder, "report.json"), "utf8"));
    assert.equal(report.site.pages[0].target, url);
    assert.ok(report.site.pages[0].results.some(finding => finding.level === "FAIL" && /noindex/i.test(finding.detail)));
    assert.match(await readFile(join(cwd, folder, "index.html"), "utf8"), /<html lang="en">/);
    const {checkedAt, ...page} = report.site.pages[0];
    assert.ok(Number.isFinite(Date.parse(checkedAt)));
    reports.push({...report.site, pages: [page]});
  }
  assert.deepEqual(reports[0], reports[2]);
  assert.deepEqual(reports[1], reports[2]);
});

test("init writes a localized starter and preserves existing paths", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-init-"));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  const result = run(cwd, "init", "--lang", "en");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created config:/);
  const path = join(cwd, "visibility.config.json");
  const original = await readFile(path, "utf8");
  const config = JSON.parse(original);
  assert.equal(config.locale, "en");
  assert.equal(config.expectIndexable, true);
  assert.equal(new URL(config.targets[0]).protocol, "https:");
  assert.equal(run(cwd, "init").status, 2);
  assert.equal(await readFile(path, "utf8"), original);

  const custom = run(cwd, "init", "project.json");
  assert.equal(custom.status, 0, custom.stderr);
  assert.equal(JSON.parse(await readFile(join(cwd, "project.json"), "utf8")).locale, "ko");
  await symlink("absent.json", join(cwd, "linked.json"));
  assert.equal(run(cwd, "init", "linked.json").status, 2);
  await assert.rejects(readFile(join(cwd, "absent.json")), {code: "ENOENT"});

  await writeFile(join(cwd, "page.html"), "<title>Editable starter</title>");
  await writeFile(path, JSON.stringify({...config, targets: ["page.html"]}));
  assert.equal(run(cwd, "visibility.config.json", "--out", "report").status, 0);
});

test("URL and init argument errors exit 2 before writing any artifacts", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-arguments-"));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  for (const args of [
    ["--url", "page.html"], ["http:example.org"], ["https:///example.org"],
    ["--url", "https://:bad"], ["--url", "https://user:pass@example.org"],
    ["--url", "https://example.org", "--url=https://example.net"],
    ["ftp://example.org"], ["//example.org"], ["config.json", "--url", "https://example.org"],
    ["init", "--out", "report"], ["init", "--fail-on-findings"], ["init", "a.json", "b.json"],
  ]) {
    const result = run(cwd, ...args, "--lang", "en");
    assert.equal(result.status, 2, args.join(" "));
    assert.match(result.stderr, /HTTP\(S\)|URLs with credentials|--url only once|Usage:/);
  }
  await assert.rejects(readFile(join(cwd, "visibility.config.json")), {code: "ENOENT"});
  await assert.rejects(readFile(join(cwd, "visibility-reports")), {code: "ENOENT"});
});

test("compare reports preserves zero, marks unavailable deltas and escapes HTML", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "visibility-comparison-"));
  t.after(() => rm(cwd, {recursive:true, force:true}));
  assert.equal(run(cwd, demo, "--out", "baseline").status, 0);
  const beforeFile = "baseline/report.json";
  const afterFile = "after.json";
  const before = JSON.parse(await readFile(join(cwd, beforeFile), "utf8"));
  const after = structuredClone(before);
  const engine = "<img src=x>";
  before.ai.byEngine = [{engine: engine.toUpperCase(), sampleSize: 2, mentionRate: 0, citationRate: null}];
  after.ai.byEngine = [
    {engine, sampleSize: 2, mentionRate: 0.5, citationRate: 0},
    {engine: "New", sampleSize: 1, mentionRate: 1, citationRate: 0},
  ];
  after.site.pages[0].results.push({level:"FAIL"}, {level:"WARN"});
  after.searchPerformance.clicks = 35;
  after.searchPerformance.ctr = 0.1;
  await writeFile(join(cwd, beforeFile), JSON.stringify(before));
  await writeFile(join(cwd, afterFile), JSON.stringify(after));

  const result = run(cwd, "compare", beforeFile, afterFile, "--out", "diff", "--lang", "en");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created before-and-after comparison/);
  const json = JSON.parse(await readFile(join(cwd, "diff/report.json"), "utf8"));
  assert.equal(json.kind, "comparison");
  assert.equal(json.site.fail.delta, 1);
  assert.equal(json.site.warn.delta, 1);
  assert.equal(json.searchPerformance.impressions.delta, 0);
  assert.equal(json.searchPerformance.clicks.delta, 15);
  assert.ok(Math.abs(json.searchPerformance.ctr.delta - (0.1 - 20 / 350)) < 1e-12);
  assert.deepEqual(json.ai.byEngine[0].mentionRate, {before:0, after:0.5, delta:0.5});
  assert.deepEqual(json.ai.byEngine[0].citationRate, {before:null, after:0, delta:null});
  assert.equal(json.ai.byEngine[1].mentionRate.delta, null);
  const html = await readFile(join(cwd, "diff/index.html"), "utf8");
  assert.match(html, /lang="en"/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.match(html, /\+50 pp/);
  assert.equal(run(cwd, "compare", beforeFile, afterFile, "--out", "diff").status, 2);

  after.site.pages[0].error = "Unavailable";
  after.searchPerformance.dimension = "date";
  await writeFile(join(cwd, afterFile), JSON.stringify(after));
  assert.equal(run(cwd, "compare", beforeFile, afterFile, "--out", "partial").status, 0);
  const partial = JSON.parse(await readFile(join(cwd, "partial/report.json"), "utf8"));
  assert.equal(partial.site.fail.delta, null);
  assert.equal(partial.searchPerformance.clicks.delta, null);
  assert.match(await readFile(join(cwd, "partial/index.html"), "utf8"), /lang="ko"/);

  const invalid = run(cwd, "compare", beforeFile, "diff/report.json", "--out", "invalid", "--lang", "en");
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /after input must be a valid v1/);
  await assert.rejects(readFile(join(cwd, "invalid/report.json")), {code:"ENOENT"});
});
