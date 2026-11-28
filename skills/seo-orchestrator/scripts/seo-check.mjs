#!/usr/bin/env node
import { t, currentLocale, withLocale } from "./locale.mjs";
// seo-check: 단일 페이지의 검색·공유 마크업 점검 (Google, 네이버, Open Graph, X, JSON-LD).
// 의존성 없음. Node 18+.
//   node scripts/seo-check.mjs <URL | HTML 파일> [--json] [--expect-indexable]
// 순위·색인 여부·JS 렌더링 결과는 알 수 없습니다. 서버가 준 HTML만 봅니다.

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { isCliEntry } from "./cli-entry.mjs";

import { parseHtml, checkCanonical, httpUrl } from "./html.mjs";
import { fetchPage, fetchResource } from "./fetch-page.mjs";
import { indexingRules, reportIndexing } from "./indexing.mjs";

export { parseHtml };

export const UA = "seo-skills-check/0.1 (+https://github.com/shaul1991/search-visibility)";

// ---------- JSON-LD ----------

function flattenLd(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => flattenLd(n, out));
  else if (node && typeof node === "object") {
    if (node["@graph"]) flattenLd(node["@graph"], out);
    if (node["@type"]) out.push(node);
  }
  return out;
}

const typesOf = (n) => [].concat(n["@type"] || []).map(String);

function checkDate(value, field, add) {
  if (typeof value !== "string") return add("FAIL", t("구조화 데이터", "Structured data"), `Event.${field}`, (currentLocale() === "en" ? `${field} must be a string` : `${field}가 문자열이 아님`), "structured-data");
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return add("FAIL", t("구조화 데이터", "Structured data"), `Event.${field}`, (currentLocale() === "en" ? `Invalid ISO 8601 value: ${value}` : `ISO-8601 아님: ${value}`), "structured-data");
  if (/T00:00(:00)?/.test(value)) add("WARN", t("구조화 데이터", "Structured data"), `Event.${field}`, (currentLocale() === "en" ? `Midnight placeholder (T00:00): ${value}. Use only the date when the time is unknown` : `자정(T00:00)으로 채운 값: ${value}. 시간을 모르면 날짜만 쓰기`), "structured-data");
  else if (/T\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/.test(value)) add("WARN", t("구조화 데이터", "Structured data"), `Event.${field}`, (currentLocale() === "en" ? `Missing UTC offset: ${value} (example: +09:00)` : `시간에 UTC 오프셋 없음: ${value} (예: +09:00)`), "structured-data");
}

