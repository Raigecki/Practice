// Mock of a Hacker-News-style jobs API.
//
//   GET /api/jobstories        -> number[]  (job ids, newest first)
//   GET /api/item/:id          -> Job
//
// Query params (any endpoint):
//   ?delay=ms       fixed delay instead of the default
//   ?failRate=0.2   fail this fraction of requests with a 500 (used in Part 2)
//
// Item requests use a RANDOM delay (100–1200ms), so responses come back out of order.

import { createServer } from "node:http";

const PORT = 3004;

const companies = [
  "Parcelwise", "Lumen Labs", "Brightloop", "Copperline", "Northwind Robotics",
  "Fieldnote", "Quarry", "Tessellate", "Harbor Health", "Kitebase",
  "Mossgrid", "Ovenbird", "Pinecrest AI", "Relaykit", "Saltbox",
  "Tidepool Data", "Umbra Security", "Vantage Freight", "Willowmark", "Zephyr Energy",
];
const roles = [
  "Senior Frontend Engineer", "Founding Engineer", "Staff Backend Engineer",
  "Product Designer", "Full-Stack Engineer (React/Go)", "Engineering Manager",
  "Mobile Engineer (iOS)", "Data Engineer", "Developer Advocate", "Infrastructure Engineer",
];

const NOW = Math.floor(Date.now() / 1000);
const jobs = Array.from({ length: 40 }, (_, i) => {
  const company = companies[i % companies.length];
  const id = 39_000_000 - i * 137;
  return {
    id,
    type: "job",
    by: company.toLowerCase().replace(/\W+/g, ""),
    title: `${company} is hiring a ${roles[(i * 3) % roles.length]}`,
    time: NOW - i * 5400, // unix seconds, every 1.5h
    // Every 4th job has no url (just like real HN jobs that are text posts).
    ...(i % 4 === 3 ? {} : { url: `https://example.com/${company.toLowerCase().replace(/\W+/g, "-")}/careers` }),
  };
});

let requestCount = 0;

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const failRate = Number(url.searchParams.get("failRate") ?? 0);
  const fixedDelay = url.searchParams.get("delay");
  const isItem = url.pathname.startsWith("/api/item/");
  const delay = fixedDelay != null ? Number(fixedDelay) : isItem ? 100 + Math.random() * 1100 : 400;

  requestCount++;
  console.log(`#${requestCount} ${req.method} ${url.pathname}${url.search}  (${Math.round(delay)}ms)`);

  setTimeout(() => {
    if (Math.random() < failRate) return send(res, 500, { error: "Internal server error" });

    if (req.method === "GET" && url.pathname === "/api/jobstories") {
      return send(res, 200, jobs.map((j) => j.id));
    }

    const match = url.pathname.match(/^\/api\/item\/(\d+)$/);
    if (req.method === "GET" && match) {
      const job = jobs.find((j) => j.id === Number(match[1]));
      return job ? send(res, 200, job) : send(res, 404, { error: "Item not found" });
    }

    send(res, 404, { error: "Not found" });
  }, delay);
}).listen(PORT, () => console.log(`mock jobs api on http://localhost:${PORT}`));
