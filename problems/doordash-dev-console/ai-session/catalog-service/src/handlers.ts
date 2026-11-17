import { search } from "./search";
import { CatalogStore, parseService, ValidationError } from "./store";
import type { Clock, Lifecycle, Request, Response } from "./types";

type Handler = (req: Request, params: Record<string, string>) => Response;

interface Route {
  method: Request["method"];
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** "/services/:name" → regex + param names. */
function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { pattern: new RegExp(`^${source}$`), keys };
}

const ok = (body: unknown): Response => ({ status: 200, body });
const notFound = (what: string): Response => ({ status: 404, body: { error: `${what} not found` } });

/**
 * HTTP-shaped API over the catalog (no real server, so it's easy to test).
 * `clock` is unused today but injected for features that need the current time.
 */
export function createApp(store: CatalogStore, clock: Clock) {
  void clock;
  const routes: Route[] = [];
  const route = (method: Request["method"], path: string, handler: Handler) =>
    routes.push({ method, ...compile(path), handler });

  route("GET", "/services", (req) =>
    ok(store.list({ owner: req.query?.owner, lifecycle: req.query?.lifecycle as Lifecycle | undefined })),
  );

  route("GET", "/services/:name", (_req, { name }) => {
    const service = store.get(name);
    return service ? ok(service) : notFound(`service ${name}`);
  });

  route("POST", "/services", (req) => {
    const service = parseService(req.body);
    const { created } = store.upsert(service);
    return { status: created ? 201 : 200, body: service };
  });

  route("DELETE", "/services/:name", (_req, { name }) =>
    store.remove(name) ? { status: 204, body: null } : notFound(`service ${name}`),
  );

  route("GET", "/search", (req) => {
    const limit = Number(req.query?.limit ?? 10);
    return ok(search(store, req.query?.q ?? "", Number.isFinite(limit) && limit > 0 ? limit : 10));
  });

  return function handle(req: Request): Response {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.pattern.exec(req.path);
      if (!match) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
      try {
        return r.handler(req, params);
      } catch (err) {
        if (err instanceof ValidationError) return { status: 400, body: { error: err.message, field: err.field } };
        return { status: 500, body: { error: "internal error" } };
      }
    }
    return { status: 404, body: { error: "route not found" } };
  };
}
