import { domainToASCII } from "node:url";

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field}에는 문자열을 입력하세요.`);
  return value.trim();
}

function list(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field}에는 배열을 입력하세요.`);
  return value;
}

function parseSource(value, field) {
  const text = requiredText(value, field);
  let url;
  try {
    if (/^https?:\/\//i.test(text) && !/[\s\\]/u.test(text)) url = new URL(text);
  } catch { /* 공통 입력 오류에 필드 위치를 포함한다. */ }
  if (!url || url.username || url.password) throw new Error(`${field}에는 HTTP(S) 출처 URL을 입력하세요.`);
  return url;
}

function canonicalDomain(value) {
  const input = requiredText(value, "domains");
  // domainToASCII also accepts some URL delimiters and strips the suffix.
  if (/[\s:/@?#%\\]/u.test(input)) throw new Error(`domains에는 URL 대신 호스트명을 입력하세요: ${input}`);
  const domain = domainToASCII(input).replace(/\.$/, "");
  const labels = domain.split(".");
  if (domain.length > 253 || labels.length < 2 ||
      !labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error(`domains의 호스트명이 유효하지 않습니다: ${input}`);
  }
  return domain;
}

function comparablePath(url) {
  // Decode only unreserved characters: an encoded slash is data, not a segment boundary.
  return url.pathname.replace(/%([0-9a-f]{2})/gi, (escape, hex) => {
    const char = String.fromCharCode(parseInt(hex, 16));
    return /^[a-z0-9._~-]$/i.test(char) ? char : escape.toUpperCase();
  });
}

function ownedPrefix(value) {
  const url = parseSource(value, "ownedUrlPrefixes");
  if (/[?#]/.test(url.href) || !/[^/]/.test(url.pathname) || /%(?![a-f\d]{2})/i.test(url.pathname)) {
    throw new Error("ownedUrlPrefixes에는 쿼리·프래그먼트 없는 유효한 계정 경로 URL을 입력하세요.");
  }
  return { origin: url.origin, path: comparablePath(url).replace(/\/$/, "") };
}

function observationDate(value, field) {
  const text = requiredText(value, field);
  const date = text.slice(0, 10);
  const validFormat = /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/i;
  const midnight = Date.parse(date + "T00:00:00Z");
  if (!validFormat.test(text) || !Number.isFinite(Date.parse(text)) || !Number.isFinite(midnight) ||
      new Date(midnight).toISOString().slice(0, 10) !== date) {
    throw new Error(`${field}에는 실제 날짜(YYYY-MM-DD) 또는 시간대가 있는 ISO 일시를 입력하세요.`);
  }
  return text;
}

function termPattern(term) {
  const escaped = term.normalize("NFKC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = "[\\p{L}\\p{N}\\p{M}_]";
  // 한글 조사까지 하나의 경계로 처리한다. '가온은'은 가온의 언급이지만 '가온누리'는 별개다.
  const particle = "(?:은|는|이|가|을|를|의|에|에서|에게|와|과|도|로|으로|만|까지|부터|처럼|보다|입니다|이다)";
  return new RegExp(`(?<!${word})${escaped}(?=(?:${particle})?(?!${word}))`, "iu");
}

function summarize(records, tracksCitations) {
  const sampleSize = records.length;
  const mentions = records.filter(row => row.mentioned).length;
  const citations = records.filter(row => row.cited).length;
  return {
    sampleSize, mentions, citations,
    mentionRate: sampleSize ? mentions / sampleSize : null,
    citationRate: sampleSize && tracksCitations ? citations / sampleSize : null,
  };
}

export function analyzeObservations({ brand, aliases = [], domains = [], ownedUrlPrefixes = [], observations = [] } = {}) {
  list(observations, "observations");
  const brandName = brand === undefined && !observations.length ? "" : requiredText(brand, "brand");
  const names = list(aliases, "aliases").map(name => requiredText(name, "aliases"));
  const terms = new Map();
  for (const name of [brandName, ...names].filter(Boolean)) {
    const key = name.normalize("NFKC").toLowerCase();
    if (!terms.has(key)) terms.set(key, { name, pattern: termPattern(name) });
  }
  const hosts = [...new Set(list(domains, "domains").map(canonicalDomain))];
  const prefixes = list(ownedUrlPrefixes, "ownedUrlPrefixes").map(ownedPrefix);
  const tracksCitations = hosts.length > 0 || prefixes.length > 0;
  const engines = new Map();

  const records = observations.map((row, index) => {
    const field = `observations[${index}]`;
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`${field}에는 관측 레코드를 입력하세요.`);
    const engine = requiredText(row.engine, field + ".engine");
    const query = requiredText(row.query, field + ".query");
    const observedAt = observationDate(row.observedAt, field + ".observedAt");
    const answer = requiredText(row.answer, field + ".answer").normalize("NFKC");
    // 링크 대상의 호스트·경로에 있는 이름은 답변 본문의 브랜드 언급에서 제외한다.
    const body = answer.replace(/https?:\/\/[^\s<>()\[\]{}]+/giu, " ");
    const matchedTerms = [...terms.values()].filter(({ pattern }) => pattern.test(body)).map(({ name }) => name);
    const urls = new Map();
    for (const value of list(row.sources, field + ".sources")) {
      const url = parseSource(value, field + ".sources");
      urls.set(url.href, url);
    }
    const matchedSources = [];
    for (const url of urls.values()) {
      const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
      const path = comparablePath(url);
      const owned = hosts.some(host => hostname === host || hostname.endsWith("." + host)) ||
        prefixes.some(prefix => url.origin === prefix.origin && (path === prefix.path || path.startsWith(prefix.path + "/")));
      if (owned) matchedSources.push(url.href);
    }
    const record = {
      engine, query, observedAt, mentioned: matchedTerms.length > 0, matchedTerms,
      cited: tracksCitations ? matchedSources.length > 0 : null,
      matchedSources, sources: [...urls.keys()],
    };
    if (row.evidenceUrl !== undefined) record.evidenceUrl = parseSource(row.evidenceUrl, field + ".evidenceUrl").href;
    for (const name of ["model", "locale"]) {
      if (row[name] !== undefined) record[name] = requiredText(row[name], field + "." + name);
    }
    const engineKey = engine.normalize("NFKC").toLowerCase();
    if (!engines.has(engineKey)) engines.set(engineKey, []);
    engines.get(engineKey).push(record);
    return record;
  });

  const byEngine = [...engines.values()].map(rows => ({
    engine: rows[0].engine, ...summarize(rows, tracksCitations),
  }));
  return { ...summarize(records, tracksCitations), byEngine, records };
}
