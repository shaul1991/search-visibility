#!/usr/bin/env node
import { t, currentLocale, validateLocale, withLocale } from "./locale.mjs";
import { mkdir, mkdtemp, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { dirname, basename, join, resolve } from "node:path";
import { isCliEntry } from "./cli-entry.mjs";
import { parseArgs } from "node:util";
import { analyzeObservations } from "./observations.mjs";
import { parseSearchPerformance } from "./search-performance.mjs";
import { auditSite } from "./site-audit.mjs";
import { renderReport } from "./visibility-report.mjs";

const help = () => (currentLocale() === "en" ? `Usage: node visibility.mjs <config.json|URL> [--out <new folder>] [--fail-on-findings] [--lang en|ko]
       node visibility.mjs --url <URL> [--out <new folder>] [--fail-on-findings] [--lang en|ko]
       node visibility.mjs init [config.json] [--lang en|ko]
Use an absolute HTTP(S) URL to audit one page. init creates visibility.config.json by default.
Relative input paths are resolved from the config file. Writes report.json and index.html.
Language: --lang overrides config locale. The default is ko.
The default output is a new folder under visibility-reports/ in the current directory.
Exit codes: 0 completed, 1 FAIL found with --fail-on-findings, 2 input, collection or write error.` : `사용법: node visibility.mjs <설정.json|URL> [--out <새 폴더>] [--fail-on-findings] [--lang en|ko]
        node visibility.mjs --url <URL> [--out <새 폴더>] [--fail-on-findings] [--lang en|ko]
        node visibility.mjs init [설정.json] [--lang en|ko]
HTTP(S) 절대 URL을 입력하면 한 페이지를 점검합니다. init의 기본 파일은 visibility.config.json입니다.
설정 파일을 기준으로 상대 경로를 해석합니다. report.json과 index.html을 생성합니다.
언어: --lang이 설정의 locale보다 우선하며 기본값은 ko입니다.
출력 경로를 생략하면 현재 폴더의 visibility-reports/ 아래에 실행별 보고서를 만듭니다.
종료 코드: 0 완료, 1 --fail-on-findings에서 FAIL 발견, 2 입력·수집·쓰기 오류.`);

async function readText(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > 16 * 1024 * 1024) {
    throw new Error((currentLocale() === "en" ? `Expected a regular file of at most 16 MiB: ${file}` : `16 MiB 이하의 일반 파일이 필요합니다: ${file}`));
  }
  return readFile(file, "utf8");
}

async function readJson(file) {
  const text = await readText(file);
  try { return JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch (error) { throw new Error((currentLocale() === "en" ? `Invalid JSON (${file}): ${error.message}` : `JSON 형식 오류 (${file}): ${error.message}`)); }
}

export async function collectReport(configFile, { lang } = {}) {
  return withLocale(lang ?? "ko", async () => {
    const config = await readJson(configFile);
    if (config && Object.hasOwn(config, "locale")) validateLocale(config.locale);
    const locale = lang ?? config?.locale ?? "ko";
    return withLocale(locale, () => collectConfig(config, dirname(resolve(configFile)), locale));
  });
}

async function collectConfig(config, baseDir, locale) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error(t("설정은 JSON 객체여야 합니다.", "Config must be a JSON object."));
  const keys = new Set(["brand", "aliases", "domains", "ownedUrlPrefixes", "targets", "sitemap", "limit", "expectIndexable", "observations", "searchConsole", "sample", "locale"]);
  for (const key of Object.keys(config)) {
    if (!keys.has(key)) throw new Error((currentLocale() === "en" ? `Unknown config setting: ${key}` : `알 수 없는 설정: ${key}`));
  }
  if (config.sample !== undefined && typeof config.sample !== "boolean") throw new Error(t("sample은 true 또는 false여야 합니다.", "sample must be true or false."));
  const observations = typeof config.observations === "string"
    ? await readJson(resolve(baseDir, config.observations)) : config.observations;
  const ai = analyzeObservations({
    brand: config.brand, aliases: config.aliases, domains: config.domains,
    ownedUrlPrefixes: config.ownedUrlPrefixes, observations,
  });
  let searchPerformance = null;
  if (config.searchConsole !== undefined) {
    if (typeof config.searchConsole !== "string" || !config.searchConsole.trim()) throw new Error(t("searchConsole에는 CSV 파일 경로가 필요합니다.", "searchConsole must be a CSV file path."));
    searchPerformance = parseSearchPerformance(await readText(resolve(baseDir, config.searchConsole)));
  }
  const site = await auditSite({targets: config.targets, sitemap: config.sitemap, limit: config.limit, expectIndexable: config.expectIndexable, baseDir});
  if (!site.pages.length && !config.sitemap && !ai.sampleSize && !searchPerformance) {
    throw new Error(t("targets, sitemap, observations 또는 searchConsole 중 점검할 자료를 지정하세요.", "Specify at least one input: targets, sitemap, observations or searchConsole."));
  }
  return {schemaVersion: 1, locale, generatedAt: new Date().toISOString(), brand: config.brand || "", sample: config.sample === true, site, searchPerformance, ai};
}

