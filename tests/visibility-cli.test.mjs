import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
    join(skillLink, "scripts", "seo-check.mjs"), page, "--json",
  ], {cwd, encoding: "utf8", timeout: 15000});
  assert.equal(audit.status, 0, audit.stderr);
  assert.ok(JSON.parse(audit.stdout).results.length);
});