export function checkJsonLd(blocks, add) {
  const nodes = [];
  blocks.forEach((raw, i) => {
    try { flattenLd(JSON.parse(raw), nodes); }
    catch (e) { add("FAIL", t("구조화 데이터", "Structured data"), `JSON-LD #${i + 1}`, (currentLocale() === "en" ? `Invalid JSON: ${String(e.message).slice(0, 80)}` : `JSON 파싱 실패: ${String(e.message).slice(0, 80)}`), "structured-data"); }
  });
  if (!blocks.length) add("INFO", t("구조화 데이터", "Structured data"), "JSON-LD", t("없음", "Missing"), "structured-data");
  else add("INFO", t("구조화 데이터", "Structured data"), t("유형", "Types"), [...new Set(nodes.flatMap(typesOf))].join(", ") || t("(@type 없음)", "(No @type)"), "structured-data");

  for (const n of nodes) {
    const types = typesOf(n);
    if (types.some((x) => /Event$/.test(x))) {
      if (!n.name) add("FAIL", t("구조화 데이터", "Structured data"), "Event.name", t("필수 속성 없음", "Required property missing"), "structured-data");
      if (!n.startDate) add("FAIL", t("구조화 데이터", "Structured data"), "Event.startDate", t("필수 속성 없음", "Required property missing"), "structured-data");
      else checkDate(n.startDate, "startDate", add);
      if (n.endDate) checkDate(n.endDate, "endDate", add);
      const loc = [].concat(n.location || [])[0];
      if (!loc) add("FAIL", t("구조화 데이터", "Structured data"), "Event.location", t("필수 속성 없음", "Required property missing"), "structured-data");
      else {
        if (!loc.name) add("WARN", t("구조화 데이터", "Structured data"), "Event.location.name", t("장소 이름 없음", "Missing venue name"), "structured-data");
        if (!loc.address) add("FAIL", t("구조화 데이터", "Structured data"), "Event.location.address", t("주소 없음(Google 필수)", "Missing address (required by Google)"), "structured-data");
      }
      if (n.name && loc?.name && String(n.name).trim() === String(loc.name).trim()) add("WARN", t("구조화 데이터", "Structured data"), "Event.name", t("행사명이 장소명과 같음", "Event name matches the venue name"), "structured-data");
      if (!n.eventStatus) add("INFO", t("구조화 데이터", "Structured data"), "Event.eventStatus", t("없음 → Google은 EventScheduled로 간주", "Missing. Google assumes EventScheduled"), "structured-data");
      if (!n.image) add("WARN", t("구조화 데이터", "Structured data"), "Event.image", t("권장 속성 없음", "Recommended property missing"), "structured-data");
    }
    if (types.includes("BreadcrumbList")) {
      const items = [].concat(n.itemListElement || []);
      if (!items.length) add("FAIL", t("구조화 데이터", "Structured data"), "BreadcrumbList", t("itemListElement 없음", "Missing itemListElement"), "structured-data");
      for (const it of items) {
        const name = it.name ?? it.item?.name;
        if (!name) add("FAIL", t("구조화 데이터", "Structured data"), "BreadcrumbList.name", t("name 없음(네이버 필수)", "Missing name (required by Naver)"), "structured-data");
        else if (/^(홈|home|top)$/i.test(String(name).trim())) add("WARN", t("구조화 데이터", "Structured data"), "BreadcrumbList.name", (currentLocale() === "en" ? `Generic name "${name}". Naver recommends a name that describes the page` : `일반어 "${name}" — 네이버는 페이지를 설명하는 이름 권장`), "structured-data");
      }
    }
    if ((types.includes("Organization") || types.includes("Person")) && n.sameAs !== undefined) {
      if (!n.name || !n.url) add("WARN", t("구조화 데이터", "Structured data"), `${types[0]}.sameAs`, t("네이버 연관채널은 name·url·sameAs 필수", "Naver associated channels require name, url and sameAs"), "structured-data");
    }
    if (types.includes("WebSite") && !n.name) add("WARN", t("구조화 데이터", "Structured data"), "WebSite.name", t("사이트 이름 없음", "Missing site name"), "structured-data");
  }
  const events = nodes.filter((n) => typesOf(n).some((x) => /Event$/.test(x)));
  if (events.length > 1) add("WARN", t("구조화 데이터", "Structured data"), t("Event 개수", "Event count"), (currentLocale() === "en" ? `${events.length} events. Google's event experience supports pages dedicated to one event. Use ItemList on listing pages` : `${events.length}개 — Google 이벤트 환경은 한 이벤트에 집중한 상세(리프) 페이지만 지원. 목록 페이지는 ItemList 권장`), "structured-data");
  if (events.length) add("INFO", t("구조화 데이터", "Structured data"), t("Event 지역", "Event regions"), t("Google 이벤트 검색 환경 제공 지역에 한국 없음(2026-11-04 확인). 네이버 Event 가이드 없음", "Google's event experience excludes South Korea (checked 2026-11-04). Naver has no Event guide"), "structured-data");
  return nodes;
}

// ---------- 이미지 크기 ----------

