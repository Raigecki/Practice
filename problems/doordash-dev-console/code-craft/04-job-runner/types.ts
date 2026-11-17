export interface JobSpec {
  id: string;
  /** Ids of jobs that must succeed before this one starts. */
  deps: string[];
}

export interface Job extends JobSpec {
  run: () => Promise<void>;
  /** Extra attempts after the first failure (Part 3). Default 0. */
  retries?: number;
}

export type JobStatus = "succeeded" | "failed" | "skipped";

export interface JobResult {
  status: JobStatus;
  /** 0 for skipped jobs. */
  attempts: number;
  /** Message of the last error, for failed jobs. */
  error?: string;
}

export interface RunOptions {
  /** Max jobs running at once. Default: unlimited. */
  maxConcurrency?: number;
  /** Base backoff between retries (Part 3). Default 100. Wait = backoffMs * 2^(attempt - 1). */
  backoffMs?: number;
  /** Injected for tests. Default: real setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export class DuplicateJobError extends Error {
  readonly jobId: string;
  constructor(jobId: string) {
    super(`Duplicate job id: ${jobId}`);
    this.name = "DuplicateJobError";
    this.jobId = jobId;
  }
}

export class UnknownDependencyError extends Error {
  readonly jobId: string;
  readonly dependency: string;
  constructor(jobId: string, dependency: string) {
    super(`Job ${jobId} depends on unknown job ${dependency}`);
    this.name = "UnknownDependencyError";
    this.jobId = jobId;
    this.dependency = dependency;
  }
}

export class CycleError extends Error {
  /** Every job that could not be ordered, in input order. */
  readonly jobIds: string[];
  constructor(jobIds: string[]) {
    super(`Dependency cycle among: ${jobIds.join(", ")}`);
    this.name = "CycleError";
    this.jobIds = jobIds;
  }
}
