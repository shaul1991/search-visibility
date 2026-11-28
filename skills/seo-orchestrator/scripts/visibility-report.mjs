import { currentLocale, t, withLocale } from "./locale.mjs";

const escapeChars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const formats = Object.fromEntries(["ko", "en"].map((locale) => {
  const tag = locale === "ko" ? "ko-KR" : "en-US";
  return [locale, {
    percent: new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 1 }),
    number: new Intl.NumberFormat(tag),
  }];
}));

function number(value) {
  return formats[currentLocale()].number.format(value);
}

export function html(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => escapeChars[char]);
}

function sourceLink(source) {
  try {
    const url = new URL(source);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
      return `<a href="${html(url.href)}" rel="noreferrer">${html(source)}</a>`;
    }
  } catch {
    // A saved report can also contain a source that is no longer a usable URL.
  }
  return html(source);
}

const styles = `
  :root { color-scheme: light; --ink: #192c29; --muted: #455d57; --line: #c7d5cb; --paper: #f7f9f5; --accent: #075b45; }
  * { box-sizing: border-box; }
  body { margin: 0; color: var(--ink); background: var(--paper); font: 1rem/1.65 "Atkinson Hyperlegible Next","Apple SD Gothic Neo","Malgun Gothic",sans-serif; overflow-wrap: anywhere; }
  .sheet { width: min(70rem, 100%); margin: 0 auto; padding: 0 clamp(1rem, 4vw, 3rem); }
  header { border-top: .45rem solid #278564; padding: 2rem 0; background: #183b32; color: #fff; }
  .product { font-weight: 700; letter-spacing: .04em; }
  h1 { margin: .65rem 0 .3rem; line-height: 1.25; font-size: clamp(1.85rem, 4.5vw, 3.35rem); }
  h2 { margin: 0 0 .65rem; font-size: clamp(1.35rem, 2.6vw, 1.85rem); line-height: 1.4; }
  h3 { margin: 1.5rem 0 .5rem; font-size: 1.1rem; }
  p { margin: .4rem 0; }
  header p { color: #d5e7dd; }
  .sample { font-weight: 700; color: #ffdf96; }
  main.sheet { padding-bottom: 3rem; }
  nav { display: flex; flex-wrap: wrap; gap: .4rem 1.15rem; padding: 1rem 0 .65rem; border-bottom: 1px solid var(--line); }
  nav a { font-weight: 600; }
  section { margin: 2.25rem 0 0; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: .85rem; margin: 1rem 0 0; }
  .metrics > div { background: #fff; border: 1px solid var(--line); border-radius: .7rem; padding: 1rem 1.15rem; }
  dt { color: var(--muted); font-weight: 600; }
  dd { margin: .2rem 0 0; font-size: 1.75rem; font-weight: 700; line-height: 1.4; font-variant-numeric: tabular-nums; }
  dd small { display: block; font-size: .9rem; font-weight: 400; color: var(--muted); }
  details { margin: .55rem 0; padding: .7rem 1rem; border: 1px solid var(--line); border-radius: .55rem; background: #fff; }
  summary { cursor: pointer; font-weight: 600; }
  summary small { font-size: .85rem; font-weight: 400; color: var(--muted); }
  a { color: var(--accent); text-underline-offset: .2em; }
  :focus-visible { outline: 3px solid #0c7154; outline-offset: 3px; }
  ul { margin: .45rem 0; padding-inline-start: 1.4rem; }
  .findings { list-style: none; padding: 0; margin: .75rem 0 0; }
  .findings li { border-top: 1px solid var(--line); padding: .65rem 0; }
  .findings p { margin: .15rem 0 0; }
  .tag { display: inline-block; padding: .05rem .45rem; margin-inline-end: .35rem; border-radius: .3rem; background: #e8efea; color: #364b44; font-size: .75rem; font-weight: 700; }
  .fail { color: #822f2b; background: #f9e5df; }
  .warn { color: #694411; background: #fcf0cf; }
  .muted, .note { color: var(--muted); }
  .notice { padding: .65rem 1rem; border-inline-start: .25rem solid #aa7728; background: #fbf1d9; }
  code { font: .9rem "IBM Plex Mono",ui-monospace,monospace; }
  table { width: 100%; border-collapse: collapse; margin: .75rem 0; font-variant-numeric: tabular-nums; }
  caption { text-align: start; font-weight: 700; margin: .25rem 0; }
  th, td { border-bottom: 1px solid var(--line); padding: .6rem; text-align: start; vertical-align: top; }
  thead { background: #e8efea; }
  @media (max-width: 35rem) { th, td { padding: .4rem .2rem; font-size: .88rem; } details { padding: .65rem; } }
  @media print { body { background: white; font-size: 10pt; } header { color: black; background: white; padding: .75rem 0; } header p { color: #444; } section { margin-top: 1rem; } summary, h2, h3 { break-after: avoid; } .metrics > div { break-inside: avoid; } }
`;