export function imageSize(buf) {
  const b = buf;
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { type: "png", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") return { type: "gif", w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { type: "webp", w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { type: "webp", w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") { const v = b.readUInt32LE(21); return { type: "webp", w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: "jpeg", w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

// ---------- robots.txt ----------

function robotsGroups(txt) {
  const groups = [];
  let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-zA-Z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    const key = k.toLowerCase();
    if (key === "user-agent") {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && cur) cur.rules.push({ type: key, path: v });
  }
  return groups;
}

// RFC 9309: 비 ASCII는 UTF-8 퍼센트 인코딩으로, 인코딩된 비예약 ASCII는 원래 문자로 비교한다.
// %2F 같은 예약 문자는 /와 다르며, 유니코드 경로의 대소문자도 보존한다.
function normalizeRobotsPath(path) {
  return path.replace(/%[\da-f]{2}|[^\x21-\x7e]/giu, (part) => {
    if (!part.startsWith("%")) return encodeURIComponent(part);
    const char = String.fromCharCode(parseInt(part.slice(1), 16));
    return /[a-zA-Z0-9._~-]/.test(char) ? char : part.toUpperCase();
  });
}

// 앞에서부터 일치시키고, * 사이의 리터럴은 순서대로 찾는다. 마지막 $는 쿼리를 포함한 URL 끝을 뜻한다.
function matchesRobotsPath(pattern, path) {
  const exact = pattern.endsWith("$");
  const pieces = (exact ? pattern.slice(0, -1) : pattern).split("*");
  const first = pieces.shift();
  if (!path.startsWith(first)) return false;
  if (!pieces.length) return !exact || path.length === first.length;

  const last = exact ? pieces.pop() : "";
  if (!path.endsWith(last)) return false;
  let cursor = first.length;
  for (const piece of pieces) {
    const found = path.indexOf(piece, cursor);
    if (found < 0) return false;
    cursor = found + piece.length;
  }
  return cursor <= path.length - last.length;
}

function matchingGroupName(groups, agent) {
  let best = "";
  for (const group of groups) {
    for (const name of group.agents) {
      if (name !== "*" && name.length > best.length && agent.startsWith(name)) best = name;
    }
  }
  return best;
}

function decideRobotsPath(groups, agent, path) {
  const name = agent.toLowerCase();
  let groupName = matchingGroupName(groups, name);
  let via = "own";
  if (!groupName && name === "applebot") {
    groupName = matchingGroupName(groups, "googlebot");
    via = "fallback";
  }
  if (!groupName) {
    groupName = "*";
    via = groups.some((g) => g.agents.includes("*")) ? "*" : null;
  }
  let rule = null;
  let bestLength = -1;
  for (const group of groups) {
    if (!group.agents.includes(groupName)) continue;
    for (const candidate of group.rules) {
      if (!candidate.path || !candidate.path.startsWith("/")) continue;
      const pattern = normalizeRobotsPath(candidate.path);
      if (!matchesRobotsPath(pattern, path)) continue;
      const length = pattern.replace(/%[\da-f]{2}/gi, "_").length;
      if (length > bestLength || (length === bestLength && candidate.type === "allow")) {
        bestLength = length;
        rule = candidate;
      }
    }
  }
  return { blocked: rule?.type === "disallow", via, groupName, rule };
}

// 기존 호출의 반환 형식과 기본 경로(/)를 유지한다.
export function robotsDecision(txt, agent, path = "/") {
  const { blocked, via } = decideRobotsPath(robotsGroups(txt), agent, normalizeRobotsPath(path));
  return { blocked, via };
}

export function robotsBlocksRoot(txt, agent) {
  return robotsDecision(txt, agent).blocked;
}

// ---------- 메인 점검 ----------

export function checkPage(p, add, baseUrl, { robotsHeaders = [], expectIndexable = false } = {}) {
  const abs = (u) => /^https?:\/\//i.test(u || "");
  // 제목
  if (!p.title) add("FAIL", t("공통", "General"), "<title>", t("없음", "Missing"), "google-search");
  else {
    add("INFO", t("공통", "General"), "<title>", (currentLocale() === "en" ? `${p.title} (${[...p.title].length} characters)` : `${p.title} (${[...p.title].length}자)`), "google-search");
    const words = p.title.toLowerCase().split(/[\s|·,:\-–—]+/).filter((w) => w.length > 1);
    const rep = Object.entries(words.reduce((m, w) => ((m[w] = (m[w] || 0) + 1), m), {})).filter(([, c]) => c >= 2);
    if (rep.length) add("WARN", t("공통", "General"), t("<title> 반복", "<title> repetition"), (currentLocale() === "en" ? `Repeated words: ${rep.map(([w, c]) => `${w}×${c}`).join(", ")} (Naver may penalize repetition)` : `반복 단어: ${rep.map(([w, c]) => `${w}×${c}`).join(", ")} (네이버: 2회 이상 반복 불이익 가능)`), "naver-search");
    if (/^(홈|home|상세|detail|untitled)$/i.test(p.title.trim())) add("WARN", t("공통", "General"), "<title>", t("모호한 제목", "Generic title"), "google-search");
  }
  // 설명
  const desc = p.meta["description"];
  if (!desc) add("WARN", t("공통", "General"), "meta description", t("없음", "Missing"), "google-search");
  else {
    add("INFO", t("공통", "General"), "meta description", (currentLocale() === "en" ? `${[...desc].length} characters` : `${[...desc].length}자`), "google-search");
    if (p.title && desc.trim() === p.title.trim()) add("WARN", t("공통", "General"), "meta description", t("제목과 동일(네이버 불이익 사례)", "Same as the title (Naver may penalize this)"), "naver-search");
  }
  if (p.h1.length === 0) add("WARN", t("공통", "General"), "<h1>", t("없음 — 페이지 기본 제목이 분명해야 함", "Missing. Provide a clear primary heading"), "google-search");
  else if (p.h1.length > 1) add("INFO", t("공통", "General"), "<h1>", (currentLocale() === "en" ? `${p.h1.length}` : `${p.h1.length}개`), "google-search");
  const canonical = checkCanonical(p, add, baseUrl);
  // robots meta
  const metaTags = p.metaTags ?? Object.entries(p.meta).map(([name, content]) => ({ name, content }));
  const rules = indexingRules(metaTags, robotsHeaders);
  const pageNoindex = reportIndexing(rules, add, expectIndexable);
  const appliesTo = (agent) => rules.filter(r => r.scope === "robots" || r.scope === agent).map(r => r.value);
  const naver = appliesTo("yeti");
  const bing = appliesTo("bingbot");
  const aiSettings = bing.filter(value => /^ai-(training|grounding):[a-z]+$/i.test(value));
  if (naver.includes("nosourceinfo")) {
    add("INFO", t("네이버", "Naver"), "nosourceinfo", t("네이버 AI 출처설명 제외 설정됨", "Opted out of Naver AI source descriptions"), "naver-search");
    add("WARN", t("AI 검색", "AI search"), "nosourceinfo", t("네이버 AI 출처설명에서 제외됨", "Excluded from Naver AI source descriptions"), "ai-crawlers");
  }
  if (bing.some(value => value === "noarchive" || value === "nocache")) add("WARN", "Bing", "noarchive/nocache", t("Bing은 2027-03-01 이후 이 태그를 AI 학습·그라운딩 설정으로 읽지 않음 — ai-training/ai-grounding 설정으로 옮길지 결정", "After 2027-03-01, Bing stops using this tag for AI training and grounding settings. Consider setting ai-training and ai-grounding"), "other-search-engines");
  if (aiSettings.length) add("INFO", "Bing", t("AI 설정", "AI settings"), aiSettings.join(", "), "ai-crawlers");
  if (bing.includes("ai-grounding:disallow")) add("WARN", t("AI 검색", "AI search"), "ai-grounding", t("Copilot 등 Bing AI 답변 근거에서 제외 설정됨(2027-02-01부터)", "Excluded as a grounding source for Bing AI answers such as Copilot (from 2027-02-01)"), "ai-crawlers");
  if (appliesTo("applebot").includes("nosnippet") || appliesTo("googlebot").includes("nosnippet")) add("INFO", t("공통", "General"), "nosnippet", t("해당 검색엔진의 설명·AI 답변 사용이 제한될 수 있음", "May limit use in search snippets and AI answers"), "ai-crawlers");
  // 기본
  if (!p.lang) add("WARN", t("공통", "General"), "<html lang>", t("없음", "Missing"), "google-search");
  if (!p.meta["viewport"]) add("WARN", t("공통", "General"), "viewport", t("없음(모바일)", "Missing (mobile)"), "naver-search");
  if (!p.icons.length) add("WARN", t("네이버", "Naver"), t("파비콘", "Favicon"), t("<link rel=icon> 없음", "Missing <link rel=icon>"), "naver-search");
  else if (!p.icons.every(abs)) add("WARN", t("네이버", "Naver"), t("파비콘", "Favicon"), (currentLocale() === "en" ? `Relative path: ${p.icons.filter((u) => !abs(u)).join(", ")} (Naver requires absolute paths)` : `절대 경로 아님: ${p.icons.filter((u) => !abs(u)).join(", ")} (네이버는 절대 경로 요구)`), "naver-search");
  if (p.verificationInBody) add("FAIL", t("네이버", "Naver"), t("소유 확인", "Ownership verification"), t("naver-site-verification이 <head> 밖에 있음", "naver-site-verification is outside <head>"), "naver-search");
  else if (p.meta["naver-site-verification"]) add("INFO", t("네이버", "Naver"), t("소유 확인", "Ownership verification"), t("meta 있음", "Verification meta tag found"), "naver-search");
  // 본문·링크
  if (p.bodyTextLength < 200) add("WARN", t("공통", "General"), t("서버 HTML 본문", "Server-rendered HTML body"), (currentLocale() === "en" ? `${p.bodyTextLength} characters of text. Search crawlers may miss content rendered on the client` : `텍스트 ${p.bodyTextLength}자 — 클라이언트 렌더링이면 검색로봇이 본문을 못 볼 수 있음`), "google-search");
  const hashLinks = p.anchors.filter((h) => /^#\/|^#!/.test(h));
  const jsLinks = p.anchors.filter((h) => /^javascript:/i.test(h));
  if (hashLinks.length) add("WARN", t("공통", "General"), t("fragment 링크", "Fragment links"), (currentLocale() === "en" ? `${hashLinks.length} links (#/ or #!). Google and Naver treat these as part of the same page` : `${hashLinks.length}개(#/ 또는 #!) — Google·네이버 모두 별도 페이지로 보지 않음`), "naver-search");
  if (jsLinks.length) add("WARN", t("공통", "General"), t("javascript: 링크", "javascript: links"), (currentLocale() === "en" ? `${jsLinks.length}` : `${jsLinks.length}개`), "naver-search");
  add("INFO", t("공통", "General"), "<a href>", (currentLocale() === "en" ? `${p.anchors.length}` : `${p.anchors.length}개`), "google-search");
  // Open Graph
  for (const k of ["og:type", "og:title", "og:description", "og:image", "og:url"]) {
    if (!p.meta[k]) add(k === "og:description" ? "WARN" : "FAIL", t("공유", "Sharing"), k, t("없음", "Missing"), "social-preview");
  }
  if (p.meta["og:image"] && !abs(p.meta["og:image"])) add("FAIL", t("공유", "Sharing"), "og:image", (currentLocale() === "en" ? `Expected an absolute URL: ${p.meta["og:image"]}` : `절대 URL 아님: ${p.meta["og:image"]}`), "social-preview");
  if (p.meta["og:url"] && canonical && httpUrl(p.meta["og:url"]) !== canonical) add("WARN", t("공유", "Sharing"), "og:url", (currentLocale() === "en" ? `Differs from canonical (${p.meta["og:url"]} ≠ ${canonical})` : `canonical과 다름 (${p.meta["og:url"]} ≠ ${canonical})`), "social-preview");
  if (!p.meta["og:site_name"]) add("INFO", t("공유", "Sharing"), "og:site_name", t("없음(Google 사이트 이름·공유에 사용)", "Missing (used for Google's site name and sharing)"), "social-preview");
  // X
  if (!p.meta["twitter:card"]) add("WARN", "X", "twitter:card", t("없음 — X 카드 유형을 지정하지 않음", "Missing. Specify an X card type"), "social-preview");
  else if (!["summary", "summary_large_image", "app", "player"].includes(p.meta["twitter:card"])) add("WARN", "X", "twitter:card", (currentLocale() === "en" ? `Unknown value: ${p.meta["twitter:card"]}` : `알 수 없는 값: ${p.meta["twitter:card"]}`), "social-preview");
  if (p.meta["twitter:card"] && !p.meta["twitter:title"] && !p.meta["og:title"]) add("FAIL", "X", "twitter:title", t("없음(og:title도 없음)", "Missing (og:title is also missing)"), "social-preview");
  const xImg = p.meta["twitter:image"] || p.meta["og:image"];
  if (p.meta["twitter:image"] && !abs(p.meta["twitter:image"])) add("FAIL", "X", "twitter:image", t("절대 URL 아님", "Expected an absolute URL"), "social-preview");
  return { ogImage: p.meta["og:image"], xImg, pageNoindex };
}

async function fetchAuxiliary(url, network) {
  if (!network) return fetch(url, { headers: { "user-agent": UA } });
  const resource = await fetchResource(url, UA, { ...network, accept: "*/*" });
  // Fetch's Response API is also used by the standalone checker.
  const emptyBody = [204, 205, 304].includes(resource.status);
  return new Response(emptyBody ? null : resource.bytes, { status: resource.status, headers: resource.headers });
}

async function checkImage(url, add, network) {
  try {
    const res = await fetchAuxiliary(url, network);
    if (!res.ok) return add("FAIL", t("공유", "Sharing"), t("og:image 응답", "og:image response"), `HTTP ${res.status}`, "social-preview");
    const buf = Buffer.from(await res.arrayBuffer());
    const size = imageSize(buf);
    const kb = (buf.length / 1024).toFixed(1);
    add("INFO", t("공유", "Sharing"), "og:image", `${size ? `${size.type} ${size.w}×${size.h}` : t("크기 판별 불가", "Dimensions unavailable")}, ${kb}KB`, "social-preview");
    if (buf.length < 5000) add("WARN", t("네이버", "Naver"), t("og:image 용량", "og:image file size"), (currentLocale() === "en" ? `${buf.length} bytes < 5,000 (Naver thumbnail requirement)` : `${buf.length}바이트 < 5,000 (네이버 썸네일 조건)`), "naver-search");
    if (buf.length > 5 * 1024 * 1024) add("WARN", "X", t("og:image 용량", "og:image file size"), t("5MB 초과(X 크롤러 한도, 과거 문서)", "Exceeds 5 MB (historical X crawler limit)"), "social-preview");
    if (size) {
      if (size.w <= 150 || size.h <= 150) add("WARN", t("네이버", "Naver"), t("og:image 크기", "og:image dimensions"), t("150×150 초과 필요", "Must exceed 150 × 150"), "naver-search");
      if (Math.max(size.w / size.h, size.h / size.w) > 3) add("WARN", t("네이버", "Naver"), t("og:image 비율", "og:image aspect ratio"), t("가로:세로 3:1 초과", "Width-to-height ratio exceeds 3:1"), "naver-search");
    }
  } catch (e) { add(network ? "WARN" : "FAIL", t("공유", "Sharing"), t("og:image 응답", "og:image response"), String(e.message).slice(0, 100), "social-preview"); }
}

// [robots.txt 이름, 차단 시 수준, Skill, 설명]
export const ROBOT_AGENTS = [
  ["Googlebot", "FAIL", "google-search", "Brave Search·Applebot도 Googlebot 규칙에 영향받음"],
  ["Yeti", "FAIL", "naver-search", ""],
  ["Daum", "FAIL", "daum-search", ""],
  ["Bingbot", "FAIL", "other-search-engines", "DuckDuckGo 일반 결과도 대부분 Bing 기반"],
  ["Applebot", "WARN", "other-search-engines", "Safari·Spotlight·Siri"],
  ["DuckDuckBot", "WARN", "other-search-engines", ""],
  ["Twitterbot", "FAIL", "social-preview", "X 카드"],
  ["facebookexternalhit", "FAIL", "social-preview", "Meta 링크 미리보기"],
  ["OAI-SearchBot", "WARN", "ai-crawlers", "ChatGPT 검색 답변에서 빠짐"],
  ["ChatGPT-User", "WARN", "ai-crawlers", "ChatGPT 사용자 요청 열람 불가"],
  ["Claude-SearchBot", "WARN", "ai-crawlers", "Claude 검색 품질용 색인에서 빠짐"],
  ["Claude-User", "WARN", "ai-crawlers", "Claude 사용자 요청 열람 불가"],
  ["PerplexityBot", "WARN", "ai-crawlers", "Perplexity 검색에서 빠짐"],
  ["Perplexity-User", "WARN", "ai-crawlers", "Perplexity 사용자 요청(대체로 robots 무시)"],
  ["meta-webindexer", "WARN", "ai-crawlers", "Meta AI 검색 인용에서 빠짐"],
  ["MistralAI-Index", "WARN", "ai-crawlers", "Mistral 검색에서 빠짐"],
  ["MistralAI-User", "WARN", "ai-crawlers", "Mistral 사용자 요청 열람 불가"],
  ["Google-Extended", "WARN", "ai-crawlers", "Gemini 앱·Vertex AI의 Google 검색 그라운딩에서 빠짐(Google 검색 자체엔 영향 없음)"],
  ["GPTBot", "INFO", "ai-crawlers", "OpenAI 학습 제외"],
  ["ClaudeBot", "INFO", "ai-crawlers", "Anthropic 학습 제외"],
  ["Applebot-Extended", "INFO", "ai-crawlers", "Apple 생성형 모델 학습 제외"],
  ["meta-externalagent", "INFO", "ai-crawlers", "Meta 학습 제외"],
  ["MistralAI-Training", "INFO", "ai-crawlers", "Mistral 학습 제외"],
  ["__usage_ai-training", "INFO", "ai-crawlers", "Microsoft AI 학습 제외(2027-02-01부터 반영)"],
];

function reportHreflang(page, add, baseUrl) {
  const alternates = [];
  for (const { lang, href } of page.alternates) {
    const absolute = href && /^https?:\/\//i.test(href) ? httpUrl(href) : null;
    const url = absolute ? new URL(absolute) : null;
    if (!lang || !url || url.username || url.password) {
      add("WARN", t("다국어", "International"), "hreflang",
        t("언어 코드와 인증정보 없는 HTTP(S) 절대 URL을 지정하세요.", "Supply a language code and an absolute HTTP(S) URL without credentials."), "google-search");
      continue;
    }
    url.hash = "";
    alternates.push({ lang, url: url.href });
  }
  if (page.alternates.length && !alternates.some(({ lang }) => lang === "x-default")) {
    add("WARN", t("다국어", "International"), "hreflang x-default",
      t("지원 언어에 일치하지 않는 사용자를 위한 기본 URL을 지정하세요.", "Declare a fallback URL for users whose language does not match."), "google-search");
  }
  return { alternates, url: baseUrl };
}

async function checkRobots(url, add, pageNoindex = false, expectIndexable = false, network) {
  try {
    const res = await fetchAuxiliary(new URL("/robots.txt", url), network);
    const ct = res.headers.get("content-type") || "";
    if (res.status === 429) return add("WARN", t("공통", "General"), "robots.txt", t("HTTP 429 — 요청량 제한으로 규칙을 확인하지 못함. Google의 크롤링이 지연될 수 있어 재확인 필요", "HTTP 429. Rate limiting prevented a check of the rules. Check again because Google crawling may be delayed"), "google-search");
    if (res.status >= 500) return add("FAIL", t("공통", "General"), "robots.txt", (currentLocale() === "en" ? `HTTP ${res.status}. Naver treats 5xx as disallowing all crawling` : `HTTP ${res.status} — 네이버는 5xx를 '모두 금지'로 해석`), "naver-search");
    if (res.status >= 400) return add("INFO", t("공통", "General"), "robots.txt", (currentLocale() === "en" ? `HTTP ${res.status}. Google and Naver treat this as having no crawl restrictions` : `HTTP ${res.status} — Google·네이버에서 크롤링 제한 규칙 없음으로 해석`), "naver-search");
    const txt = await res.text();
    if (/text\/html/i.test(ct)) add("WARN", t("공통", "General"), "robots.txt", t("HTML로 응답 — 네이버는 '없음'으로 볼 수 있음. text/plain 권장", "Returned HTML. Naver may treat the file as missing. Use text/plain"), "naver-search");
    const groups = robotsGroups(txt);
    const target = url.pathname + url.search;
    const path = normalizeRobotsPath(target);
    const wildcard = [];
    const crawlers = [];
    let wildcardRule = null;
    let blockedAi = false;
    for (const [agent, level, skill] of ROBOT_AGENTS) {
      const { blocked, via, groupName, rule } = decideRobotsPath(groups, agent, path);
      if (skill === "ai-crawlers") {
        const purpose = level === "INFO" ? "training" : /-User$/i.test(agent) ? "user-request"
          : agent === "Google-Extended" ? "grounding" : "search";
        crawlers.push({ agent, purpose, decision: blocked ? "blocked" : "allowed", via,
          rule: rule ? { type: rule.type, path: rule.path } : null });
      }
      if (!rule) continue;
      if (blocked && level !== "INFO" && skill === "ai-crawlers") blockedAi = true;
      // 같은 * 규칙을 적용받는 봇은 한 줄에 표시한다.
      if (via === "*") {
        wildcard.push({ agent, level });
        wildcardRule = rule;
        continue;
      }
      const channel = level === "INFO" ? t("AI 학습", "AI training") : skill === "ai-crawlers" ? t("AI 검색", "AI search") : t("공통", "General");
      const evidence = `User-agent: ${groupName}, ${rule.type}: ${rule.path}`;
      add(blocked ? level : "INFO", channel, `robots.txt ${agent}`, `${target} — ${blocked ? t("차단", "Blocked") : t("허용", "Allowed")} (${evidence})`, skill);
    }
    if (wildcardRule) {
      const blocked = wildcardRule.type === "disallow";
      const names = wildcard.map(({ agent }) => agent).join(", ");
      const msg = (currentLocale() === "en" ? `${target} — ${blocked ? t("차단", "Blocked") : t("허용", "Allowed")} (User-agent: *, ${wildcardRule.type}: ${wildcardRule.path}). Applies to: ${names}` : `${target} — ${blocked ? t("차단", "Blocked") : t("허용", "Allowed")} (User-agent: *, ${wildcardRule.type}: ${wildcardRule.path}). 적용 대상: ${names}`);
      if (blocked && pageNoindex && !expectIndexable) {
        add("INFO", t("공통", "General"), t("비공개 상태", "Private access"), (currentLocale() === "en" ? `${msg}. The page also declares noindex. Confirm whether it should be public` : `${msg}. 페이지에도 noindex가 있어 공개 의도 확인 필요`), "seo-orchestrator");
      } else {
        const level = ["FAIL", "WARN", "INFO"].find((severity) => wildcard.some((bot) => bot.level === severity));
        add(blocked ? level : "INFO", t("공통", "General"), "robots.txt *", msg, "google-search");
      }
    }
    if (!blockedAi) add("INFO", t("AI 검색", "AI search"), "robots.txt", (currentLocale() === "en" ? `${target} — No blocking rule found for the AI search and user-request crawlers checked. Verify access and visibility separately` : `${target} — 점검 대상 AI 검색·사용자 요청 크롤러의 차단 규칙 없음. 실제 접근·노출은 별도 확인`), "ai-crawlers");
    const sitemaps = [...txt.matchAll(/^\s*sitemap[ \t]*:[ \t]*([^#\r\n]+)/gim)]
      .map(([, value]) => value.trim()).filter(Boolean);
    add(sitemaps.length ? "INFO" : "WARN", t("공통", "General"), "robots.txt Sitemap", sitemaps.length ? sitemaps.join(", ") : t("Sitemap: 줄 없음", "Missing Sitemap: directive"), "google-search");
    if (!res.ok || /text\/html/i.test(ct)) return;
    return { path: target, sitemaps, crawlers };
  } catch (e) { add("WARN", t("공통", "General"), "robots.txt", (currentLocale() === "en" ? `Fetch failed: ${String(e.message).slice(0, 80)}` : `가져오기 실패: ${String(e.message).slice(0, 80)}`), "google-search"); }
}

export async function run(target, { expectIndexable = false, network } = {}) {
  const results = [];
  const add = (level, channel, item, detail, skill) => results.push({ level, channel, item, detail, skill });
  let html, baseUrl = null, robots, hreflang, status;
  if (/^https?:\/\//i.test(target)) {
    const page = await fetchPage(target, UA, network);
    const { chain, finalUrl } = page;
    status = page.status;
    baseUrl = finalUrl;
    if (chain.length > 1) add("INFO", t("공통", "General"), t("리다이렉트", "Redirect"), chain.map((c) => `${c.status} ${c.url}`).join(" → ") + ` → ${status}`, "google-search");
    if (chain.some((c) => c.status === 302 || c.status === 307)) add("INFO", t("공통", "General"), t("리다이렉트", "Redirect"), t("임시 리다이렉트(302/307) 포함 — 영구 이전이면 301", "Includes a temporary redirect (302/307). Use 301 for a permanent move"), "naver-search");
    if (status !== 200) add(status >= 400 ? "FAIL" : "WARN", t("공통", "General"), t("HTTP 상태", "HTTP status"), `${status}`, "naver-search");
    html = page.html;
    const enc = page.headers["content-encoding"] || "";
    if (!/gzip|deflate|br/i.test(enc)) add("INFO", t("공유", "Sharing"), t("압축", "Compression"), t("HTML 응답에 gzip/deflate 없음 — Meta 크롤러는 gzip·deflate 지원 요구", "HTML response lacks gzip or deflate. Meta crawlers require gzip or deflate support"), "social-preview");
    let lastOgIndex = -1;
    for (const tag of html.matchAll(/<meta\b[^>]*property\s*=\s*["']og:/gi)) lastOgIndex = tag.index;
    const lastOgByte = lastOgIndex < 0 ? 0 : Buffer.byteLength(html.slice(0, lastOgIndex));
    if (lastOgByte > 1024 * 1024) add("WARN", t("공유", "Sharing"), t("og 위치", "Open Graph position"), (currentLocale() === "en" ? `Open Graph tag at ${Math.round(lastOgByte / 1024)} KB in HTML. Meta reads the first 1 MB` : `og 태그가 HTML ${Math.round(lastOgByte / 1024)}KB 지점 — Meta는 첫 1MB만 읽음`), "social-preview");
    if (/http-equiv\s*=\s*["']?refresh/i.test(html)) add("WARN", t("네이버", "Naver"), "meta refresh", t("있음 — 네이버 소유 확인·수집에서 해석하지 않음. HTTP 리다이렉트 사용", "Present. Naver does not interpret this for verification or crawling. Use an HTTP redirect"), "naver-search");
    const p = parseHtml(html);
    const { ogImage, pageNoindex } = checkPage(p, add, baseUrl, { robotsHeaders: page.robotsHeaders, expectIndexable });
    checkJsonLd(p.jsonLd, add);
    if (ogImage && /^https?:/i.test(ogImage)) await checkImage(ogImage, add, network);
    hreflang = reportHreflang(p, add, baseUrl);
    robots = await checkRobots(new URL(baseUrl), add, pageNoindex, expectIndexable, network);
  } else {
    html = await readFile(target, "utf8");
    const p = parseHtml(html);
    checkPage(p, add, null, { expectIndexable });
    hreflang = reportHreflang(p, add, null);
    checkJsonLd(p.jsonLd, add);
    add("INFO", t("공통", "General"), t("범위", "Scope"), t("로컬 파일: HTTP 헤더·robots.txt·리다이렉트·이미지 응답은 확인하지 않음", "Local file. HTTP headers, robots.txt, redirects and image responses were skipped"), "seo-orchestrator");
  }
  return { target, checkedAt: new Date().toISOString(), results, status, hreflang, robots };
}

function toMarkdown({ target, checkedAt, results }) {
  const icon = { FAIL: "❌", WARN: "⚠️", INFO: "ℹ️" };
  const order = { FAIL: 0, WARN: 1, INFO: 2 };
  const grouped = new Map();
  for (const r of results) {
    const key = [r.level, r.channel, r.item, r.detail].join("\u0000");
    const g = grouped.get(key);
    if (g) g.n++; else grouped.set(key, { ...r, n: 1 });
  }
  const rows = [...grouped.values()].sort((a, b) => order[a.level] - order[b.level]);
  const count = (l) => results.filter((r) => r.level === l).length;
  return [
    `## seo-check: ${target}`,
    (currentLocale() === "en" ? `Checked at ${checkedAt} · ❌ ${count("FAIL")} · ⚠️ ${count("WARN")} · ℹ️ ${count("INFO")}` : `확인 시각 ${checkedAt} · ❌ ${count("FAIL")} · ⚠️ ${count("WARN")} · ℹ️ ${count("INFO")}`),
    "",
    t("| 상태 | 채널 | 항목 | 내용 | Skill |", "| Status | Channel | Check | Details | Skill |"),
    "| --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${icon[r.level]} | ${r.channel} | ${r.item}${r.n > 1 ? ` ×${r.n}` : ""} | ${String(r.detail).replace(/\|/g, "\\|")} | ${r.skill} |`),
    "",
    t("단일 페이지 점검 결과입니다. 색인·순위·렌더링 결과는 Search Console·서치어드바이저 URL 검사로 확인하세요.", "This audit covers one page. Use URL inspection in Search Console or Naver Search Advisor to verify indexing, ranking and rendering."),
  ].join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      lang: { type: "string" },
      json: { type: "boolean" },
      "expect-indexable": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  return withLocale(values.lang ?? "ko", async () => {
    const help = t(
      "사용법: node scripts/seo-check.mjs <URL | HTML 파일> [--json] [--expect-indexable] [--lang en|ko]",
      "Usage: node scripts/seo-check.mjs <URL | HTML file> [--json] [--expect-indexable] [--lang en|ko]",
    );
    if (values.help) {
      console.log(help);
      return 0;
    }
    if (positionals.length !== 1) throw new Error(help);
    try {
      const report = await run(positionals[0], { expectIndexable: values["expect-indexable"] });
      console.log(values.json ? JSON.stringify(report, null, 2) : toMarkdown(report));
      return report.results.some((finding) => finding.level === "FAIL") ? 1 : 0;
    } catch (error) {
      throw new Error(t("오류: ", "Error: ") + error.message, { cause: error });
    }
  });
}

if (isCliEntry(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
