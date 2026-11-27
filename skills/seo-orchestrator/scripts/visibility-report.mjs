const escapeChars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const percent = new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 });

function html(value) {
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
      <p>${html(entry.detail)}</p>${entry.skill ? `<small>관련 스킬 <code>${html(entry.skill)}</code></small>` : ""}</li>`;
  }).join("")}</ul>`;
}

function pageDetails(page) {
  const results = page.results ?? [];
  if (page.error) {
    return `<details open><summary>${html(page.target)} <small>· 점검 오류</small></summary>
      <p class="notice">${html(page.error)}</p></details>`;
  }
  const fails = results.filter((r) => r.level === "FAIL").length;
  const warnings = results.filter((r) => r.level === "WARN").length;
  return `<details><summary>${html(page.target)} <small>· 실패 ${fails}건 · 경고 ${warnings}건</small></summary>
    ${results.length ? findingsList(results) : "<p>수집된 진단 항목이 없습니다.</p>"}</details>`;
}

function siteSection(site) {
  const notices = site.warnings ?? [];
  const discoveryErrors = site.discoveryErrors ?? [];
  return `<section aria-labelledby="pages"><h2 id="pages">페이지별 기술 진단</h2>
    ${notices.length ? `<div class="notice"><strong>점검 범위 안내</strong><ul>${notices.map((s) => `<li>${html(s)}</li>`).join("")}</ul></div>` : ""}
    ${site.truncated ? `<p class="note">수집 상한에 도달해 일부 대상만 점검했습니다.</p>` : ""}
    ${discoveryErrors.length ? `<details><summary>사이트맵 수집 오류 ${discoveryErrors.length}건</summary>
      <ul>${discoveryErrors.map((entry) => `<li>${html(entry.target)} · ${html(entry.error)}</li>`).join("")}</ul></details>` : ""}
    ${site.pages.length ? site.pages.map(pageDetails).join("") : "<p>이번 실행에서 점검한 페이지가 없습니다.</p>"}</section>`;
}

function rateText(rate) {
  return Number.isFinite(rate) ? percent.format(rate) : "측정 안 됨";
}

function countText(count, sample, rate) {
  if (!sample) return "관측 답변 없음";
  if (!Number.isFinite(rate)) return "측정 안 됨";
  return `${html(count)} / ${html(sample)}개 답변`;
}

function rateCell(rate, count, sample) {
  if (!Number.isFinite(rate) || !sample) return "측정 안 됨";
  return `${rateText(rate)} (${html(count)}/${html(sample)})`;
}

function observationRow(record) {
  const mentions = record.mentioned ? "브랜드 언급 있음" : "브랜드 언급 없음";
  const citation = record.cited == null ? "소유 출처 인용 측정 안 됨" : record.cited ? "소유 출처 인용 있음" : "소유 출처 인용 없음";
  const context = [record.model, record.locale].filter(Boolean).map(html).join(" · ");
  const matched = new Set(record.matchedSources ?? []);
  const sources = new Set([...(record.sources ?? []), ...matched]);
  return `<details><summary>${html(record.engine)} · ${html(record.query)}</summary>
    <p class="muted">관측 시각 <time>${html(record.observedAt)}</time>${context ? ` · ${context}` : ""}</p>
    <p>${mentions}${record.matchedTerms?.length ? ` (${record.matchedTerms.map(html).join(", ")})` : ""} · ${citation}</p>
    ${sources.size ? `<p>답변의 인용 출처</p><ul>${[...sources].map((s) => `<li>${sourceLink(s)}${matched.has(s) ? " · 소유 출처" : ""}</li>`).join("")}</ul>` : "<p>기록한 인용 출처가 없습니다.</p>"}
    ${record.evidenceUrl ? `<p>답변 근거 링크 · ${sourceLink(record.evidenceUrl)}</p>` : ""}</details>`;
}