const priorities = new Map([["FAIL", 0], ["WARN", 1], ["INFO", 2], ["PASS", 3]]);

function findingsList(results) {
  const ranked = [...results].sort((a, b) => (priorities.get(a.level) ?? 4) - (priorities.get(b.level) ?? 4));
  return `<ul class="findings">${ranked.map((entry) => {
    const tone = entry.level === "FAIL" ? " fail" : entry.level === "WARN" ? " warn" : "";
    return `<li><span class="tag${tone}">${html(entry.level)}</span>
      <strong>${html(entry.item)}</strong> <span class="muted">${html(entry.channel)}</span>
      <p>${html(entry.detail)}</p>${entry.skill ? `<small>${t("관련 스킬", "Related skill")} <code>${html(entry.skill)}</code></small>` : ""}</li>`;
  }).join("")}</ul>`;
}

function pageDetails(page) {
  const results = page.results ?? [];
  if (page.error) {
    return `<details open><summary>${html(page.target)} <small>· ${t("점검 오류", "Audit error")}</small></summary>
      <p class="notice">${html(page.error)}</p></details>`;
  }
  const fails = results.filter((r) => r.level === "FAIL").length;
  const warnings = results.filter((r) => r.level === "WARN").length;
  return `<details><summary>${html(page.target)} <small>· ${currentLocale() === "en" ? `${number(fails)} failures · ${number(warnings)} warnings` : `실패 ${fails}건 · 경고 ${warnings}건`}</small></summary>
    ${results.length ? findingsList(results) : `<p>${t("수집된 진단 항목이 없습니다.", "No checks were collected.")}</p>`}</details>`;
}

function siteSection(site) {
  const notices = site.warnings ?? [];
  const discoveryErrors = site.discoveryErrors ?? [];
  return `<section aria-labelledby="pages"><h2 id="pages">${t("페이지별 기술 진단", "Technical checks by page")}</h2>
    ${notices.length ? `<div class="notice"><strong>${t("점검 범위 안내", "Audit scope")}</strong><ul>${notices.map((s) => `<li>${html(s)}</li>`).join("")}</ul></div>` : ""}
    ${site.truncated ? `<p class="note">${t("수집 상한에 도달해 일부 대상만 점검했습니다.", "The collection limit was reached. Only some targets were audited.")}</p>` : ""}
    ${discoveryErrors.length ? `<details><summary>${currentLocale() === "en" ? `Sitemap collection errors: ${number(discoveryErrors.length)}` : `사이트맵 수집 오류 ${discoveryErrors.length}건`}</summary>
      <ul>${discoveryErrors.map((entry) => `<li>${html(entry.target)} · ${html(entry.error)}</li>`).join("")}</ul></details>` : ""}
    ${site.pages.length ? site.pages.map(pageDetails).join("") : `<p>${t("이번 실행에서 점검한 페이지가 없습니다.", "No pages were audited in this run.")}</p>`}</section>`;
}

function rateText(rate) {
  return Number.isFinite(rate) ? formats[currentLocale()].percent.format(rate) : t("측정 안 됨", "Not measured");
}

function countText(count, sample, rate) {
  if (!sample) return t("관측 답변 없음", "No observed answers");
  if (!Number.isFinite(rate)) return t("측정 안 됨", "Not measured");
  return `${number(count)} / ${number(sample)}${t("개 답변", " answers")}`;
}

