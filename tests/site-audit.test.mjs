import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { auditSite } from "../skills/seo-orchestrator/scripts/site-audit.mjs";
import { startHttpFixture } from "./loopback.mjs";

const baseDir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const loc = (tag, url) => `<${tag}><loc>${url}</loc></${tag}>`;
const html = "<html><head><title>Fixture</title></head><body></body></html>";

test("relative HTML and explicit duplicates are deterministic; missing files do not hide successful pages", async () => {
  const report = await auditSite({ baseDir, targets: ["good.html", "./good.html", "missing.html", "bad.html"], limit: 2 });
  assert.deepEqual(report.pages.map(p => p.target), ["good.html", "missing.html"]);
  assert.ok(report.pages[0].results.some(r => r.skill === "seo-orchestrator"));
  assert.deepEqual(report.pages[1].results, []);
  assert.match(report.pages[1].error, /ENOENT/);
  assert.ok(report.truncated);
  assert.ok(report.warnings.length);
});

test("sitemap indexes decode escaped locations, ignore extension URLs and stay on origin", async (t) => {
  const requested = new Set();
  const fixture = await startHttpFixture(t, (url) => {
    requested.add(url.pathname + url.search);
    const origin = url.origin;
    if (url.pathname === "/index") return { body: `<sitemapindex>${loc("sitemap", origin + "/nested.xml.gz")}${loc("sitemap", origin + "/index")}${loc("sitemap", "https://example.invalid/sitemap")}</sitemapindex>` };
    if (url.pathname === "/nested.xml.gz") return { body: gzipSync(`<?xml version="1.0"?><sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      <sm:url><sm:loc>${origin}/p?a=1&amp;b=2#fragment</sm:loc><image:image><image:loc>${origin}/not-a-page</image:loc></image:image></sm:url>
      <sm:url><sm:loc><![CDATA[${origin}/redirect]]></sm:loc></sm:url>
      <sm:url><sm:loc>${origin}/good</sm:loc></sm:url>
      </sm:urlset>`) };
    if (url.pathname === "/redirect") return { status: 301, headers: { location: "https://example.invalid/escaped" } };
    if (url.pathname === "/robots.txt") return { status: 404 };
    return { body: html };
  });
  const { origin } = fixture;
  const report = await auditSite({ baseDir, targets: ["good.html", origin + "/good"], sitemap: origin + "/index" });
  assert.deepEqual(report.pages.map(p => p.target), ["good.html", origin + "/good", origin + "/p?a=1&b=2", origin + "/redirect"]);
  assert.equal(report.sitemapsRead, 2);
  assert.deepEqual(report.discoveryErrors, []);
  assert.equal(report.truncated, false);
  assert.ok(report.warnings.some(w => w.includes("다른 출처")));
  assert.match(report.pages[3].error, /출처/);
  assert.ok(requested.has("/p?a=1&b=2"));
  assert.ok(!requested.has("/not-a-page"));
});

test("discovery reports partial coverage when a sitemap fails or the page cap is reached", async (t) => {
  const requested = new Set();
  const { origin } = await startHttpFixture(t, (url) => {
    requested.add(url.pathname);
    if (url.pathname === "/index") return { body: `<sitemapindex>${["/bad", "/ok"].map(p => loc("sitemap", url.origin + p)).join("")}</sitemapindex>` };
    if (url.pathname === "/bad") return { body: "<html>not a sitemap</html>" };
    if (url.pathname === "/ok") return { body: `<urlset>${["/1", "/2", "/3"].map(p => loc("url", url.origin + p)).join("")}</urlset>` };
    if (url.pathname === "/robots.txt") return { status: 404 };
    return { body: html };
  });
  const report = await auditSite({ sitemap: origin + "/index", limit: 1 });
  assert.equal(report.truncated, true);
  assert.deepEqual(report.pages.map(p => p.target), [origin + "/1"]);
  assert.deepEqual(report.discoveryErrors.map(err => err.target), [origin + "/bad"]);
  assert.equal(report.sitemapsRead, 2);
  assert.ok(!requested.has("/2"));
});

test("site audit rejects unsupported inputs before starting the audit", async () => {
  for (const args of [{ limit: 101 }, { limit: 1.5 }, { targets: "site" }, { targets: [null] },
    { targets: ["ftp://example.org/page"] }, { sitemap: "sitemap.xml" }, { sitemap: "https://user:pass@example.org/sitemap" }]) {
    await assert.rejects(auditSite(args));
  }
});

