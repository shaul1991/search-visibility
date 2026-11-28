import { t, currentLocale } from "./locale.mjs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { fetchResource } from "./fetch-page.mjs";
import { run, UA } from "./seo-check.mjs";

const MAX_SITEMAPS = 10;
const SITEMAP_BYTES = 2 * 1024 * 1024;
const PAGE_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

function webUrl(raw) {
  if (typeof raw !== "string" || !/^https?:\/\//i.test(raw)) throw new Error(t("HTTP(S) 절대 URL을 입력하세요.", "Enter an absolute HTTP(S) URL."));
  const url = new URL(raw);
  if (url.username || url.password) throw new Error(t("인증정보가 포함된 URL은 사용할 수 없습니다.", "URLs with credentials are not supported."));
  url.hash = "";
  return url;
}

function decodeLocation(text) {
  const entities = { amp: "&", lt: "<", gt: ">", apos: "'", quot: '"' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|apos|quot);/gi, (_, name) => {
    if (name[0] !== "#") return entities[name] ?? _;
    return String.fromCodePoint(name[1] === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  });
}

// Extract only the direct loc child of url or sitemap, excluding image/video extensions.
function parseSitemap(xml) {
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[\w:.-]+(?:\s+[^<>]*?)?\s*\/?>|[^<]+/gy;
  const stack = [];
  const locations = [];
  let type, entry, location, offset = 0;
  const invalid = () => new Error(t("사이트맵 XML 구조를 읽을 수 없습니다.", "Invalid sitemap XML structure."));
  while (offset < xml.length) {
    const match = tokens.exec(xml);
    if (!match) throw invalid();
    offset = tokens.lastIndex;
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (!token.startsWith("<") || token.startsWith("<![CDATA[")) {
      if (location !== undefined) location += token.startsWith("<") ? token.slice(9, -3) : decodeLocation(token);
      else if (!stack.length && token.trim()) throw invalid();
      continue;
    }
    const [, closing, tag] = /^<(\/?)([\w:.-]+)/.exec(token);
    const local = tag.split(":").pop();
    if (closing) {
      if (stack.pop() !== tag) throw invalid();
      if (location !== undefined && stack.length === 2) {
        locations.push(location.trim());
        location = undefined;
      }
      continue;
    }
    if (location !== undefined || stack.length >= 128) throw invalid();
    if (!stack.length) {
      if (type || !["sitemapindex", "urlset"].includes(local)) throw invalid();
      type = local;
      entry = type === "urlset" ? "url" : "sitemap";
    }
    if (token.endsWith("/>")) continue;
    if (stack.length === 2 && stack[1].split(":").pop() === entry && local === "loc") location = "";
    stack.push(tag);
  }
  if (stack.length || !type) throw invalid();
  return { type, locations };
}

async function discover(root, selected, report) {
  const origin = root.origin;
  const queue = [root.href];
  const seen = new Set(queue);
  let skipped = 0, cappedSitemaps = false;
  while (queue.length) {
    if (selected.size >= report.limit) {
      report.truncated = true;
      break;
    }
    const target = queue.shift();
    try {
      const res = await fetchResource(target, UA, {
        allowedOrigin: origin, maxBytes: SITEMAP_BYTES, signal: AbortSignal.timeout(TIMEOUT_MS), accept: "application/xml,text/xml,*/*",
      });
      if (res.status !== 200) throw new Error((currentLocale() === "en" ? `Sitemap HTTP ${res.status}` : `사이트맵 HTTP ${res.status}`));
      // .xml.gz files may also be served without a Content-Encoding header.
      const bytes = res.bytes[0] === 0x1f && res.bytes[1] === 0x8b ? gunzipSync(res.bytes, { maxOutputLength: SITEMAP_BYTES }) : res.bytes;
      const { type, locations } = parseSitemap(new TextDecoder().decode(bytes));
      report.sitemapsRead++;
      for (const raw of locations) {
        let url;
        try { url = webUrl(raw); } catch { skipped++; continue; }
        if (url.origin !== origin) { skipped++; continue; }
        if (type === "sitemapindex") {
          if (seen.has(url.href)) continue;
          if (seen.size >= MAX_SITEMAPS) { cappedSitemaps = true; continue; }
          seen.add(url.href);
          queue.push(url.href);
        } else if (!selected.has(url.href)) {
          if (selected.size >= report.limit) { report.truncated = true; break; }
          selected.set(url.href, { target: url.href, allowedOrigin: origin });
        }
      }
    } catch (error) {
      report.discoveryErrors.push({ target, error: error.message });
      report.warnings.push((currentLocale() === "en" ? `Could not read sitemap ${target} — ${error.message}` : `사이트맵 ${target} 확인 실패 — ${error.message}`));
    }
  }
  if (skipped) report.warnings.push((currentLocale() === "en" ? `Skipped ${skipped} sitemap entries because they were outside the sitemap origin or not valid HTTP(S) URLs.` : `다른 출처이거나 올바른 HTTP(S) URL이 아닌 사이트맵 항목 ${skipped}개를 생략했습니다.`));
  if (cappedSitemaps) {
    report.truncated = true;
    report.warnings.push((currentLocale() === "en" ? `Sitemap discovery is limited to ${MAX_SITEMAPS} documents.` : `사이트맵 탐색은 최대 ${MAX_SITEMAPS}개 문서까지입니다.`));
  }
}

export async function auditSite({ targets = [], sitemap, baseDir = process.cwd(), limit = 25, expectIndexable = false } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error(t("limit은 1~100 사이 정수여야 합니다.", "limit must be an integer from 1 to 100."));
  if (!Array.isArray(targets)) throw new Error(t("targets는 URL 또는 로컬 HTML 경로의 배열이어야 합니다.", "targets must be an array of URLs or local HTML paths."));
  if (typeof baseDir !== "string" || !baseDir) throw new Error(t("baseDir에는 디렉터리 경로를 지정하세요.", "baseDir must be a directory path."));
  if (typeof expectIndexable !== "boolean") throw new Error(t("expectIndexable은 true 또는 false여야 합니다.", "expectIndexable must be true or false."));
  const root = sitemap === undefined ? null : webUrl(sitemap);
  const selected = new Map();
  const report = { pages: [], limit, truncated: false, sitemapsRead: 0, discoveryErrors: [], warnings: [] };
  for (const input of targets) {
    if (typeof input !== "string" || !input.trim()) throw new Error(t("targets 항목에 빈 값이 있습니다.", "targets contains an empty entry."));
    const target = input.trim();
    const windowsDrive = /^[a-z]:[\\/]/i.test(target);
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(target) && !windowsDrive;
    if (target.startsWith("//")) throw new Error(t("웹 주소는 http:// 또는 https://로 시작해야 합니다.", "Web addresses must start with http:// or https://."));
    const source = hasScheme ? webUrl(target).href : resolve(baseDir, target);
    if (selected.has(source)) continue;
    if (selected.size >= limit) report.truncated = true;
    else selected.set(source, { target: hasScheme ? source : target, local: !hasScheme });
  }
  if (root) await discover(root, selected, report);
  if (report.truncated && selected.size >= limit) report.warnings.push((currentLocale() === "en" ? `Selected up to ${limit} pages to audit. Split the targets across runs to cover the full set.` : `최대 ${limit}페이지까지 선택하여 점검했습니다. 전체 범위를 확인하려면 대상을 나눠 실행하세요.`));
  if (root && !selected.size && !report.discoveryErrors.length) report.warnings.push(t("사이트맵에서 점검할 페이지를 찾지 못했습니다.", "The sitemap contained no pages to audit."));

  for (const [source, { target, local, allowedOrigin }] of selected) {
    try {
      if (local) {
        const file = await stat(source);
        if (!file.isFile() || file.size > PAGE_BYTES) throw new Error((currentLocale() === "en" ? `Local HTML must be a regular file of at most ${PAGE_BYTES} bytes.` : `로컬 HTML은 ${PAGE_BYTES}바이트 이하의 일반 파일이어야 합니다.`));
      }
      const network = { allowedOrigin, maxBytes: PAGE_BYTES, signal: AbortSignal.timeout(TIMEOUT_MS) };
      const page = await run(source, { expectIndexable, network });
      report.pages.push({ ...page, target });
    } catch (error) {
      report.pages.push({ target, results: [], error: error.message });
    }
  }
  return report;
}