function rateCell(rate, count, sample) {
  if (!Number.isFinite(rate) || !sample) return t("측정 안 됨", "Not measured");
  return `${rateText(rate)} (${number(count)}/${number(sample)})`;
}

function observationRow(record) {
  const mentions = record.mentioned ? t("브랜드 언급 있음", "Brand mentioned") : t("브랜드 언급 없음", "Brand absent");
  const citation = record.cited == null ? t("소유 출처 인용 측정 안 됨", "Owned citations not measured") : record.cited ? t("소유 출처 인용 있음", "Owned source cited") : t("소유 출처 인용 없음", "No owned source cited");
  const context = [record.model, record.locale].filter(Boolean).map(html).join(" · ");
  const matched = new Set(record.matchedSources ?? []);
  const sources = new Set([...(record.sources ?? []), ...matched]);
  return `<details><summary>${html(record.engine)} · ${html(record.query)}</summary>
    <p class="muted">${t("관측 시각", "Observed at")} <time>${html(record.observedAt)}</time>${context ? ` · ${context}` : ""}</p>
    <p>${mentions}${record.matchedTerms?.length ? ` (${record.matchedTerms.map(html).join(", ")})` : ""} · ${citation}</p>
    ${sources.size ? `<p>${t("답변의 인용 출처", "Sources cited in the answer")}</p><ul>${[...sources].map((s) => `<li>${sourceLink(s)}${matched.has(s) ? t(" · 소유 출처", " · Owned source") : ""}</li>`).join("")}</ul>` : `<p>${t("기록한 인용 출처가 없습니다.", "No citations were recorded.")}</p>`}
    ${record.evidenceUrl ? `<p>${t("답변 근거 링크", "Answer evidence")} · ${sourceLink(record.evidenceUrl)}</p>` : ""}</details>`;
}

function observationSection(ai) {
  if (!ai.sampleSize) {
    return `<section aria-labelledby="answers"><h2 id="answers">${t("AI 답변 관측", "AI answer observations")}</h2><p>${t("기록한 답변이 없습니다. 관측한 질문·답변과 인용 URL을 추가하면 엔진별 결과를 볼 수 있습니다.", "No answers were recorded. Add observed questions, answers and citation URLs to see results by engine.")}</p></section>`;
  }
  return `<section aria-labelledby="answers"><h2 id="answers">${t("AI 답변 관측", "AI answer observations")}</h2>
    <p>${currentLocale() === "en" ? `Brand mentions and owned-source citations are counted across ${number(ai.sampleSize)} supplied answers.` : `입력한 답변 ${html(ai.sampleSize)}개를 기준으로 브랜드 언급과 소유 출처 인용을 집계합니다.`}</p>
    ${ai.citationRate == null ? `<p class="notice">${t("인용을 집계할 도메인이나 계정 URL 경로가 지정되지 않았습니다.", "Specify domains or account URL prefixes to measure owned citations.")}</p>` : ""}
    <table><caption>${t("엔진별 관측 결과", "Observations by engine")}</caption><thead><tr><th scope="col">${t("엔진", "Engine")}</th><th scope="col">${t("답변 수", "Answers")}</th><th scope="col">${t("브랜드 언급률", "Brand mention rate")}</th><th scope="col">${t("소유 출처 인용률", "Owned-source citation rate")}</th></tr></thead><tbody>
    ${ai.byEngine.map((row) => `<tr><th scope="row">${html(row.engine)}</th><td>${number(row.sampleSize)}</td>
      <td>${rateCell(row.mentionRate, row.mentions, row.sampleSize)}</td>
      <td>${rateCell(row.citationRate, row.citations, row.sampleSize)}</td></tr>`).join("")}</tbody></table>
    <h3>${t("질문별 근거", "Evidence by question")}</h3>${ai.records.map(observationRow).join("")}</section>`;
}