function observationSection(ai) {
  if (!ai.sampleSize) {
    return '<section aria-labelledby="answers"><h2 id="answers">AI 답변 관측</h2><p>기록한 답변이 없습니다. 관측한 질문·답변과 인용 URL을 추가하면 엔진별 결과를 볼 수 있습니다.</p></section>';
  }
  return `<section aria-labelledby="answers"><h2 id="answers">AI 답변 관측</h2>
    <p>입력한 답변 ${html(ai.sampleSize)}개를 기준으로 브랜드 언급과 소유 출처 인용을 집계합니다.</p>
    ${ai.citationRate == null ? '<p class="notice">인용을 집계할 도메인이나 계정 URL 경로가 지정되지 않았습니다.</p>' : ""}
    <table><caption>엔진별 관측 결과</caption><thead><tr><th scope="col">엔진</th><th scope="col">답변 수</th><th scope="col">브랜드 언급률</th><th scope="col">소유 출처 인용률</th></tr></thead><tbody>
    ${ai.byEngine.map((row) => `<tr><th scope="row">${html(row.engine)}</th><td>${html(row.sampleSize)}</td>
      <td>${rateCell(row.mentionRate, row.mentions, row.sampleSize)}</td>
      <td>${rateCell(row.citationRate, row.citations, row.sampleSize)}</td></tr>`).join("")}</tbody></table>
    <h3>질문별 근거</h3>${ai.records.map(observationRow).join("")}</section>`;
}

function searchSection(performance) {
  const heading = '<h2 id="search">Google 검색 실적</h2>';
  if (!performance || !performance.rowCount) {
    const message = performance ? "가져온 CSV에 집계할 행이 없습니다." : "Search Console 실적 CSV를 추가하면 노출과 클릭을 확인할 수 있습니다.";
    return `<section aria-labelledby="search">${heading}<p>${message}</p></section>`;
  }

  const labels = { page: "페이지", query: "검색어", date: "날짜" };
  const dimension = labels[performance.dimension] ?? "항목";
  const ordered = [...performance.rows].sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
  const top = ordered.slice(0, 10);
  return `<section aria-labelledby="search">${heading}
    <p>가져온 CSV의 ${html(dimension)}별 ${html(performance.rowCount)}개 행을 합산했습니다.</p>
    <dl class="metrics">
      <div><dt>노출</dt><dd>${html(performance.impressions)}회</dd></div>
      <div><dt>클릭</dt><dd>${html(performance.clicks)}회</dd></div>
      <div><dt>클릭률</dt><dd>${rateText(performance.ctr)}</dd></div>
    </dl><table><caption>노출 순 ${html(dimension)} ${top.length}개</caption>
    <thead><tr><th scope="col">${html(dimension)}</th><th scope="col">노출</th><th scope="col">클릭</th></tr></thead>
    <tbody>${top.map((row) => `<tr><th scope="row">${html(row.label)}</th><td>${html(row.impressions)}</td><td>${html(row.clicks)}</td></tr>`).join("")}</tbody>
    </table></section>`;
}

export function renderReport({ brand, generatedAt, site, ai, searchPerformance, sample = false }) {
  const failedPages = site.pages.filter((p) => p.error).length;
  const brandTitle = brand ? `${html(brand)} 검색 가시성` : "검색 가시성";
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${brandTitle} 보고서 · Search Visibility</title><style>${styles}</style></head>
<body><header><div class="sheet"><div class="product" lang="en">Search Visibility</div><h1>${brandTitle} 보고서</h1>
${sample === true ? '<p class="sample">이 보고서는 합성 예시 데이터로 생성했습니다.</p>' : ""}
<p>생성 시각 <time>${html(generatedAt)}</time></p></div></header>
<main class="sheet"><nav aria-label="보고서 섹션"><a href="#pages">페이지 진단</a><a href="#search">Google 검색 실적</a><a href="#answers">AI 답변 관측</a></nav>
<section aria-labelledby="overview"><h2 id="overview">점검 요약</h2><dl class="metrics">
  <div><dt>페이지 점검 완료</dt><dd>${site.pages.length - failedPages}개<small>대상 ${site.pages.length}개 · 점검 오류 ${failedPages}개</small></dd></div>
  <div><dt>브랜드 언급률</dt><dd>${rateText(ai.mentionRate)}<small>${countText(ai.mentions, ai.sampleSize, ai.mentionRate)}</small></dd></div>
  <div><dt>소유 출처 인용률</dt><dd>${rateText(ai.citationRate)}<small>${countText(ai.citations, ai.sampleSize, ai.citationRate)}</small></dd></div>
</dl></section>${siteSection(site)}${searchSection(searchPerformance)}${observationSection(ai)}</main></body></html>\n`;
}
