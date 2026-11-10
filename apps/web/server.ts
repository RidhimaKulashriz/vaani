import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import httpProxy from "http-proxy";
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const api = process.env.API_ORIGIN ?? "http://127.0.0.1:4001";
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const proxy = httpProxy.createProxyServer({ target: api, ws: true, changeOrigin: false, xfwd: true });
proxy.on("error", (_error, req, res) => {
  if (res && "writeHead" in res && !res.headersSent) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "api_unavailable", message: "The local API is not available." }));
  }
});
await app.prepare();
const upgradeHandler = app.getUpgradeHandler();
const server = createServer((req, res) => {
  const url = parse(req.url ?? "/", true);
  if (url.pathname?.startsWith("/api/") || url.pathname === "/health" || url.pathname === "/metrics") {
    proxy.web(req, res);
    return;
  }
  void handle(req, res, url);
});
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/api/")) proxy.ws(req, socket, head);
  else if (dev) void upgradeHandler(req, socket, head).catch(() => socket.destroy());
  else socket.destroy();
});
server.listen(port, hostname, () => console.log(`Vaani web ready at http://${hostname}:${port} → API ${api}`));