function searchSection(performance) {
  const heading = `<h2 id="search">${t("Google 검색 실적", "Google Search performance")}</h2>`;
  if (!performance || !performance.rowCount) {
    const message = performance ? t("가져온 CSV에 집계할 행이 없습니다.", "The imported CSV has no rows.") : t("Search Console 실적 CSV를 추가하면 노출과 클릭을 확인할 수 있습니다.", "Add a Search Console performance CSV to see impressions and clicks.");
    return `<section aria-labelledby="search">${heading}<p>${message}</p></section>`;
  }

  const labels = { page: t("페이지", "Page"), query: t("검색어", "Query"), date: t("날짜", "Date") };
  const dimension = labels[performance.dimension] ?? t("항목", "Entry");
  const ordered = [...performance.rows].sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
  const top = ordered.slice(0, 10);
  return `<section aria-labelledby="search">${heading}
    <p>${currentLocale() === "en" ? `Totals cover ${number(performance.rowCount)} imported CSV rows grouped by ${html(dimension.toLowerCase())}.` : `가져온 CSV의 ${html(dimension)}별 ${html(performance.rowCount)}개 행을 합산했습니다.`}</p>
    <dl class="metrics">
      <div><dt>${t("노출", "Impressions")}</dt><dd>${number(performance.impressions)}${t("회", "")}</dd></div>
      <div><dt>${t("클릭", "Clicks")}</dt><dd>${number(performance.clicks)}${t("회", "")}</dd></div>
      <div><dt>${t("클릭률", "CTR")}</dt><dd>${rateText(performance.ctr)}</dd></div>
    </dl><table><caption>${currentLocale() === "en" ? `Top ${number(top.length)} entries by impressions` : `노출 순 ${html(dimension)} ${top.length}개`}</caption>
    <thead><tr><th scope="col">${html(dimension)}</th><th scope="col">${t("노출", "Impressions")}</th><th scope="col">${t("클릭", "Clicks")}</th></tr></thead>
    <tbody>${top.map((row) => `<tr><th scope="row">${html(row.label)}</th><td>${number(row.impressions)}</td><td>${number(row.clicks)}</td></tr>`).join("")}</tbody>
    </table></section>`;
}

export function renderReport(report) {
  return withLocale(report.locale ?? "ko", () => renderLocalizedReport(report));
}

function renderLocalizedReport({ brand, generatedAt, site, ai, searchPerformance, sample = false }) {
  const failedPages = site.pages.filter((p) => p.error).length;
  const title = t("검색 가시성 보고서", "Search Visibility Report");
  const brandTitle = brand ? `${html(brand)}${t(" ", " · ")}${title}` : title;
  return `<!doctype html>
<html lang="${currentLocale()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${brandTitle} · Search Visibility</title><style>${styles}</style></head>
<body><header><div class="sheet"><div class="product" lang="en">Search Visibility</div><h1>${brandTitle}</h1>
${sample === true ? `<p class="sample">${t("이 보고서는 합성 예시 데이터로 생성했습니다.", "This report uses synthetic sample data.")}</p>` : ""}
<p>${t("생성 시각", "Generated at")} <time>${html(generatedAt)}</time></p></div></header>
<main class="sheet"><nav aria-label="${t("보고서 섹션", "Report sections")}"><a href="#pages">${t("페이지 진단", "Page audit")}</a><a href="#search">${t("Google 검색 실적", "Google Search performance")}</a><a href="#answers">${t("AI 답변 관측", "AI answer observations")}</a></nav>
<section aria-labelledby="overview"><h2 id="overview">${t("점검 요약", "Overview")}</h2><dl class="metrics">
  <div><dt>${t("페이지 점검 완료", "Pages audited")}</dt><dd>${number(site.pages.length - failedPages)}${t("개", "")}<small>${currentLocale() === "en" ? `${number(site.pages.length)} targets · ${number(failedPages)} audit errors` : `대상 ${number(site.pages.length)}개 · 점검 오류 ${number(failedPages)}개`}</small></dd></div>
  <div><dt>${t("브랜드 언급률", "Brand mention rate")}</dt><dd>${rateText(ai.mentionRate)}<small>${countText(ai.mentions, ai.sampleSize, ai.mentionRate)}</small></dd></div>
  <div><dt>${t("소유 출처 인용률", "Owned-source citation rate")}</dt><dd>${rateText(ai.citationRate)}<small>${countText(ai.citations, ai.sampleSize, ai.citationRate)}</small></dd></div>
</dl></section>${siteSection(site)}${searchSection(searchPerformance)}${observationSection(ai)}</main></body></html>\n`;
}
