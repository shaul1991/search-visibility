// 서버 HTML에 실제로 선언된 메타데이터만 읽습니다. JavaScript를 실행하지 않습니다.
const HEAD_ELEMENTS = new Set("html head base basefont bgsound link meta noframes noscript script style template title".split(" "));
const RAW_TEXT = new Set("script style title textarea iframe xmp noembed noframes noscript".split(" "));

function decodeEntities(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
  return value.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entity, key) => {
    if (key[0] !== "#") return entities[key.toLowerCase()];
    const code = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "\ufffd";
  });
}

function parseAttrs(source) {
  const attrs = {};
  const attribute = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const [, name, doubleQuoted, singleQuoted, unquoted] of source.matchAll(attribute)) {
    const key = name.toLowerCase();
    if (!(key in attrs)) attrs[key] = decodeEntities(doubleQuoted ?? singleQuoted ?? unquoted ?? "");
  }
  return attrs;
}

// 속성의 따옴표 안 '>'와 주석·원시 텍스트 안의 태그 모양 문자열을 건너뜁니다.
function* tokens(html) {
  const tag = /<!--([\s\S]*?)(?:--!?>|$)|<![^>]*>|<\?[^>]*>|<(\/?)([a-z][^\s/>]*)((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;
  let end = 0;
  for (let match; (match = tag.exec(html));) {
    if (end < match.index) yield { text: html.slice(end, match.index) };
    end = tag.lastIndex;
    if (!match[3]) continue;
    const name = match[3].toLowerCase();
    const closing = match[2] === "/";
    let content = "";
    if (!closing && RAW_TEXT.has(name)) {
      const close = new RegExp(`</${name}\\s*>`, "ig");
      close.lastIndex = end;
      const found = close.exec(html);
      content = html.slice(end, found?.index ?? html.length);
      end = tag.lastIndex = found ? close.lastIndex : html.length;
    }
    yield { name, closing, attrs: parseAttrs(match[4]), content, selfClosing: match[0].endsWith("/>") };
  }
  if (end < html.length) yield { text: html.slice(end) };
}

export function parseHtml(html) {
  const page = {
    title: null, lang: null, meta: {}, metaTags: [], canonical: null, canonicalLinks: [], baseHref: null,
    icons: [], jsonLd: [], anchors: [], bodyTextLength: 0, h1: [], verificationInBody: false,
  };
  let inHead = true;
  const inert = [];
  const bodyText = [];
  let heading = null;
  function finishHeading() {
    if (heading !== null) page.h1.push(heading.trim());
    heading = null;
  }
  for (const token of tokens(html)) {
    const { name, closing, attrs, content, text } = token;
    if (name === "template" || name === "math" || name === "svg") {
      if (closing && name === inert.at(-1)) inert.pop();
      else if (!closing && (name === "template" || !token.selfClosing)) {
        if (!inert.length && name !== "template") inHead = false;
        inert.push(name);
      }
      continue;
    }
    if (inert.length) continue;
    if (text !== undefined) {
      if (text.trim()) inHead = false;
      if (!inHead) bodyText.push(text);
      if (heading !== null) heading += text;
      continue;
    }
    if (closing) {
      if (["head", "body", "html"].includes(name)) inHead = false;
      if (name === "h1" || name === "body") finishHeading();
      continue;
    }
    if (!HEAD_ELEMENTS.has(name)) inHead = false;
    switch (name) {
      case "html":
        page.lang ??= attrs.lang ?? null;
        break;
      case "title":
        page.title ??= decodeEntities(content.replace(/\s+/g, " ").trim());
        break;
      case "meta": {
        page.metaTags.push(attrs);
        const key = (attrs.property || attrs.name || "").toLowerCase();
        if (key && attrs.content !== undefined && !(key in page.meta)) page.meta[key] = attrs.content.trim();
        if (!inHead && attrs.name?.toLowerCase() === "naver-site-verification") page.verificationInBody = true;
        break;
      }
      case "base":
        if (inHead) page.baseHref ??= attrs.href ?? null;
        break;
      case "link": {
        const rel = (attrs.rel || "").toLowerCase().split(/\s+/);
        if (rel.includes("canonical")) {
          page.canonicalLinks.push({ href: attrs.href, inHead });
          if (inHead) page.canonical ??= attrs.href ?? null;
        }
        if (attrs.href && rel.some(r => ["icon", "apple-touch-icon", "apple-touch-icon-precomposed"].includes(r))) {
          page.icons.push(attrs.href);
        }
        break;
      }
      case "a":
        if (attrs.href !== undefined) page.anchors.push(attrs.href);
        break;
      case "h1":
        finishHeading();
        heading = "";
        break;
      case "script":
        if (attrs.type?.trim().toLowerCase() === "application/ld+json") page.jsonLd.push(content.trim());
        break;
    }
  }
  finishHeading();
  page.bodyTextLength = bodyText.join(" ").replace(/\s+/g, " ").trim().length;
  return page;
}

export function httpUrl(value, base) {
  try {
    const url = new URL(value, base || undefined);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// 한 개의 유효한 대상을 확인했을 때만 OG나 최종 응답 URL과 대조합니다.
export function checkCanonical(page, add, pageUrl) {
  const report = (level, detail) => add(level, "공통", "canonical", detail, "google-search");
  const links = page.canonicalLinks ?? (page.canonical ? [{ href: page.canonical, inHead: true }] : []);
  const headLinks = links.filter(link => link.inHead);
  if (links.length > headLinks.length) report("FAIL", "<head> 밖의 canonical 선언은 무시됨");
  if (!headLinks.length) {
    if (!links.length) report("WARN", "없음");
    return null;
  }

  const base = page.baseHref ? httpUrl(page.baseHref, pageUrl) || pageUrl : pageUrl;
  const targets = new Set();
  const unresolved = new Set();
  for (const { href } of headLinks) {
    const value = href?.trim();
    if (!value) {
      report("FAIL", "href가 없거나 비어 있음");
      continue;
    }
    const relative = !/^[a-z][a-z\d+.\-]*:/i.test(value);
    const url = httpUrl(value, base);
    if (relative && !base && httpUrl(value, "https://example.invalid/")) {
      report("WARN", `상대 경로: ${value} (기준 URL이 없어 최종 주소 미확인)`);
      unresolved.add(value);
    } else if (!url) {
      report("FAIL", `잘못된 HTTP(S) URL: ${value}`);
    } else {
      if (relative) report("WARN", `상대 경로: ${value} → ${url}`);
      targets.add(url);
    }
  }
  // 루트 기준 경로는 배포 도메인을 몰라도 절대 URL의 경로와 대조할 수 있습니다.
  const comparable = [...targets, ...[...unresolved].filter(value => value.startsWith("/"))];
  const resourcePaths = comparable.map(value => {
    const { pathname, search, hash } = new URL(value, "https://example.invalid/");
    return pathname + search + hash;
  });
  if (targets.size > 1 || new Set(resourcePaths).size > 1) {
    report("FAIL", `서로 다른 대표 URL 선언: ${comparable.join(", ")}`);
    return null;
  }
  if (headLinks.length > 1) {
    const unique = targets.size + unresolved.size;
    report("WARN", unique === 1 ? "canonical 중복 선언 — 한 태그만 유지 권장" : "canonical 선언이 여러 개 — 대상 URL 확인 필요");
  }
  if (unresolved.size) return null;
  const [target] = targets;
  if (pageUrl && target && target !== httpUrl(pageUrl)) report("INFO", `다른 URL을 가리킴: ${target}`);
  return target ?? null;
}
