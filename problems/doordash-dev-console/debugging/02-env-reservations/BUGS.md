# Spoilers: the bugs

<details><summary>Click to reveal</summary>

1. **Check-then-act race in `reserve()`.** The availability check happens, then `await this.audit.record(...)` yields to the event loop, then the owner is written. Two requests both pass the check before either writes, so both "win" and the last write silently takes over.
   - **Fix:** claim the env synchronously, right after the check, with no `await` in between. Then audit.
   - **The trap:** once you claim before auditing, a failed audit would leave a reservation that was never audited. You have to **roll back** to the previous state on failure, and only if nobody has changed it since. The "auditing fails" and "failed extension" tests pass on the buggy code and exist to catch a fix that skips the rollback.
2. **Units bug.** `expiresAt = now + ttlSeconds`, but the clock is in **milliseconds**, so a 1-hour reservation lasts 3.6 seconds. Fix: `ttlSeconds * 1000`.
3. **`release()` doesn't check anything.** Anyone can release anyone's env, and releasing a free env writes a bogus audit entry. Fix: return early if it's not held, throw `NotOwnerError` if it's held by someone else.
4. **`getEnv()` uses a non-null assertion.** `this.envs.get(id)!` returns `undefined` for unknown ids, which crashes later with a `TypeError` (the 500). Fix: throw `EnvNotFoundError`.

</details>
