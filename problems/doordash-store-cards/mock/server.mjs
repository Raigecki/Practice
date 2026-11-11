import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = 3003;
const stores = JSON.parse(readFileSync(new URL("./stores.json", import.meta.url)));

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const delay = Number(url.searchParams.get("delay") ?? 500);
  const fail = url.searchParams.get("fail") === "1";

  setTimeout(() => {
    if (fail) return send(res, 500, { error: "Internal server error" });

    if (req.method === "GET" && url.pathname === "/api/stores") {
      return send(res, 200, { stores });
    }

    const match = url.pathname.match(/^\/api\/stores\/([^/]+)$/);
    if (req.method === "GET" && match) {
      const store = stores.find((s) => s.id === match[1]);
      return store ? send(res, 200, store) : send(res, 404, { error: "Store not found" });
    }

    send(res, 404, { error: "Not found" });
  }, delay);
}).listen(PORT, () => console.log(`mock api on http://localhost:${PORT}`));
