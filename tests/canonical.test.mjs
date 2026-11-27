import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml, checkPage } from "../skills/seo-orchestrator/scripts/seo-check.mjs";

const url = "https://example.org/events/page";
const link = href => `<link rel="canonical" href="${href}">`;
function results(html, pageUrl = url) {
  const rows = [];
  checkPage(parseHtml(html), (level, channel, item, detail) => {
    if (item === "canonical") rows.push({ level, detail });
  }, pageUrl);
  return rows;
}

test("conflicting head targets fail, spelling variants of the same target only warn", () => {
  assert.ok(results(link(url) + link("/alternate")).some(r => r.level === "FAIL" && r.detail.includes("https://example.org/alternate")));
  const same = results(link("HTTPS://EXAMPLE.ORG:443/events/./page") + link("./page"));
  assert.ok(same.some(r => r.detail.includes("중복")));
  assert.ok(same.every(r => r.level !== "FAIL"));
});

test("canonical belongs in the document head, including when head tags are omitted", () => {
  assert.deepEqual(results("<!doctype html><html><title>t</title>" + link(url) + "<p>body</p>"), []);
  for (const start of ["<body>", "<main>", "body text ", "</head><body>"]) {
    assert.ok(results(start + link(url)).some(r => r.level === "FAIL" && r.detail.includes("<head>")));
  }
  const both = results(link(url) + "<body>" + link("/elsewhere"));
  assert.equal(both.filter(r => r.level === "FAIL").length, 1);
  assert.doesNotMatch(both[0].detail, /서로 다른/);
});

test("inert markup stays out of canonical and repeated meta detection", () => {
  const fake = link("/hidden") + '<meta name="robots" content="noindex">';
  const html = '<html><head>' +
    `<!--${fake}--><script>const sample = '${fake}'</script><style>/*${fake}*/</style>` +
    `<template><template>${fake}</template>${fake}</template>` +
    `<title>제목</title><meta name="description" content='설명 > ${fake}'>` +
    '<meta name="robots" content="index"><meta name="robots" content="follow">' +
    `<link data-note=">" rel="alternate CANONICAL" href="${url}"></head>` +
    `<body><textarea>${fake}</textarea><svg><title>SVG</title>${fake}</svg></body>`;
  const parsed = parseHtml(html);
  assert.equal(parsed.title, "제목");
  assert.deepEqual(parsed.canonicalLinks, [{ href: url, inHead: true }]);
  assert.equal(parsed.meta.robots, "index");
  assert.deepEqual(parsed.metaTags.filter(tag => tag.name === "robots").map(tag => tag.content), ["index", "follow"]);
  assert.deepEqual(results(html), []);
});

test("empty, missing, invalid, or non-HTTP(S) href yields a diagnostic", () => {
  assert.ok(results("").some(r => r.level === "WARN"));
  for (const value of ['<link rel="canonical">', link("  "), link("https://["), link("mailto:team@example.org")]) {
    assert.ok(results(value).some(r => r.level === "FAIL"), value);
  }
});

test("relative target uses the first head base or the final page URL", () => {
  const head = '<base href="/news/"><base href="/ignored/">';
  const relative = results(head + link("./article?x=1&amp;y=2"));
  assert.ok(relative.some(r => r.level === "INFO" && r.detail.includes("https://example.org/news/article?x=1&y=2")));
  assert.ok(results(link("./other")).some(r => r.detail.includes("https://example.org/events/other")));
  assert.ok(results(link("./article"), null).some(r => r.detail.includes("미확인")));
  const offline = results('<base href="https://example.org/">' + link("./a") + link("/a"), null);
  assert.ok(offline.some(r => r.detail.includes("중복")));
  assert.ok(offline.every(r => r.level !== "FAIL"));
});

test("local HTML distinguishes proven root-relative conflicts from base-dependent targets", () => {
  for (const other of ["/b", "https://example.org/b"]) {
    const conflict = results(link("/a") + link(other), null);
    assert.ok(conflict.some(r => r.level === "FAIL" && r.detail.includes("서로 다른")));
  }
  for (const other of ["/./a", "./a", "https://example.org/a"]) {
    const uncertainOrEqual = results(link("/a") + link(other), null);
    assert.ok(uncertainOrEqual.some(r => r.level === "WARN"));
    assert.ok(uncertainOrEqual.every(r => r.level !== "FAIL"));
  }
});
