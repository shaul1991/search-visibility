import { startHttpFixture } from "./loopback.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { robotsDecision, run } from "../skills/seo-orchestrator/scripts/seo-check.mjs";

test("the longest matching rule decides the requested path, including allow exceptions", () => {
  const rules = [
    "User-agent: *",
    "Disallow: /events/",
    "Allow: /events/public/",
    "Disallow: /events/public/private/",
  ].join("\n");
  const blocked = (path) => robotsDecision(rules, "Googlebot", path).blocked;
  assert.equal(blocked("/events/one"), true);
  assert.equal(blocked("/events/public/one"), false);
  assert.equal(blocked("/events/public/private/one"), true);
  assert.equal(blocked("/Events/one"), false);
});

test("repeated applicable groups merge, equally specific Allow wins, and a specific group replaces *", () => {
  const rules = [
    "User-agent: *", "Disallow: /",
    "User-agent: Googlebot", "Disallow: /events/",
    "User-agent: googlebot", "Allow: /events/public/", "Disallow: /events/public/",
    "User-agent: *", "Allow: /public/",
  ].join("\n");
  assert.equal(robotsDecision(rules, "Googlebot", "/events/public/a").blocked, false);
  assert.equal(robotsDecision(rules, "Googlebot", "/events/private").blocked, true);
  assert.equal(robotsDecision(rules, "Googlebot", "/other").blocked, false);
  assert.equal(robotsDecision(rules, "OtherBot", "/public/a").blocked, false);
  assert.equal(robotsDecision(rules, "OtherBot", "/other").blocked, true);
  assert.deepEqual(robotsDecision(rules, "Applebot", "/events/a"), { blocked: true, via: "fallback" });
});

test("wildcards and end anchors include the query and preserve reserved octets", () => {
  const rules = [
    "User-agent: *",
    "Disallow: /download/*.pdf$",
    "Disallow: /search?*draft=1$",
    "Disallow: /서울/%7e/%2f$",
  ].join("\n");
  const blocked = (path) => robotsDecision(rules, "Googlebot", path).blocked;
  assert.equal(blocked("/download/a.pdf"), true);
  assert.equal(blocked("/download/a.pdf?view=1"), false);
  assert.equal(blocked("/search?q=k&draft=1"), true);
  assert.equal(blocked("/search?q=k&draft=10"), false);
  assert.equal(blocked("/%ec%84%9c%ec%9a%b8/~/%2F"), true);
  assert.equal(blocked("/서울/~//"), false);
});

test("URL checks use the final page path, retain rule evidence and flag HTTP 429", async (t) => {
  let robotsResponseStatus = 200;
  const { origin } = await startHttpFixture(t, (url) => {
    if (url.pathname === "/old") {
      return { status: 301, headers: { location: "/events/public/page?preview=1" } };
    }
    if (url.pathname === "/robots.txt") {
      return {
        status: robotsResponseStatus,
        headers: { "content-type": "text/plain" },
        body: "User-agent: *\nDisallow: /events/\nAllow: /events/public/\nDisallow: /*?preview=1$",
      };
    }
    return { headers: { "content-type": "text/html" }, body: "<title>행사 목록</title>" };
  });
  const { results } = await run(origin + "/old");
  const decision = results.find((row) => row.item === "robots.txt *");
  assert.equal(decision.level, "INFO"); // /events/public/ is longer than /*?preview=1$
  assert.match(decision.detail, /\/events\/public\/page\?preview=1.*allow: \/events\/public\//i);
  const blocked = await run(origin + "/events/private");
  assert.ok(blocked.results.some((row) => row.level === "FAIL" && /disallow: \/events\//i.test(row.detail)));
  robotsResponseStatus = 429;
  const unavailable = await run(origin + "/old");
  assert.ok(unavailable.results.some((row) => row.item === "robots.txt" && row.level === "WARN" && row.detail.includes("429")));
  assert.ok(!unavailable.results.some((row) => row.item === "robots.txt *"));
});
