import { EnvReservations } from "./solution";
import type { AuditEntry, AuditLog } from "./types";
import { EnvBusyError, EnvNotFoundError, NotOwnerError } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup({ auditDelayMs = 0 } = {}) {
  let t = 1_000_000;
  const clock = { now: () => t };
  const entries: AuditEntry[] = [];
  let failNext = 0;
  const audit: AuditLog = {
    async record(entry) {
      await sleep(auditDelayMs);
      if (failNext > 0) {
        failNext--;
        throw new Error("audit store unavailable");
      }
      entries.push(entry);
    },
  };
  const envs = new EnvReservations(["staging-1", "staging-2", "staging-3"], clock, audit);
  return {
    envs,
    entries,
    advance: (ms: number) => {
      t += ms;
    },
    failAuditOnce: () => {
      failNext = 1;
    },
    now: () => t,
  };
}

describe("Debugging: Staging Environment Reservations", () => {
  describe("basics", () => {
    it("reserves a free env and audits it", async () => {
      const { envs, entries, now } = setup();
      const r = await envs.reserve("staging-1", "alice", 60);
      expect(r.user).toBe("alice");
      expect(envs.holder("staging-1")).toBe("alice");
      expect(envs.listFree()).toEqual(["staging-2", "staging-3"]);
      expect(entries).toEqual([{ action: "reserve", envId: "staging-1", user: "alice", at: now() }]);
    });

    it("someone else can't reserve a held env", async () => {
      const { envs } = setup();
      await envs.reserve("staging-1", "alice", 60);
      await expect(envs.reserve("staging-1", "bob", 60)).rejects.toBeInstanceOf(EnvBusyError);
    });

    it("the holder can extend their own reservation", async () => {
      const { envs, advance } = setup();
      await envs.reserve("staging-1", "alice", 60);
      advance(50_000);
      await envs.reserve("staging-1", "alice", 60);
      advance(50_000);
      expect(envs.holder("staging-1")).toBe("alice");
    });

    it("unknown env throws EnvNotFoundError", async () => {
      const { envs } = setup();
      await expect(envs.reserve("prod", "alice", 60)).rejects.toBeInstanceOf(EnvNotFoundError);
      expect(() => envs.holder("prod")).toThrow(EnvNotFoundError);
    });
  });

  describe("expiry", () => {
    it("ttl is in seconds: held for exactly ttlSeconds", async () => {
      const { envs, advance, now } = setup();
      const start = now();
      const r = await envs.reserve("staging-1", "alice", 60);
      expect(r.expiresAt).toBe(start + 60_000);
      advance(59_999);
      expect(envs.holder("staging-1")).toBe("alice");
      advance(1);
      expect(envs.holder("staging-1")).toBeNull();
    });

    it("an expired env can be reserved by someone else", async () => {
      const { envs, advance } = setup();
      await envs.reserve("staging-1", "alice", 1);
      advance(1_000);
      await expect(envs.reserve("staging-1", "bob", 60)).resolves.toMatchObject({ user: "bob" });
    });
  });

  describe("release", () => {
    it("the holder can release", async () => {
      const { envs, entries } = setup();
      await envs.reserve("staging-1", "alice", 60);
      await envs.release("staging-1", "alice");
      expect(envs.holder("staging-1")).toBeNull();
      expect(entries.map((e) => e.action)).toEqual(["reserve", "release"]);
    });

    it("someone else can't release your env", async () => {
      const { envs } = setup();
      await envs.reserve("staging-1", "alice", 60);
      await expect(envs.release("staging-1", "bob")).rejects.toBeInstanceOf(NotOwnerError);
      expect(envs.holder("staging-1")).toBe("alice");
    });

    it("releasing a free or expired env is a no-op with no audit entry", async () => {
      const { envs, entries, advance } = setup();
      await envs.release("staging-2", "bob");
      await envs.reserve("staging-1", "alice", 1);
      advance(1_000);
      await envs.release("staging-1", "bob");
      expect(entries.map((e) => e.action)).toEqual(["reserve"]);
    });
  });

  describe("under load", () => {
    it("two concurrent reservations for the same env: exactly one wins", async () => {
      const { envs } = setup({ auditDelayMs: 5 });
      const results = await Promise.allSettled([
        envs.reserve("staging-1", "alice", 60),
        envs.reserve("staging-1", "bob", 60),
      ]);
      const won = results.filter((r) => r.status === "fulfilled");
      const lost = results.filter((r) => r.status === "rejected");
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(EnvBusyError);
      expect(envs.holder("staging-1")).toBe("alice");
    });

    it("20 engineers racing for 3 envs: each env has one holder, 17 are rejected", async () => {
      const { envs } = setup({ auditDelayMs: 2 });
      const users = Array.from({ length: 20 }, (_, i) => `user-${i}`);
      const attempts = users.map((u, i) => envs.reserve(`staging-${(i % 3) + 1}`, u, 60));
      const results = await Promise.allSettled(attempts);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
      expect(envs.listFree()).toEqual([]);
    });

    it("if auditing fails, the reservation doesn't count", async () => {
      const { envs, failAuditOnce } = setup({ auditDelayMs: 2 });
      failAuditOnce();
      await expect(envs.reserve("staging-1", "alice", 60)).rejects.toThrow("audit store unavailable");
      expect(envs.holder("staging-1")).toBeNull();
      await expect(envs.reserve("staging-1", "bob", 60)).resolves.toMatchObject({ user: "bob" });
    });

    it("a failed extension keeps the original reservation", async () => {
      const { envs, failAuditOnce, advance } = setup();
      await envs.reserve("staging-1", "alice", 60);
      failAuditOnce();
      await expect(envs.reserve("staging-1", "alice", 3_600)).rejects.toThrow();
      expect(envs.holder("staging-1")).toBe("alice");
      advance(60_000); // original expiry, not the failed 1-hour extension
      expect(envs.holder("staging-1")).toBeNull();
    });
  });
});
