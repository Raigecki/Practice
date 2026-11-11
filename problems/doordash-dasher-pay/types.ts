export type Status = "ACCEPTED" | "ARRIVED" | "PICKED_UP" | "FULFILLED" | "CANCELED";

export interface DasherEvent {
  orderId: string;
  dasherId: string;
  /** Minutes since midnight. */
  timestamp: number;
  status: Status;
}

/** Half-open [start, end) in minutes since midnight. */
export interface PeakWindow {
  start: number;
  end: number;
}

export interface PayOptions {
  /** Pay per order per minute, in cents (avoids float drift, e.g. 30 = $0.30). */
  baseRateCents: number;
  /** Whether ACCEPTED -> CANCELED minutes are paid. Defaults to true. */
  payCanceledTime?: boolean;
}
