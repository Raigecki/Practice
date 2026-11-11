# Donations Website

_Format: 60 minutes, system design. Parts are revealed one at a time. Don't read ahead._

Write your answer in [DESIGN.md](DESIGN.md).

---

## Part 1

We're running a short fundraising campaign. For **24 to 48 hours**, users can donate to one of about **10 charities we've picked in advance**. When the campaign ends, the site closes and we pay out the money we raised to each charity.

The campaign will be promoted during a live broadcast, so traffic is spiky. Most of the time it's quiet. Each time the broadcast mentions the site, we expect a burst of up to **~5,000 donations per second** for a few minutes. In total, we expect a few million donations.

A user picks a charity, enters an amount, pays by card, and sees a confirmation. The home page shows a running total for each charity.

**Design the system.** Start with requirements (functional and non-functional), then cover:

- the API
- the data model
- the high-level architecture

We don't store raw card numbers. We use a third-party payment processor (PSP) to charge cards.

---

## Part 2

Let's focus on payment processing.

These things happen in production:

- A user double-clicks "Donate," or their browser retries the request.
- Our call to the PSP times out. We don't know whether the card was charged.
- The PSP charges the card, but our server crashes before it records the result.

**Walk through the donation flow step by step.** Show how you make sure that each donation charges the user **exactly once** and that our records always match the PSP's records. Which states can a donation be in, and what moves it between them?

---

## Part 3

During a traffic burst, the PSP starts to fail. About 30% of requests return errors, and the rest take 10 seconds or more.

**How does the system handle this?** Think about:

- what the user sees while it's happening
- how you keep the PSP's failures from taking down the rest of the site
- what happens to donations that are in progress or failed
- how you find and fix any differences between our records and the PSP's after the fact

---

## Part 4

The business doesn't want to lose donations to a PSP outage. We'll add a **second PSP** as a backup. We'll also accept a **wallet payment method**, like PayPal or Apple Pay.

**Extend the design.** Cover:

- how you decide which PSP gets each payment, and when you fail over
- how you avoid charging a user twice when you retry on the backup PSP
- how you reconcile records across both PSPs
- how payouts to the charities work at the end of the campaign
- how you keep the running totals accurate, or close enough, while all this is going on
