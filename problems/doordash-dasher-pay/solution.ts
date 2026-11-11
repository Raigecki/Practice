import type { DasherEvent, PayOptions, PeakWindow } from "./types";

/** Part 1: minutes with at least one ongoing delivery. Overlaps do not multiply. */
export function activeMinutes(events: DasherEvent[]): number {
  const eventsMap = new Set<string>();
  const ignoredEvents = new Set<string>();

  for (const event of events) {
    if (event.status === "ACCEPTED") {
      ignoredEvents.add(event.orderId);
    } else {
      if (ignoredEvents.has(event.orderId)) {
        ignoredEvents.delete(event.orderId);
      }
    }
  }

  let activeEvents = 0;
  let lastEventStart = 0;
  let totalActiveMinutes = 0;

  for (const event of events) {
    if (ignoredEvents.has(event.orderId)) {
      continue;
    }
    if (event.status === "ACCEPTED") {
      eventsMap.add(event.orderId);
      if (activeEvents === 0) {
        lastEventStart = event.timestamp;
      }
      activeEvents++;
    } else {
      if (!eventsMap.has(event.orderId)) {
        break;
      }
      eventsMap.delete(event.orderId);
      activeEvents--;

      if (activeEvents === 0) {
        totalActiveMinutes += event.timestamp - lastEventStart;
      }
    }
  }

  return totalActiveMinutes;
}

/** Part 2: sum over each minute of (ongoing deliveries × base rate). */
export function basicPay(events: DasherEvent[], options: PayOptions): number {
  const eventsMap = new Map<string, number>();

  let totalPay = 0;

  for (const event of events) {
    if (event.status === "ACCEPTED") {
      eventsMap.set(event.orderId, event.timestamp);
    } else {
      if (!eventsMap.has(event.orderId)) {
        continue;
      }
      const rate =
        event.status === "FULFILLED" ||
        options.payCanceledTime ||
        options.payCanceledTime === undefined
          ? options.baseRateCents
          : 0;

      const startTime = eventsMap.get(event.orderId);
      totalPay += (event.timestamp - startTime!) * rate;

      eventsMap.delete(event.orderId);
    }
  }
  return totalPay;
}

/** Part 3: like basicPay, but minutes spent waiting at a store are billed only to the waiting order(s). */
export function storeWaitPay(
  events: DasherEvent[],
  options: PayOptions,
): number {
  const acceptedEvents = new Set<string>();
  const legitEvents = new Set<string>();

  events.forEach((event) => {
    if (event.status === "ACCEPTED") {
      acceptedEvents.add(event.orderId);
    } else if (
      event.status === "FULFILLED" ||
      (event.status === "CANCELED" && options.payCanceledTime !== false)
    ) {
      if (acceptedEvents.has(event.orderId)) {
        legitEvents.add(event.orderId);
      }
    }
  });

  let activeEvents = 0;
  const waitingEvents = new Set<string>();
  let totalPay = 0;
  let prevEventTime = 0;

  for (const event of events) {
    if (!legitEvents.has(event.orderId)) {
      continue;
    }

    const multiplier = waitingEvents.size > 0 ? 1 : activeEvents;
    totalPay +=
      (event.timestamp - prevEventTime) * multiplier * options.baseRateCents;

    if (event.status === "ACCEPTED") {
      activeEvents++;
    } else if (event.status === "ARRIVED") {
      waitingEvents.add(event.orderId);
    } else if (event.status === "PICKED_UP") {
      waitingEvents.delete(event.orderId);
    } else {
      if (waitingEvents.has(event.orderId)) {
        waitingEvents.delete(event.orderId);
      }
      activeEvents--;
    }
    prevEventTime = event.timestamp;
  }
  return totalPay;
}

/** Part 4: like basicPay, but minutes inside a peak window pay double. Do not concat + re-sort the two lists. */
export function peakPay(
  events: DasherEvent[],
  peakWindows: PeakWindow[],
  options: PayOptions,
): number {
  const legitEvents = new Set<string>();
  const acceptedEvents = new Set<string>();

  for (const event of events) {
    if (event.status === "ACCEPTED") {
      acceptedEvents.add(event.orderId);
    } else if (
      event.status === "FULFILLED" ||
      (event.status === "CANCELED" && options.payCanceledTime !== false)
    ) {
      if (acceptedEvents.has(event.orderId)) {
        legitEvents.add(event.orderId);
      }
    }
  }

  let activeEvents = 0;
  let lastEventTime = 0;
  let totalPay = 0;
  const waitingEvents = new Set<string>();

  for (const event of events) {
    if (!legitEvents.has(event.orderId)) {
      continue;
    }

    const multiplier = waitingEvents.size > 0 ? 1 : activeEvents;
    const peakTime = peakWindowOverlap(
      lastEventTime,
      event.timestamp,
      peakWindows,
    );
    const nonPeakTime = event.timestamp - lastEventTime - peakTime;
    totalPay +=
      (peakTime * 2 * multiplier + nonPeakTime * multiplier) *
      options.baseRateCents;
    lastEventTime = event.timestamp;

    if (event.status === "ACCEPTED") {
      activeEvents++;
    } else if (event.status === "ARRIVED") {
      waitingEvents.add(event.orderId);
    } else if (event.status === "PICKED_UP") {
      waitingEvents.delete(event.orderId);
    } else {
      activeEvents--;
      waitingEvents.delete(event.orderId);
    }
  }
  return totalPay;
}

function peakWindowOverlap(
  eventStart: number,
  eventEnd: number,
  peakWindows: PeakWindow[],
): number {
  let totalOverlap = 0;
  for (const window of peakWindows) {
    if (window.end < eventStart || window.start > eventEnd) {
      continue;
    } else if (window.start <= eventStart && window.end >= eventEnd) {
      totalOverlap += eventEnd - eventStart;
      break;
    } else if (window.start > eventStart && window.end < eventEnd) {
      totalOverlap += window.end - window.start;
    } else if (window.end <= eventEnd) {
      totalOverlap += window.end - eventStart;
    } else if (window.start >= eventStart) {
      totalOverlap += eventEnd - window.start;
    }
  }
  return totalOverlap;
}
