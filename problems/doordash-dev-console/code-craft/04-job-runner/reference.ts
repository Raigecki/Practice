// Reference solution — spoilers. Tests run against ./solution, not this file.
import type { Job, JobResult, JobSpec, RunOptions } from "./types";
import { CycleError, DuplicateJobError, UnknownDependencyError } from "./types";

interface Graph {
  /** Input position, used to break ties deterministically. */
  index: Map<string, number>;
  /** job → jobs that depend on it */
  dependents: Map<string, string[]>;
  /** job → number of deps not yet satisfied */
  pending: Map<string, number>;
}

function buildGraph(jobs: JobSpec[]): Graph {
  const index = new Map<string, number>();
  jobs.forEach((job, i) => {
    if (index.has(job.id)) throw new DuplicateJobError(job.id);
    index.set(job.id, i);
  });

  const dependents = new Map<string, string[]>(jobs.map((j) => [j.id, []]));
  const pending = new Map<string, number>();
  for (const job of jobs) {
    const deps = new Set(job.deps);
    for (const dep of deps) {
      if (!index.has(dep)) throw new UnknownDependencyError(job.id, dep);
      dependents.get(dep)!.push(job.id);
    }
    pending.set(job.id, deps.size);
  }
  return { index, dependents, pending };
}

/** Ready-queue kept sorted by input position (a heap is better for huge graphs). */
function insertByIndex(queue: string[], id: string, index: Map<string, number>): void {
  const pos = index.get(id)!;
  let i = queue.length;
  while (i > 0 && index.get(queue[i - 1])! > pos) i--;
  queue.splice(i, 0, id);
}

export function executionOrder(jobs: JobSpec[]): string[] {
  const { index, dependents, pending } = buildGraph(jobs);
  const ready = jobs.filter((j) => pending.get(j.id) === 0).map((j) => j.id);
  const order: string[] = [];

  // Kahn's algorithm.
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const child of dependents.get(id)!) {
      const left = pending.get(child)! - 1;
      pending.set(child, left);
      if (left === 0) insertByIndex(ready, child, index);
    }
  }

  if (order.length < jobs.length) {
    const ordered = new Set(order);
    throw new CycleError(jobs.filter((j) => !ordered.has(j.id)).map((j) => j.id));
  }
  return order;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function attempt(job: Job, backoffMs: number, sleep: (ms: number) => Promise<void>): Promise<JobResult> {
  const maxAttempts = 1 + Math.max(0, job.retries ?? 0);
  let lastError = "";
  for (let n = 1; n <= maxAttempts; n++) {
    try {
      await job.run();
      return { status: "succeeded", attempts: n };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (n < maxAttempts) await sleep(backoffMs * 2 ** (n - 1));
    }
  }
  return { status: "failed", attempts: maxAttempts, error: lastError };
}

export async function runJobs(jobs: Job[], options: RunOptions = {}): Promise<Record<string, JobResult>> {
  executionOrder(jobs); // validate up front: duplicates, unknown deps, cycles — before anything runs

  const { index, dependents, pending } = buildGraph(jobs);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const maxConcurrency = options.maxConcurrency ?? Infinity;
  const backoffMs = options.backoffMs ?? 100;
  const sleep = options.sleep ?? realSleep;

  const results: Record<string, JobResult> = {};
  const ready = jobs.filter((j) => pending.get(j.id) === 0).map((j) => j.id);
  let running = 0;
  let finished = 0;

  return new Promise((resolve) => {
    const skipDependents = (id: string) => {
      for (const child of dependents.get(id)!) {
        if (results[child]) continue;
        results[child] = { status: "skipped", attempts: 0 };
        finished++;
        skipDependents(child);
      }
    };

    const onDone = (id: string, result: JobResult) => {
      running--;
      results[id] = result;
      finished++;
      if (result.status === "succeeded") {
        for (const child of dependents.get(id)!) {
          const left = pending.get(child)! - 1;
          pending.set(child, left);
          if (left === 0 && !results[child]) insertByIndex(ready, child, index);
        }
      } else {
        skipDependents(id);
      }
      pump();
    };

    const pump = () => {
      if (finished === jobs.length) return resolve(results);
      while (running < maxConcurrency && ready.length > 0) {
        const id = ready.shift()!;
        running++;
        void attempt(byId.get(id)!, backoffMs, sleep).then((result) => onDone(id, result));
      }
    };

    pump();
  });
}
