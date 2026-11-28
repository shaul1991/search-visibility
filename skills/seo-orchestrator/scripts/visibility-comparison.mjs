import { currentLocale, t } from "./locale.mjs";
import { html } from "./visibility-report.mjs";

const count = value => Number.isSafeInteger(value) && value >= 0;
const rate = value => value === null || (Number.isFinite(value) && value >= 0 && value <= 1);
const engineKey = name => name.normalize("NFKC").toLowerCase();

function snapshot(report, label) {
  const invalid = () => new Error(t(
    `${label} 입력은 유효한 v1 검색 가시성 report.json이어야 합니다.`,
    `The ${label} input must be a valid v1 Search Visibility report.json.`,
  ));
  if (report?.schemaVersion !== 1 || typeof report.generatedAt !== "string" ||
      !Array.isArray(report.site?.pages) || !Array.isArray(report.site.discoveryErrors) ||
      typeof report.site.truncated !== "boolean" || !Array.isArray(report.ai?.byEngine)) {
    throw invalid();
  }

  const site = { pages: report.site.pages.length, auditErrors: 0,
    discoveryErrors: report.site.discoveryErrors.length, truncated: report.site.truncated,
    fail: 0, warn: 0 };
  for (const page of report.site.pages) {
    if (!Array.isArray(page?.results) || typeof page.target !== "string") throw invalid();
    if (page.error) site.auditErrors++;
    for (const finding of page.results) {
      if (typeof finding?.level !== "string") throw invalid();
      if (finding.level === "FAIL") site.fail++;
      if (finding.level === "WARN") site.warn++;
    }
  }
  const targets = report.site.pages.map(page => page.target).sort();
  const search = report.searchPerformance;
  if (search !== null && (!count(search?.clicks) || !count(search?.impressions) ||
      !count(search?.rowCount) || typeof search.dimension !== "string" ||
      !(search.ctr === null || (Number.isFinite(search.ctr) && search.ctr >= 0)))) throw invalid();

  const engines = new Map();
  for (const row of report.ai.byEngine) {
    if (typeof row?.engine !== "string" || !row.engine.trim() || !count(row.sampleSize) ||
        !rate(row.mentionRate) || !rate(row.citationRate)) throw invalid();
    const key = engineKey(row.engine);
    if (engines.has(key)) throw invalid();
    engines.set(key, row);
  }
  const metadata = { generatedAt: report.generatedAt, brand: report.brand ?? "", sample: report.sample === true };
  return { metadata, site, targets, search, engines };
}

function change(before, after, comparable = true) {
  const delta = comparable && before !== null && after !== null ? after - before : null;
  return { before, after, delta };
}

export function compareReports(beforeReport, afterReport) {
  const before = snapshot(beforeReport, t("변경 전", "before"));
  const after = snapshot(afterReport, t("변경 후", "after"));
  const complete = site => site.pages > 0 && !site.auditErrors && !site.discoveryErrors && !site.truncated;
  const sameTargets = JSON.stringify(before.targets) === JSON.stringify(after.targets);
  const siteComparable = sameTargets && complete(before.site) && complete(after.site);
  const siteValue = (site, key) => site.pages > site.auditErrors ? site[key] : null;
  const searchComparable = Boolean(before.search && after.search && before.search.dimension === after.search.dimension);
  const keys = [...new Set([...before.engines.keys(), ...after.engines.keys()])].sort();
  return {
    schemaVersion: 1, kind: "comparison", locale: currentLocale(), generatedAt: new Date().toISOString(),
    before: before.metadata, after: after.metadata,
    site: {
      before: before.site, after: after.site, sameTargets, comparable: siteComparable,
      fail: change(siteValue(before.site, "fail"), siteValue(after.site, "fail"), siteComparable),
      warn: change(siteValue(before.site, "warn"), siteValue(after.site, "warn"), siteComparable),
    },
    searchPerformance: {
      dimensions: { before: before.search?.dimension ?? null, after: after.search?.dimension ?? null },
      comparable: searchComparable,
      impressions: change(before.search?.impressions ?? null, after.search?.impressions ?? null, searchComparable),
      clicks: change(before.search?.clicks ?? null, after.search?.clicks ?? null, searchComparable),
      ctr: change(before.search?.ctr ?? null, after.search?.ctr ?? null, searchComparable),
    },
    ai: { byEngine: keys.map(key => {
      const first = before.engines.get(key);
      const last = after.engines.get(key);
      return {
        engine: last?.engine ?? first.engine,
        sampleSize: change(first?.sampleSize ?? null, last?.sampleSize ?? null),
        mentionRate: change(first?.mentionRate ?? null, last?.mentionRate ?? null),
        citationRate: change(first?.citationRate ?? null, last?.citationRate ?? null),
      };
    }) },
  };
}

