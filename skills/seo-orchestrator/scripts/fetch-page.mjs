import http from "node:http";
import https from "node:https";
import { promisify } from "node:util";
import { brotliDecompress, gunzip, inflate, inflateRaw } from "node:zlib";

const unzipGzip = promisify(gunzip);
const unzipBrotli = promisify(brotliDecompress);
const unzipDeflate = promisify(inflate);
const unzipRawDeflate = promisify(inflateRaw);

async function readHtml(response) {
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  let bytes = Buffer.concat(chunks);
  if (!bytes.length) return "";
  const encodings = (response.headers["content-encoding"] || "").toLowerCase().split(",").map(s => s.trim());
  for (const encoding of encodings.reverse()) {
    if (encoding === "gzip" || encoding === "x-gzip") bytes = await unzipGzip(bytes);
    else if (encoding === "br") bytes = await unzipBrotli(bytes);
    else if (encoding === "deflate") {
      try { bytes = await unzipDeflate(bytes); }
      catch (error) {
        if (error.code !== "Z_DATA_ERROR") throw error;
        bytes = await unzipRawDeflate(bytes);
      }
    }
  }
  return new TextDecoder().decode(bytes);
}

// Fetch's Headers joins repeated fields. Keep individual X-Robots-Tag lines:
// a bot prefix applies to the rest of its line, but never to the next header.
export async function fetchPage(url, userAgent) {
  const chain = [];
  let current = new URL(url);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (current.username || current.password) throw new Error("인증정보가 포함된 URL은 점검할 수 없습니다.");
    const client = current.protocol === "https:" ? https : http;
    const response = await new Promise((resolve, reject) => {
      const request = client.get(current, {
        headers: { "user-agent": userAgent, accept: "text/html,*/*", "accept-encoding": "gzip, deflate" },
        signal: AbortSignal.timeout(30_000),
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
    return { status, headers: response.headers, robotsHeaders, html: await readHtml(response), chain, finalUrl: current.href };
  }
  throw new Error("리다이렉트 5회 초과");
}
