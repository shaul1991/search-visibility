#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { dirname, basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { analyzeObservations } from "./observations.mjs";
import { parseSearchPerformance } from "./search-performance.mjs";
import { auditSite } from "./site-audit.mjs";
import { renderReport } from "./visibility-report.mjs";

const help = `사용법: node visibility.mjs <설정.json> [--out <새 폴더>] [--fail-on-findings]
설정 파일을 기준으로 상대 경로를 해석합니다. report.json과 index.html을 생성합니다.
출력 경로를 생략하면 현재 폴더의 visibility-reports/ 아래에 실행별 보고서를 만듭니다.
종료 코드: 0 완료, 1 --fail-on-findings에서 FAIL 발견, 2 입력·수집·쓰기 오류.`;

async function readText(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > 16 * 1024 * 1024) {
    throw new Error(`16 MiB 이하의 일반 파일이 필요합니다: ${file}`);
  }
  return readFile(file, "utf8");
}

async function readJson(file) {
  const text = await readText(file);
  try { return JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch (error) { throw new Error(`JSON 형식 오류 (${file}): ${error.message}`); }
}

export async function collectReport(configFile) {
  const baseDir = dirname(resolve(configFile));
  const config = await readJson(configFile);
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("설정은 JSON 객체여야 합니다.");
  const keys = new Set(["brand", "aliases", "domains", "ownedUrlPrefixes", "targets", "sitemap", "limit", "expectIndexable", "observations", "searchConsole", "sample"]);
  for (const key of Object.keys(config)) {
    if (!keys.has(key)) throw new Error(`알 수 없는 설정: ${key}`);
  }
  if (config.sample !== undefined && typeof config.sample !== "boolean") throw new Error("sample은 true 또는 false여야 합니다.");
  const observations = typeof config.observations === "string"
    ? await readJson(resolve(baseDir, config.observations)) : config.observations;
  const ai = analyzeObservations({
    brand: config.brand, aliases: config.aliases, domains: config.domains,
    ownedUrlPrefixes: config.ownedUrlPrefixes, observations,
  });
  let searchPerformance = null;
  if (config.searchConsole !== undefined) {
    if (typeof config.searchConsole !== "string" || !config.searchConsole.trim()) throw new Error("searchConsole에는 CSV 파일 경로가 필요합니다.");
    searchPerformance = parseSearchPerformance(await readText(resolve(baseDir, config.searchConsole)));
  }
  const site = await auditSite({targets: config.targets, sitemap: config.sitemap, limit: config.limit, expectIndexable: config.expectIndexable, baseDir});
  if (!site.pages.length && !config.sitemap && !ai.sampleSize && !searchPerformance) {
    throw new Error("targets, sitemap, observations 또는 searchConsole 중 점검할 자료를 지정하세요.");
  }
  return {schemaVersion: 1, generatedAt: new Date().toISOString(), brand: config.brand || "", sample: config.sample === true, site, searchPerformance, ai};
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
    if (error.code === "EEXIST") throw new Error(`출력 경로가 이미 있습니다. 새 폴더 이름을 지정하세요: ${target}`);
    throw error;
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
}

async function main() {
  const {values, positionals} = parseArgs({allowPositionals:true, options:{
    out:{type:"string"}, "fail-on-findings":{type:"boolean"}, help:{type:"boolean", short:"h"},
  }});
  if (values.help) { console.log(help); return 0; }
  if (positionals.length !== 1) throw new Error(help);
  const report = await collectReport(positionals[0]);
  const target = await publishReport(report, values.out);
  console.log(`${report.sample ? "[예시 데이터] " : ""}페이지 ${report.site.pages.length}개 · Search Console ${report.searchPerformance?.rowCount ?? 0}행 · AI 답변 ${report.ai.sampleSize}건\nHTML ${join(target, "index.html")}\nJSON ${join(target, "report.json")}`);
  if (report.site.discoveryErrors.length || report.site.pages.some(page => page.error)) return 2;
  const failed = report.site.pages.some(page => page.results.some(finding => finding.level === "FAIL"));
  return values["fail-on-findings"] && failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
