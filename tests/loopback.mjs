import { once } from "node:events";

// CI must exercise the real network path. In read-only local sandboxes,
// file-mode CLI and rule evaluation tests still run when listen() is denied.
export async function listenOnLoopback(server, t) {
  try {
    const listening = once(server, "listening");
    server.listen(0, "127.0.0.1");
    await listening;
  } catch (error) {
    if (error.code !== "EPERM" || process.env.CI) throw error;
    t.skip("이 실행 환경은 로컬 HTTP 포트를 열 수 없습니다.");
    return null;
  }
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}