export function renderComparison({ before, after, site, searchPerformance: search, ai }) {
  const title = t("검색 가시성 전후 비교", "Search Visibility comparison");
  const beforeLabel = t("변경 전", "Before");
  const afterLabel = t("변경 후", "After");
  const format = new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 4 });
  const row = (label, metric, percentage = false) => {
    const cell = (value, delta = false) => {
      if (value === null) return "—";
      const sign = delta && value > 0 ? "+" : "";
      const suffix = percentage ? (delta ? t("%p", " pp") : "%") : "";
      return sign + format.format(percentage ? value * 100 : value) + suffix;
    };
    return `<tr><th scope="row">${html(label)}</th><td>${cell(metric.before)}</td><td>${cell(metric.after)}</td><td>${cell(metric.delta, true)}</td></tr>`;
  };
  const table = (caption, rows) => `<table><caption>${html(caption)}</caption><thead><tr><th scope="col">${t("지표", "Metric")}</th><th scope="col">${beforeLabel}</th><th scope="col">${afterLabel}</th><th scope="col">${t("증감", "Change")}</th></tr></thead><tbody>${rows}</tbody></table>`;
  const coverage = (label, key) => row(label, change(site.before[key], site.after[key], false));
  const source = (label, input) => `<li>${label} · ${html(input.generatedAt)} ${html(input.brand)} ${input.sample ? t("(합성 예시)", "(synthetic sample)") : ""}</li>`;
  return `<!doctype html>
<html lang="${currentLocale()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${title}</title><style>
body{font:1rem/1.5 system-ui,sans-serif;color:#14243a;background:#f4f7fa;margin:auto;max-width:56rem;padding:1rem}
table{width:100%;table-layout:fixed;border-collapse:collapse;background:white;margin:1rem 0;overflow-wrap:anywhere}
caption,th,td{padding:.55rem;text-align:right;border-bottom:1px solid #d8e0e9}
caption,th:first-child{text-align:left}caption{font-weight:bold;background:#dce8f2}
@media print{body{background:white}table{break-inside:avoid}}
</style></head><body><main><h1>${title}</h1><ul>${source(beforeLabel, before)}${source(afterLabel, after)}</ul>
<p>${t("—는 측정값 또는 비교값이 없음을 뜻합니다. 비율 증감은 퍼센트포인트입니다.", "A dash marks an unavailable value or change. Rate changes use percentage points.")}</p>
<section><h2>${t("사이트 진단", "Site audit")}</h2>
<p>${t("동일한 페이지를 양쪽에서 오류나 잘림 없이 점검했을 때 증감을 표시합니다.", "Changes require the same page targets and complete audits without errors or truncation.")}</p>
${table(t("발견 항목", "Findings"), row("FAIL", site.fail) + row("WARN", site.warn) +
    coverage(t("페이지 대상", "Page targets"), "pages") +
    coverage(t("페이지 점검 오류", "Page audit errors"), "auditErrors") +
    coverage(t("사이트맵 탐색 오류", "Sitemap discovery errors"), "discoveryErrors"))}</section>
<section><h2>Search Console</h2>
<p>${t("차원", "Dimensions")} · ${html(search.dimensions.before ?? "—")} → ${html(search.dimensions.after ?? "—")}</p>
<p>${t("같은 속성, 차원, 필터 및 동일한 길이의 기간을 사용하세요.", "Use the same property, dimension, filters and period length.")}</p>
${table(t("검색 실적", "Search performance"), row(t("노출수", "Impressions"), search.impressions) + row(t("클릭수", "Clicks"), search.clicks) + row("CTR", search.ctr, true))}</section>
<section><h2>${t("엔진별 AI 답변 관측", "AI answer observations by engine")}</h2>
<p>${t("같은 질문, 수집 조건 및 소유 출처 설정의 표본끼리 비교하세요.", "Compare samples with the same questions, collection conditions and source ownership settings.")}</p>
${ai.byEngine.length ? ai.byEngine.map(engine => table(engine.engine,
    row(t("관측 답변", "Observed answers"), engine.sampleSize) +
    row(t("브랜드 언급률", "Brand mention rate"), engine.mentionRate, true) +
    row(t("소유 출처 인용률", "Owned-source citation rate"), engine.citationRate, true))).join("\n")
    : `<p>${t("관측 답변 없음", "No observed answers")}</p>`}</section></main></body></html>\n`;
}
