import { t, currentLocale } from "./locale.mjs";
import http from "node:http";
import https from "node:https";
import { promisify } from "node:util";
import { brotliDecompress, gunzip, inflate, inflateRaw } from "node:zlib";

const unzipGzip = promisify(gunzip);
const unzipBrotli = promisify(brotliDecompress);
const unzipDeflate = promisify(inflate);
const unzipRawDeflate = promisify(inflateRaw);

async function readBytes(response, maxBytes) {
  const chunks = [];
  let length = 0;
  for await (const chunk of response) {
    length += chunk.length;
    if (maxBytes && length > maxBytes) throw new Error((currentLocale() === "en" ? `Response exceeds the ${maxBytes}-byte audit limit.` : `응답이 점검 한도 ${maxBytes}바이트를 넘었습니다.`));
    chunks.push(chunk);
  }
  let bytes = Buffer.concat(chunks, length);
  if (!bytes.length) return bytes;
  const encodings = (response.headers["content-encoding"] || "").toLowerCase().split(",").map(s => s.trim());
  const options = maxBytes ? { maxOutputLength: maxBytes } : {};
  for (const encoding of encodings.reverse()) {
    if (encoding === "gzip" || encoding === "x-gzip") bytes = await unzipGzip(bytes, options);
    else if (encoding === "br") bytes = await unzipBrotli(bytes, options);
    else if (encoding === "deflate") {
      try { bytes = await unzipDeflate(bytes, options); }
      catch (error) {
        if (error.code !== "Z_DATA_ERROR") throw error;
        bytes = await unzipRawDeflate(bytes, options);
      }
    }
  }
  return bytes;
}

// Keep individual X-Robots-Tag lines. A bot prefix never carries to the next header.
export async function fetchResource(url, userAgent, { allowedOrigin, maxBytes, signal, accept = "text/html,*/*" } = {}) {
  const chain = [];
  let current = new URL(url);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!["https:", "http:"].includes(current.protocol)) throw new Error(t("HTTP(S) URL만 점검할 수 있습니다.", "Only HTTP(S) URLs can be audited."));
    if (current.username || current.password) throw new Error(t("인증정보가 포함된 URL은 점검할 수 없습니다.", "URLs with credentials cannot be audited."));
    if (allowedOrigin && current.origin !== allowedOrigin) throw new Error(t("사이트맵과 다른 출처(origin)로 연결되어 요청을 생략했습니다.", "Skipped a request that redirected outside the sitemap origin."));
    const client = current.protocol === "https:" ? https : http;
    const response = await new Promise((resolve, reject) => {
      const request = client.get(current, {
        headers: { "user-agent": userAgent, accept, "accept-encoding": "gzip, deflate" },
        signal: signal || AbortSignal.timeout(30_000),
      }, resolve);
      request.on("error", reject);
    });
    const status = response.statusCode;
    chain.push({ url: current.href, status });
    if (status >= 300 && status < 400 && response.headers.location) {
      response.destroy();
      current = new URL(response.headers.location, current);
      continue;
    }
    const robotsHeaders = [];
    for (let i = 0; i < response.rawHeaders.length; i += 2) {
      if (response.rawHeaders[i].toLowerCase() === "x-robots-tag") robotsHeaders.push(response.rawHeaders[i + 1]);
    }
    return { status, headers: response.headers, robotsHeaders, bytes: await readBytes(response, maxBytes), chain, finalUrl: current.href };
  }
  throw new Error(t("리다이렉트 5회 초과", "More than 5 redirects"));
}

export async function fetchPage(url, userAgent, options) {
  const { bytes, ...page } = await fetchResource(url, userAgent, options);
  return { ...page, html: new TextDecoder().decode(bytes) };
}
