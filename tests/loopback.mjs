import { EventEmitter, once } from "node:events";
import http from "node:http";
import { Readable } from "node:stream";

// The same route supplies the bytes and repeated header lines for both transports.
function useInMemoryTransport(t, route) {
  const origin = "http://seo-fixture.test";
  function responseFor(input) {
    const url = new URL(input);
    if (url.origin !== origin) throw new Error("Unexpected fixture URL: " + url.href);
    const { status = 200, headers = {}, body = "" } = route(url);
    const fields = [];
    for (const [name, values] of Object.entries(headers)) {
      for (const value of [values].flat()) fields.push([name, value]);
    }
    return { status, fields, body };
  }

  const originalGet = http.get;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    http.get = originalGet;
    globalThis.fetch = originalFetch;
  });
  http.get = (url, options, callback) => {
    const { status, fields, body } = responseFor(url);
    const response = Readable.from([Buffer.from(body)]);
    response.statusCode = status;
    response.headers = Object.fromEntries(new Headers(fields));
    response.rawHeaders = fields.flat();
    queueMicrotask(() => callback(response));
    return new EventEmitter();
  };
  globalThis.fetch = async (url) => {
    const { status, fields, body } = responseFor(url);
    return new Response(body, { status, headers: fields });
  };
  return { origin, tcp: false };
}

export async function startHttpFixture(t, route) {
  if (process.env.SEO_TEST_TRANSPORT === "memory") return useInMemoryTransport(t, route);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://" + req.headers.host);
    const { status = 200, headers = {}, body = "" } = route(url);
    res.writeHead(status, headers).end(body);
  });
  try {
    const listening = once(server, "listening");
    server.listen(0, "127.0.0.1");
    await listening;
  } catch (error) {
    if (error.code !== "EPERM" || process.env.CI) throw error;
    return useInMemoryTransport(t, route);
  }
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  }));
  return { origin: "http://127.0.0.1:" + server.address().port, tcp: true };
}
