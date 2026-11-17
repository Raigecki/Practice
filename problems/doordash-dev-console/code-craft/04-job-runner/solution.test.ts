import { executionOrder, runJobs } from "./solution";
import type { Job, JobSpec } from "./types";
import { CycleError, DuplicateJobError, UnknownDependencyError } from "./types";

const spec = (id: string, ...deps: string[]): JobSpec => ({ id, deps });
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Builds jobs that log start/end and track concurrency. `fail` = how many attempts fail first. */
function harness() {
  const log: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const job = (id: string, deps: string[] = [], opts: { fail?: number; delay?: number; retries?: number } = {}): Job => {
    let failuresLeft = opts.fail ?? 0;
    return {
      id,
      deps,
      retries: opts.retries,
      run: async () => {
        log.push(`start:${id}`);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await tick(opts.delay ?? 1);
        inFlight--;
        if (failuresLeft > 0) {
          failuresLeft--;
          throw new Error(`${id} boom`);
        }
        log.push(`end:${id}`);
      },
    };
  };
  return { job, log, maxInFlight: () => maxInFlight };
}

describe("DoorDash Dev Console: Job Runner", () => {
  describe("Part 1: executionOrder", () => {
    it("deps come before dependents", () => {
      expect(executionOrder([spec("deploy", "build", "test"), spec("test", "build"), spec("build")])).toEqual([
        "build",
        "test",
        "deploy",
      ]);
    });

    it("ties break by input order", () => {
      expect(executionOrder([spec("c"), spec("a"), spec("d")])).toEqual(["c", "a", "d"]);
    });

    it("a job unlocked later still respects input order among ready jobs", () => {
      // after "a" finishes, "x" (index 1) is ready and beats "z" (index 2), even though z was waiting first.
      // A plain FIFO queue gets this wrong: it would give a, z, x.
      expect(executionOrder([spec("a"), spec("x", "a"), spec("z")])).toEqual(["a", "x", "z"]);
      expect(executionOrder([spec("c"), spec("a"), spec("b", "c"), spec("d")])).toEqual(["c", "a", "b", "d"]);
    });

    it("diamond", () => {
      expect(executionOrder([spec("d", "b", "c"), spec("b", "a"), spec("c", "a"), spec("a")])).toEqual([
        "a",
        "b",
        "c",
        "d",
      ]);
    });

    it("duplicate deps are fine", () => {
      expect(executionOrder([spec("a"), spec("b", "a", "a")])).toEqual(["a", "b"]);
    });

    it("empty", () => {
      expect(executionOrder([])).toEqual([]);
    });

    it("throws CycleError listing the jobs that can't run", () => {
      try {
        executionOrder([spec("ok"), spec("a", "c"), spec("b", "a"), spec("c", "b"), spec("after", "a")]);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(CycleError);
        expect((err as CycleError).jobIds).toEqual(["a", "b", "c", "after"]);
      }
    });

    it("self-dependency is a cycle", () => {
      expect(() => executionOrder([spec("a", "a")])).toThrow(CycleError);
    });

    it("unknown dependency and duplicate ids are rejected", () => {
      expect(() => executionOrder([spec("a", "ghost")])).toThrow(UnknownDependencyError);
      expect(() => executionOrder([spec("a"), spec("a")])).toThrow(DuplicateJobError);
    });
  });

  describe("Part 2: runJobs", () => {
    it("runs every job after its deps finish", async () => {
      const { job, log } = harness();
      const results = await runJobs([job("deploy", ["build", "test"]), job("test", ["build"]), job("build")]);
      expect(log).toEqual(["start:build", "end:build", "start:test", "end:test", "start:deploy", "end:deploy"]);
      expect(results).toEqual({
        build: { status: "succeeded", attempts: 1 },
        test: { status: "succeeded", attempts: 1 },
        deploy: { status: "succeeded", attempts: 1 },
      });
    });

    it("independent jobs run in parallel", async () => {
      const { job, maxInFlight } = harness();
      await runJobs([job("a", [], { delay: 10 }), job("b", [], { delay: 10 }), job("c", [], { delay: 10 })]);
      expect(maxInFlight()).toBe(3);
    });

    it("respects maxConcurrency", async () => {
      const { job, maxInFlight } = harness();
      const jobs = Array.from({ length: 8 }, (_, i) => job(`j${i}`, [], { delay: 3 }));
      await runJobs(jobs, { maxConcurrency: 2 });
      expect(maxInFlight()).toBe(2);
    });

    it("with maxConcurrency 1, start order equals executionOrder", async () => {
      const { job, log } = harness();
      const jobs = [job("c"), job("a"), job("b", ["c"]), job("d")];
      await runJobs(jobs, { maxConcurrency: 1 });
      expect(log.filter((l) => l.startsWith("start")).map((l) => l.slice(6))).toEqual(executionOrder(jobs));
    });

    it("a failure skips dependents transitively but unrelated jobs still run", async () => {
      const { job } = harness();
      const results = await runJobs([
        job("build", [], { fail: 1 }),
        job("test", ["build"]),
        job("deploy", ["test"]),
        job("lint"),
      ]);
      expect(results).toEqual({
        build: { status: "failed", attempts: 1, error: "build boom" },
        test: { status: "skipped", attempts: 0 },
        deploy: { status: "skipped", attempts: 0 },
        lint: { status: "succeeded", attempts: 1 },
      });
    });

    it("a job with one failed dep is skipped even if its other dep succeeds later", async () => {
      const { job, log } = harness();
      const results = await runJobs([
        job("fast-fail", [], { fail: 1, delay: 1 }),
        job("slow-ok", [], { delay: 15 }),
        job("join", ["fast-fail", "slow-ok"]),
      ]);
      expect(results.join).toEqual({ status: "skipped", attempts: 0 });
      expect(log).not.toContain("start:join");
    });

    it("rejects invalid graphs before running anything", async () => {
      const { job, log } = harness();
      await expect(runJobs([job("ok"), job("a", ["b"]), job("b", ["a"])])).rejects.toBeInstanceOf(CycleError);
      expect(log).toEqual([]);
    });

    it("empty", async () => {
      await expect(runJobs([])).resolves.toEqual({});
    });
  });

  describe("Part 3: retries with exponential backoff", () => {
    it("retries until success and reports attempts", async () => {
      const { job } = harness();
      const waits: number[] = [];
      const results = await runJobs([job("flaky", [], { fail: 2, retries: 3 })], {
        backoffMs: 50,
        sleep: async (ms) => {
          waits.push(ms);
        },
      });
      expect(results.flaky).toEqual({ status: "succeeded", attempts: 3 });
      expect(waits).toEqual([50, 100]);
    });

    it("gives up after retries are exhausted and keeps the last error", async () => {
      const { job } = harness();
      const waits: number[] = [];
      const results = await runJobs([job("bad", [], { fail: 10, retries: 2 }), job("child", ["bad"])], {
        backoffMs: 10,
        sleep: async (ms) => {
          waits.push(ms);
        },
      });
      expect(results.bad).toEqual({ status: "failed", attempts: 3, error: "bad boom" });
      expect(results.child.status).toBe("skipped");
      expect(waits).toEqual([10, 20]);
    });

    it("no retries configured means no sleep", async () => {
      const { job } = harness();
      const sleep = vi.fn(async () => {});
      await runJobs([job("bad", [], { fail: 1 })], { sleep });
      expect(sleep).not.toHaveBeenCalled();
    });

    it("dependents wait for the retried job to succeed", async () => {
      const { job, log } = harness();
      await runJobs([job("flaky", [], { fail: 1, retries: 1 }), job("next", ["flaky"])], { sleep: async () => {} });
      expect(log).toEqual(["start:flaky", "start:flaky", "end:flaky", "start:next", "end:next"]);
    });
  });
});
