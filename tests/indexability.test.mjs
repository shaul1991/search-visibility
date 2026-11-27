import { startHttpFixture } from "./loopback.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { checkPage, parseHtml, run } from "../skills/seo-orchestrator/scripts/seo-check.mjs";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../skills/seo-orchestrator/scripts/seo-check.mjs", import.meta.url));
const good = await readFile(new URL("./fixtures/good.html", import.meta.url), "utf8");

function reportsFor(tags, robotsHeaders = [], expectIndexable = true) {
  const html = good.replace("</head>", tags + "</head>");
  const rows = [];
  const { pageNoindex } = checkPage(parseHtml(html), (level, channel, item, detail) => {
    rows.push({ level, channel, item, detail });
  }, null, { robotsHeaders, expectIndexable });
  return { rows, pageNoindex };
}

test("repeated robots meta keeps the restrictive directive regardless of order", () => {
  for (const values of [["index", "noindex"], ["none", "all"], ["index", "noindex nofollow"]]) {
    const tags = values.map(value => `<meta name="ROBOTS" content="${value}">`).join("");
    const { rows, pageNoindex } = reportsFor(tags);
    assert.equal(pageNoindex, true);
    assert.deepEqual(rows.filter(r => r.level === "FAIL").map(r => [r.channel, r.item]), [["공통", "robots meta"]]);
    assert.equal(reportsFor(tags, [], false).rows.some(r => r.level === "FAIL"), false);
  }
});

test("scoped header lines do not leak to later lines or unrelated engines", () => {
  const { rows, pageNoindex } = reportsFor('<meta name="yeti" content="index">', [
    "Googlebot: max-snippet:50, nofollow, NOINDEX", "Bingbot: none",
    "OtherBot: noindex", "all",
  ]);
  assert.deepEqual(rows.filter(r => r.level === "FAIL").map(r => r.channel), ["googlebot", "bingbot", "otherbot"]);
  assert.equal(pageNoindex, false);
  assert.ok(rows.some(r => r.channel === "공통" && r.detail === "robots: all"));
  assert.ok(reportsFor("", ["bingbot: all", "none"]).pageNoindex);
});

test("URL checks follow redirects, read gzip and repeated headers, and gate noindex in public mode", async t => {
  const { origin, tcp } = await startHttpFixture(t, (url) => {
    switch (url.pathname) {
      case "/old": return { status: 301, headers: { location: "/article", "x-robots-tag": "applebot: none" } };
      case "/robots.txt": return { body: "User-agent: *\nAllow: /\n" };
      case "/cover": return { body: Buffer.alloc(5200) };
      case "/article": {
        const html = good.replace("https://example.com/og/sample-2026.jpg", url.origin + "/cover");
        return {
          headers: { "Content-Encoding": "gzip", "X-Robots-Tag": ["bingbot: index", "noindex"] },
          body: gzipSync(html),
        };
      }
      default: return { status: 404 };
    }
  });
  const url = origin + "/old";
  const { results } = await run(url);
  assert.ok(results.some(r => r.item === "<title>" && r.detail.includes("예시 행사 2026 일정")));
  assert.ok(results.some(r => r.item === "X-Robots-Tag" && r.level === "WARN" && r.channel === "공통"));
  assert.ok(!results.some(r => r.detail.includes("applebot: none")));
  assert.ok(!results.some(r => r.level === "FAIL"));
  const expected = [["X-Robots-Tag", "공통"]];
  const failures = rows => rows.filter(r => r.level === "FAIL").map(r => [r.item, r.channel]);
  assert.deepEqual(failures((await run(url, { expectIndexable: true })).results), expected);
  if (tcp) {
    await assert.rejects(exec(process.execPath, [cli, "--json", "--expect-indexable", url]), error => {
      assert.equal(error.code, 1);
      assert.deepEqual(failures(JSON.parse(error.stdout).results), expected);
      return true;
    });
  }
});

test("offline public CLI gate applies restrictive rules for specialized crawlers", async t => {
  const dir = await mkdtemp(join(tmpdir(), "seo-page-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "page.html");
  const html = good.replace("</head>", '<meta name="googlebot-news" content="index"><meta name="googlebot-news" content="none"></head>');
  await writeFile(file, html);
  await assert.rejects(exec(process.execPath, [cli, file, "--expect-indexable", "--json"]), error => {
    assert.equal(error.code, 1);
    const fails = JSON.parse(error.stdout).results.filter(row => row.level === "FAIL");
    assert.deepEqual(fails.map(row => row.channel), ["googlebot-news"]);
    return true;
  });
  const normal = await exec(process.execPath, [cli, file, "--json"]);
  assert.ok(JSON.parse(normal.stdout).results.some(row => row.level === "WARN" && row.channel === "googlebot-news"));
});
