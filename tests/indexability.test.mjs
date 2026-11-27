import { listenOnLoopback } from "./loopback.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
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

test("CLI reads the final response headers, preserves repeats, and only gates noindex in public mode", async t => {
  const server = createServer((req, res) => {
    if (req.url === "/old") {
      res.writeHead(301, { location: "/article", "x-robots-tag": "applebot: none" }).end();
    } else if (req.url === "/robots.txt") {
      res.end("User-agent: *\nAllow: /\n");
    } else if (req.url === "/cover") {
      res.end(Buffer.alloc(5200));
    } else {
      const html = good.replace("https://example.com/og/sample-2026.jpg", origin + "/cover");
      res.writeHead(200, { "Content-Encoding": "gzip", "X-Robots-Tag": ["bingbot: index", "noindex"] });
      res.end(gzipSync(html));
    }
  });
  const origin = await listenOnLoopback(server, t);
  if (!origin) return;
  const { results } = await run(origin + "/old");
  assert.ok(results.some(r => r.item === "X-Robots-Tag" && r.level === "WARN" && r.channel === "공통"));
  assert.ok(!results.some(r => r.detail.includes("applebot: none")));
  assert.ok(!results.some(r => r.level === "FAIL"));
  await assert.rejects(exec(process.execPath, [cli, "--json", "--expect-indexable", origin + "/old"]), error => {
    assert.equal(error.code, 1);
    const fails = JSON.parse(error.stdout).results.filter(r => r.level === "FAIL");
    assert.deepEqual(fails.map(r => [r.item, r.channel]), [["X-Robots-Tag", "공통"]]);
    return true;
  });
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
