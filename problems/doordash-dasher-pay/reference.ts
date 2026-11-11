// Reference solution — spoilers. Tests run against ./solution, not this file.
import type { DasherEvent, PayOptions, PeakWindow } from "./types";

interface Interval {
  start: number;
  end: number;
  canceled: boolean;
  waitStart?: number;
  waitEnd?: number;
}

interface Segment {
  start: number;
  end: number;
  active: number;
  waiting: number;
}

// Pairs each order's ACCEPTED with its FULFILLED/CANCELED. Unclosed or unopened orders are dropped.
function toIntervals(events: DasherEvent[]): Interval[] {
  const open = new Map<string, Omit<Interval, "end" | "canceled">>();
  const out: Interval[] = [];
  for (const e of events) {
    const o = open.get(e.orderId);
    switch (e.status) {
      case "ACCEPTED":
        open.set(e.orderId, { start: e.timestamp });
        break;
      case "ARRIVED":
        if (o) o.waitStart = e.timestamp;
        break;
      case "PICKED_UP":
        if (o) o.waitEnd = e.timestamp;
        break;
      case "FULFILLED":
      case "CANCELED":
        if (!o) break;
        open.delete(e.orderId);
        out.push({ ...o, end: e.timestamp, canceled: e.status === "CANCELED" });
        break;
    }
  }
  return out;
}

// Sweep line: splits the day into sorted, non-overlapping segments with constant counts.
function toSegments(intervals: Interval[]): Segment[] {
  const deltas = new Map<number, { active: number; waiting: number }>();
  const bump = (t: number, active: number, waiting: number) => {
    const d = deltas.get(t) ?? { active: 0, waiting: 0 };
    d.active += active;
    d.waiting += waiting;
    deltas.set(t, d);
  };
  for (const iv of intervals) {
    bump(iv.start, 1, 0);
    bump(iv.end, -1, 0);
    if (iv.waitStart !== undefined) {
      bump(iv.waitStart, 0, 1);
      bump(iv.waitEnd ?? iv.end, 0, -1);
    }
  }

  const times = [...deltas.keys()].sort((a, b) => a - b);
  const segments: Segment[] = [];
  let active = 0;
  let waiting = 0;
  for (let i = 0; i < times.length; i++) {
    const d = deltas.get(times[i])!;
    active += d.active;
    waiting += d.waiting;
    if (i + 1 < times.length && active > 0) {
      segments.push({ start: times[i], end: times[i + 1], active, waiting });
    }
  }
  return segments;
}

function paidSegments(events: DasherEvent[], options: PayOptions): Segment[] {
  const payCanceled = options.payCanceledTime ?? true;
  return toSegments(toIntervals(events).filter((iv) => payCanceled || !iv.canceled));
}

export function activeMinutes(events: DasherEvent[]): number {
  return toSegments(toIntervals(events)).reduce((sum, s) => sum + (s.end - s.start), 0);
}

export function basicPay(events: DasherEvent[], options: PayOptions): number {
  return paidSegments(events, options).reduce(
    (sum, s) => sum + (s.end - s.start) * s.active * options.baseRateCents,
    0,
  );
}

export function storeWaitPay(events: DasherEvent[], options: PayOptions): number {
  return paidSegments(events, options).reduce((sum, s) => {
    // The dasher is one person at one counter, so wait time is billed once.
    const multiplier = s.waiting > 0 ? 1 : s.active;
    return sum + (s.end - s.start) * multiplier * options.baseRateCents;
  }, 0);
}

export function peakPay(events: DasherEvent[], peakWindows: PeakWindow[], options: PayOptions): number {
  let total = 0;
  let j = 0;
  for (const s of paidSegments(events, options)) {
    // Both lists are sorted, so windows ending before this segment never matter again.
    while (j < peakWindows.length && peakWindows[j].end <= s.start) j++;
    let peakMinutes = 0;
    for (let k = j; k < peakWindows.length && peakWindows[k].start < s.end; k++) {
      peakMinutes += Math.min(s.end, peakWindows[k].end) - Math.max(s.start, peakWindows[k].start);
    }
    // Peak minutes are paid twice: once in the base length, once as the bonus.
    total += (s.end - s.start + peakMinutes) * s.active * options.baseRateCents;
  }
  return total;
}
