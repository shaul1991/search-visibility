// A bot-scoped noindex only applies to that bot. Keep every rule and its source
// so a later "index" cannot conceal an earlier restriction (or vice versa).
const metaScopes = new Set(["robots", "googlebot", "googlebot-news", "googlebot-image", "yeti", "bingbot", "applebot", "duckduckbot", "daum"]);
const valuedRules = new Set(["max-snippet", "max-image-preview", "max-video-preview", "unavailable_after", "ai-training", "ai-grounding"]);

export function indexingRules(metaTags, headerLines) {
  const rules = [];
  function collect(scope, text, source) {
    const value = text.trim().toLowerCase();
    if (!value) return;
    // Plain directives may also be space-separated. Arguments of valued
    // directives (for example a date) stay together.
    const values = /^[a-z][a-z_-]*(?:\s+[a-z][a-z_-]*)*$/.test(value) ? value.split(/\s+/) : [value];
    for (const directive of values) rules.push({ scope, value: directive, source });
  }
  for (const { name, content } of metaTags) {
    const scope = name?.trim().toLowerCase();
    if (!metaScopes.has(scope) || !content) continue;
    for (const part of content.split(",")) collect(scope, part, "meta");
  }
  for (const line of headerLines) {
    let scope = "robots";
    for (const part of line.split(",")) {
      const prefix = /^\s*([\w*-]+)\s*:\s*(.*)$/.exec(part);
      if (prefix && !valuedRules.has(prefix[1].toLowerCase())) {
        scope = prefix[1].toLowerCase();
        if (scope === "*") scope = "robots";
        collect(scope, prefix[2], "X-Robots-Tag");
      } else {
        collect(scope, part, "X-Robots-Tag");
      }
    }
  }
  return rules;
}

export function reportIndexing(rules, add, expectIndexable) {
  let genericNoindex = false;
  for (const { scope, value, source } of rules) {
    const excluded = /^(?:noindex|none)$/.test(value);
    if (excluded && scope === "robots") genericNoindex = true;
    const level = excluded ? (expectIndexable ? "FAIL" : "WARN") : "INFO";
    const detail = `${scope}: ${value}` + (excluded ? " — 색인 제외 지시" : "");
    add(level, scope === "robots" ? "공통" : scope, source === "meta" ? "robots meta" : source, detail, "google-search");
  }
  return genericNoindex;
}
