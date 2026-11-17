# Debugging: Load Balancer

_Format: 45–60 minutes. **No AI.** This mirrors a reported 2026 E4 round: "find the bugs in round-robin code wrapped in OOP classes," followed by consistent hashing._

`solution.ts` has a round-robin balancer, which Developer Console's agent gateway uses to spread requests across model-serving backends, and a consistent hash ring. Engineers report:

- "The balancer crashes after a few requests."
- "Traffic still goes to nodes we marked down during an incident."
- "After we removed a node, one backend got hammered."
- "Removing a node from the hash ring didn't drain it."

**There are 6 bugs.** Fix them in place in `solution.ts`. `fnv1a` is correct; don't touch it.

Run: `npx vitest 01-load-balancer`

## How to practise this round

1. **Don't start by reading the tests.** Read the code top to bottom first and say what each method is *supposed* to do. Interviewers watch for this.
2. Pick one failing test, reproduce it, and **trace by hand** (cursor values, array contents) before you change anything. The 2026 candidate who passed said this is what worked.
3. Fix one bug at a time and re-run. Say the root cause out loud ("operator precedence: `%` binds tighter than `+`"), not just the symptom.
4. When everything passes, ask yourself what's still wrong that the tests don't catch. Is there anything you'd want to add?

## Follow-ups the interviewer may ask

- "Now write consistent hashing from scratch." Close `solution.ts` and do it in a blank file: sorted ring, virtual nodes, binary search with wrap-around. State the complexity: add is O(R log N), lookup is O(log N).
- Why virtual nodes? What happens to the key distribution with `replicas = 1`?
- Make `next()` safe when called from many threads (Java/Kotlin), e.g. with `AtomicInteger.getAndIncrement() % n`. What breaks when the list changes concurrently?
- Weighted round robin: node A should get 3× the traffic of B. Smooth weighted round robin (nginx-style) vs. repeating A three times in the list.
- When would you pick consistent hashing over round robin? (cache affinity, sticky sessions, sharding)

Spoilers: [BUGS.md](BUGS.md) lists every bug. The fixed code is in `reference.ts`.
