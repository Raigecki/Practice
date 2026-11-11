# Dasher Pay

_Format: 60 minutes. Parts are revealed one at a time. Don't read ahead._

---

## Part 1

A Dasher is a driver who picks up food from restaurants and delivers it to customers. A Dasher can carry more than one order at a time.

During a shift, our system records an event every time an order changes state for a Dasher:

| Status      | Meaning                                |
| ----------- | -------------------------------------- |
| `ACCEPTED`  | The Dasher accepted the order          |
| `FULFILLED` | The Dasher delivered the order         |
| `CANCELED`  | The order was canceled before delivery |

You're given one Dasher's events for one day, sorted by time. Each event has an order ID, a Dasher ID, a timestamp, and a status.

**Write a function that returns the total time the Dasher was active.** A Dasher is active whenever they have at least one ongoing order. Time with no ongoing orders is idle and doesn't count.

### Example

```
08:30  order A  ACCEPTED
09:10  order A  FULFILLED
10:20  order B  ACCEPTED
12:15  order C  ACCEPTED
12:45  order B  FULFILLED
14:25  order C  FULFILLED
```

Output: **285 minutes** (08:30–09:10 is 40 minutes, 10:20–14:25 is 245 minutes).

You choose how to represent the input. Please define your data types before you write the logic.

---

## Part 2

Now we want to pay the Dasher.

A Dasher earns **$0.30 per minute for each ongoing order**. If a Dasher carries 3 orders for 1 minute, they earn $0.90 for that minute.

**Write a function that returns the Dasher's total pay for the day.**

### Example

```
06:15  order A  ACCEPTED
06:18  order B  ACCEPTED
06:36  order A  FULFILLED
06:45  order B  FULFILLED
```

| Window      | Ongoing orders | Pay                 |
| ----------- | -------------- | ------------------- |
| 06:15–06:18 | 1              | 3 × $0.30 = $0.90   |
| 06:18–06:36 | 2              | 18 × $0.60 = $10.80 |
| 06:36–06:45 | 1              | 9 × $0.30 = $2.70   |

Output: **$14.40**

Some orders are canceled after they are accepted. Make sure your solution handles that case.

---

## Part 3

We're adding two new statuses so we can track when Dashers wait at restaurants:

| Status      | Meaning                                            |
| ----------- | -------------------------------------------------- |
| `ARRIVED`   | The Dasher arrived at the restaurant for the order |
| `PICKED_UP` | The Dasher picked up the order                     |

An order's lifecycle is now `ACCEPTED → ARRIVED → PICKED_UP → FULFILLED`, and it can be `CANCELED` at any point.

While a Dasher waits at a restaurant, they aren't making progress on their other orders. **Time spent waiting for an order should be billed only to that order, not to the other orders the Dasher is carrying.**

**Update your pay calculation.**

### Example

```
10:00  order A  ACCEPTED
10:05  order B  ACCEPTED
10:10  order A  ARRIVED
10:20  order A  PICKED_UP
10:30  order A  FULFILLED
10:40  order B  FULFILLED
```

| Window      | Billed orders    | Minutes × multiplier |
| ----------- | ---------------- | -------------------- |
| 10:00–10:05 | A                | 5 × 1                |
| 10:05–10:10 | A, B             | 5 × 2                |
| 10:10–10:20 | A only (waiting) | 10 × 1               |
| 10:20–10:30 | A, B             | 10 × 2               |
| 10:30–10:40 | B                | 10 × 1               |

Output: 55 billed minutes × $0.30 = **$16.50**

---

## Part 4

To bring more Dashers online at busy times, we pay **double** during peak hours.

You get a second input: a list of peak windows, such as `[11:00–14:00, 17:00–19:00]`. Both the events and the peak windows are already sorted by time.

**Update your pay calculation so that minutes inside a peak window pay 2× the normal rate.** An order that runs across a peak boundary is paid the normal rate up to the boundary and the peak rate after it.

**Constraint:** don't combine the two lists and re-sort them. Take advantage of the fact that they're both already sorted.

For this part, use the Part 2 pay rules (ignore restaurant wait time).

### Example

Peak windows: `11:00–14:00`, `17:00–19:00`

```
16:45  order A  ACCEPTED
17:00  order B  ACCEPTED
17:15  order A  FULFILLED
17:20  order B  FULFILLED
```

- Order A: 15 normal minutes ($4.50) + 15 peak minutes ($9.00)
- Order B: 20 peak minutes ($12.00)

Output: **$25.50**

---

## Discussion

Today this is a batch script. An upstream system wants to call it as a service to pay Dashers.

- How would you design the API?
- What happens if events arrive out of order, more than once, or after the day has been paid out?
- A downstream service you depend on, such as payouts or rate config, is slow or down. What do you do?
- What would you log or store so that someone can audit how a payout was calculated?

## Discussion answers

- 1. The API would at least need an endpoint for aknowledging the event so it would be
- POST dasher/aknowledge with a body that has the event and status, The timestamp would be recorded by
- the backend. At some point in the day, maybe at midnight or whenever pay time is decided,
- An asynchronous service will calculate the payout for the dasher using the algorithm above

- Correction: The client has to record the timestamp because the dasher can have bad service at certain
- locations. The client also needs to attach an idempotency key otherwise retries can count as multiple events.
- API: POST /dasher/{id}/earnings - to calculate current earnings
- We will probably use UTC

- 2. For out of order events, our code earlier ignores them and counts them as invalid. Instead,
- I would store them in a map or set for events that have a "FULFILED" but no "ACCEPTED" and when
  the correct events come, I can insert them back into the array.
  For the ones that have been payed out, there really is no way to stick them back in because the
  multiplier depends on whether we are waiting at a restaurant (between 'ARRIVED' and 'PICKED_UP'), else
  the pay is based on the number of active events. We could stagger the pay (pay 2 - 3 days later) to
  give the highest chances that all of the events come

- Correction: If an event arrives after payout, we can insert it into the right place, recalculate
  and issue a correction ledger
- For invalid events, we can move them to a separate table and audit them later
- We can calculate in real time whenever a dasher opens the pay page

- 3. If the downstream service is slow or down, I can set up a queue or store that day's set of events in
     a DB, and when the service comes back, the service comes and process them asynchronously, then sends
     a push notification to the client
- Kafka is like SQS except the messages don't get deleted and multiple consumers can read from the queue

- Correction
  Mention retry and putting the event ina dead-letter queue and send an alert after N failures
  always use idempotency key such as ${dasher_id-event_id-calc_version}
- Dead letter queue - if a message can't be processed correctly after N tries, it is moved to a dead letter queue
  where a human looks at it and drives it back into the queue
- Payout scheme: 1 DB transaction that inserts message into queue with amount and status pending. Worker polls
  the pending rows and calls provider with idempotency_key = payout.id and mars the row as sent. if anything fails
  the row is still marked as pending. Worker retires, BUT since idempotency_key, pay provider doesn't pay twice.

- 4. the DB schema would be a table where the columns are event_id, order_id dasher_id, timestamp,

     customer_id and status. A simple query to select unique order_id order_by timestamp can show us when the
     peak hours are where we can construct the peak windows. peak windows can be stored in a different table
     by an async service for faster retrieval in the future.

- Correction:
  Add received_at by BE.

- Data should be split into 3 categories:
  - Events - "Order was accepted at A"
  - Configurations - "Base rate is 302; Peak is at 12:00 PM - 2:00 PM" (this is in case a new algorithm gives
    a different result)
  - Payment - "Dasher paid $42.00 on x date"