test("size limits apply to compressed sitemaps and uncompressed page bodies", async (t) => {
  const { origin } = await startHttpFixture(t, (url) => {
    if (url.pathname === "/map") return { body: gzipSync(Buffer.alloc(2 * 1024 * 1024 + 1, 32)) };
    return { body: Buffer.alloc(4 * 1024 * 1024 + 1, 32) };
  });
  const report = await auditSite({ sitemap: origin + "/map", targets: [origin + "/large"] });
  assert.equal(report.discoveryErrors.length, 1);
  assert.match(report.pages[0].error, /한도/);
});

test("sitemap document budget includes the index itself", async (t) => {
  const paths = [];
  const { origin } = await startHttpFixture(t, (url) => {
    paths.push(url.pathname);
    if (url.pathname === "/index") {
      const maps = Array.from({ length: 14 }, (_, i) => loc("sitemap", url.origin + "/" + i));
      return { body: `<sitemapindex>${maps.join("")}</sitemapindex>` };
    }
    return { body: "<urlset/>" };
  });
  const report = await auditSite({ sitemap: origin + "/index" });
  assert.equal(paths.length, 10);
  assert.equal(report.sitemapsRead, 10);
  assert.equal(report.truncated, true);
  assert.ok(report.warnings.some(w => w.includes("10개 문서")));
});

test("sitemap-derived pages restrict auxiliary robots and social preview redirects to the site", async (t) => {
  const { origin } = await startHttpFixture(t, (url) => {
    if (url.pathname === "/map") return { body: `<urlset>${loc("url", url.origin + "/page")}</urlset>` };
    if (url.pathname === "/page") return { body: `<html><head><meta property="og:image" content="${url.origin}/img"></head></html>` };
    return { status: 302, headers: { location: "https://example.invalid/resource" } };
  });
  const report = await auditSite({ sitemap: origin + "/map" });
  const skipped = report.pages[0].results.filter(r => r.detail.includes("다른 출처"));
  assert.deepEqual(skipped.map(r => r.item), ["og:image 응답", "robots.txt"]);
});

test("robots sitemap discovery stays on the final origin and checks audited language variants", async (t) => {
  const requested = [];
  const { origin } = await startHttpFixture(t, (url) => {
    requested.push(url.pathname);
    const { origin, pathname } = url;
    if (pathname === "/start") return { status: 302, headers: { location: "/en" } };
    if (pathname === "/robots.txt") return { body: `User-agent: GPTBot
Disallow: /en
User-agent: OAI-SearchBot
Allow: /
Sitemap: ${origin}/map # primary
Sitemap: ${origin}/map
Sitemap: https://example.invalid/map
Sitemap: /relative` };
    if (pathname === "/map") return { body: `<urlset>${loc("url", origin + "/ko")}</urlset>` };
    if (pathname === "/explicit") return { body: "<urlset/>" };
    const links = pathname === "/en" ? [["en", "/en"], ["ko", "/ko"], ["x-default", "/en"]] : [
      ["ko", "/ko"], ["fr", "/en"], ["ja", "/unselected"],
    ];
    return { body: `<html><head>${links.map(([lang, path]) =>
      `<link rel="alternate" hreflang="${lang}" href="${origin + path}">`).join("")}</head></html>` };
  });
  const report = await auditSite({ targets: [origin + "/start"] });
  assert.deepEqual(report.pages.map(page => page.target), [origin + "/start", origin + "/ko"]);
  assert.equal(report.sitemapsRead, 1);
  assert.equal(requested.filter(path => path === "/map").length, 1);
  assert.deepEqual(report.discoveryErrors, []);
  assert.ok(!requested.includes("/relative"));
  assert.ok(!requested.includes("/unselected"));
  const [english, korean] = report.pages;
  assert.equal(english.hreflang.url, origin + "/en");
  assert.ok(english.results.some(r => r.item === "hreflang reciprocity"));
  assert.ok(!english.results.some(r => r.item === "hreflang x-default"));
  assert.ok(korean.results.some(r => r.item === "hreflang x-default"));
  assert.ok(!korean.results.some(r => r.item === "hreflang reciprocity"));
  assert.deepEqual(english.robots.crawlers.find(bot => bot.agent === "GPTBot"), {
    agent: "GPTBot", purpose: "training", decision: "blocked", via: "own", rule: { type: "disallow", path: "/en" },
  });
  assert.equal(english.robots.crawlers.find(bot => bot.agent === "OAI-SearchBot").decision, "allowed");
  assert.equal(korean.robots.crawlers.find(bot => bot.agent === "GPTBot").decision, "allowed");
  const explicit = await auditSite({ targets: [origin + "/start"], sitemap: origin + "/explicit" });
  assert.equal(explicit.sitemapsRead, 1);
  assert.equal(explicit.pages.length, 1);
  assert.equal(requested.filter(path => path === "/map").length, 1);
});