async function publishReport(report, requestedPath) {
  const parent = requestedPath ? dirname(resolve(requestedPath)) : resolve("visibility-reports");
  await mkdir(parent, {recursive: true});
  const temp = await mkdtemp(join(parent, ".visibility-"));
  const target = requestedPath ? resolve(requestedPath) : join(parent, report.generatedAt.replace(/:/g, "-") + "-" + basename(temp).slice(-6));
  let reserved = false;
  let publishedJson = false;
  try {
    await writeFile(join(temp, "report.json"), JSON.stringify(report, null, 2) + "\n");
    await writeFile(join(temp, "index.html"), renderReport(report));
    // 같은 이름의 사용자 파일과 이전 보고서는 보존한다.
    await mkdir(target);
    reserved = true;
    await rename(join(temp, "report.json"), join(target, "report.json"));
    publishedJson = true;
    await rename(join(temp, "index.html"), join(target, "index.html"));
    return target;
  } catch (error) {
    if (publishedJson) await rm(join(target, "report.json"), {force: true});
    if (reserved) await rmdir(target).catch(() => {});
    if (error.code === "EEXIST") throw new Error((currentLocale() === "en" ? `Output already exists. Choose a new folder: ${target}` : `출력 경로가 이미 있습니다. 새 폴더 이름을 지정하세요: ${target}`));
    throw error;
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
}

async function initConfig(file) {
  const config = {
    targets: ["https://example.org/"],
    expectIndexable: true,
    locale: currentLocale(),
  };
  const path = resolve(file);
  try {
    await writeFile(path, JSON.stringify(config, null, 2) + "\n", {flag: "wx"});
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(t(`설정 경로가 이미 있습니다: ${path}`, `Config path already exists: ${path}`));
    }
    throw error;
  }
  console.log(t(`설정을 생성했습니다: ${path}`, `Created config: ${path}`));
  return 0;
}

async function main() {
  const {values, positionals, tokens} = parseArgs({allowPositionals:true, tokens:true, options:{
    out:{type:"string"}, url:{type:"string"}, lang:{type:"string"}, "fail-on-findings":{type:"boolean"}, help:{type:"boolean", short:"h"},
  }});
  return withLocale(values.lang ?? "ko", async () => {
    if (values.help) {
      console.log(help());
      return 0;
    }
    const urlOptions = tokens.filter(token => token.kind === "option" && token.name === "url");
    if (urlOptions.length > 1) {
      throw new Error(t("--url은 한 번만 지정하세요.", "Specify --url only once."));
    }
    const [input, configPath] = positionals;
    if (input === "init") {
      if (positionals.length > 2 || values.url !== undefined || values.out !== undefined || values["fail-on-findings"] !== undefined) {
        throw new Error(help());
      }
      return initConfig(configPath ?? "visibility.config.json");
    }
    if (values.url === undefined ? positionals.length !== 1 : positionals.length !== 0) {
      throw new Error(help());
    }
    const url = values.url ?? (/^(?:https?:|[a-z][a-z\d+.-]*:\/\/|\/\/)/i.test(input) ? input : undefined);
    if (url !== undefined && !/^https?:\/\/[^/\\\s?#]/i.test(url)) {
      throw new Error(t("HTTP(S) 절대 URL을 입력하세요.", "Enter an absolute HTTP(S) URL."));
    }
    const report = url === undefined
      ? await collectReport(input, {lang: values.lang})
      : await collectConfig({targets: [url], expectIndexable: true}, process.cwd(), currentLocale());
    return withLocale(report.locale, () => writeAndSummarize(report, values));
  });
}

async function writeAndSummarize(report, values) {
  const target = await publishReport(report, values.out);
  const { pages } = report.site;
  const rows = report.searchPerformance?.rowCount ?? 0;
  const answers = report.ai.sampleSize;
  const sample = report.sample ? t("[예시 데이터] ", "[Sample data] ") : "";
  const summary = currentLocale() === "en"
    ? `Pages: ${pages.length} · Search Console rows: ${rows} · AI answers: ${answers}`
    : `페이지 ${pages.length}개 · Search Console ${rows}행 · AI 답변 ${answers}건`;
  console.log(`${sample}${summary}
HTML ${join(target, "index.html")}
JSON ${join(target, "report.json")}`);
  if (report.site.discoveryErrors.length || report.site.pages.some(page => page.error)) return 2;
  const failed = report.site.pages.some(page => page.results.some(finding => finding.level === "FAIL"));
  return values["fail-on-findings"] && failed ? 1 : 0;
}

if (isCliEntry(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
