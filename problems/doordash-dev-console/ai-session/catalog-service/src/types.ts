export type Lifecycle = "experimental" | "production" | "deprecated";

export interface ServiceLinks {
  runbook?: string;
  docs?: string;
  dashboard?: string;
}

export interface Service {
  name: string;
  /** Owning team slug, e.g. "payments". */
  owner: string;
  lifecycle: Lifecycle;
  /** 1 = most critical. */
  tier: 1 | 2 | 3;
  description?: string;
  tags: string[];
  links: ServiceLinks;
  /** PagerDuty rotation id. */
  oncallRotation?: string;
  /** Epoch ms of the last production deploy. */
  lastDeployAt?: number;
}

export interface Request {
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

export interface Response {
  status: number;
  body: unknown;
}

export interface Clock {
  now(): number;
}
