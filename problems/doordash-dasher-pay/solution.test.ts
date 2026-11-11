import { activeMinutes, basicPay, peakPay, storeWaitPay } from "./solution";
import type { DasherEvent, PeakWindow, Status } from "./types";

// "17:30" -> minutes since midnight
const hm = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const ev = (orderId: string, time: string, status: Status): DasherEvent => ({
  orderId,
  dasherId: "d1",
  timestamp: hm(time),
  status,
});

const win = (start: string, end: string): PeakWindow => ({ start: hm(start), end: hm(end) });

const rate = { baseRateCents: 30 };

describe("DoorDash: Dasher Pay", () => {
  describe("Part 1: activeMinutes", () => {
    describe("basic", () => {
      it("single order", () => {
        expect(activeMinutes([ev("a", "10:00", "ACCEPTED"), ev("a", "10:30", "FULFILLED")])).toBe(30);
      });

      it("prompt example (8:30 → 9:10, 10:20 → 14:25)", () => {
        const events = [
          ev("a", "08:30", "ACCEPTED"),
          ev("a", "09:10", "FULFILLED"),
          ev("b", "10:20", "ACCEPTED"),
          ev("c", "12:15", "ACCEPTED"),
          ev("b", "12:45", "FULFILLED"),
          ev("c", "14:25", "FULFILLED"),
        ];
        expect(activeMinutes(events)).toBe(40 + 245);
      });

      it("overlapping orders do not multiply time", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:15", "ACCEPTED"),
          ev("a", "10:30", "FULFILLED"),
          ev("b", "10:45", "FULFILLED"),
        ];
        expect(activeMinutes(events)).toBe(45);
      });
    });

    describe("corner cases", () => {
      it("no events", () => {
        expect(activeMinutes([])).toBe(0);
      });

      it("nested order", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:10", "ACCEPTED"),
          ev("b", "10:20", "FULFILLED"),
          ev("a", "11:00", "FULFILLED"),
        ];
        expect(activeMinutes(events)).toBe(60);
      });

      it("back-to-back orders at the same minute leave no gap", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:30", "ACCEPTED"),
          ev("a", "10:30", "FULFILLED"),
          ev("b", "11:00", "FULFILLED"),
        ];
        expect(activeMinutes(events)).toBe(60);
      });

      it("canceled order still counts as active until canceled", () => {
        expect(activeMinutes([ev("a", "10:00", "ACCEPTED"), ev("a", "10:20", "CANCELED")])).toBe(20);
      });

      it("accepted and fulfilled in the same minute", () => {
        expect(activeMinutes([ev("a", "10:00", "ACCEPTED"), ev("a", "10:00", "FULFILLED")])).toBe(0);
      });

      it("order never closed is ignored", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "11:00", "ACCEPTED"),
          ev("b", "11:10", "FULFILLED"),
        ];
        expect(activeMinutes(events)).toBe(10);
      });
    });
  });

  describe("Part 2: basicPay", () => {
    describe("basic", () => {
      it("single order", () => {
        expect(basicPay([ev("a", "10:00", "ACCEPTED"), ev("a", "10:30", "FULFILLED")], rate)).toBe(30 * 30);
      });

      it("overlapping orders multiply the rate", () => {
        // 10:00-10:15 ×1, 10:15-10:30 ×2, 10:30-10:45 ×1 = 60 order-minutes
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:15", "ACCEPTED"),
          ev("a", "10:30", "FULFILLED"),
          ev("b", "10:45", "FULFILLED"),
        ];
        expect(basicPay(events, rate)).toBe(60 * 30);
      });

      it("3 concurrent orders for 1 minute = 3 × rate", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:00", "ACCEPTED"),
          ev("c", "10:00", "ACCEPTED"),
          ev("a", "10:01", "FULFILLED"),
          ev("b", "10:01", "FULFILLED"),
          ev("c", "10:01", "FULFILLED"),
        ];
        expect(basicPay(events, rate)).toBe(3 * 30);
      });

      it("idle gap between orders is not paid", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("a", "10:10", "FULFILLED"),
          ev("b", "11:00", "ACCEPTED"),
          ev("b", "11:10", "FULFILLED"),
        ];
        expect(basicPay(events, rate)).toBe(20 * 30);
      });
    });

    describe("corner cases", () => {
      it("no events", () => {
        expect(basicPay([], rate)).toBe(0);
      });

      const withCancel = [
        ev("a", "10:00", "ACCEPTED"),
        ev("b", "10:10", "ACCEPTED"),
        ev("a", "10:20", "CANCELED"),
        ev("b", "10:40", "FULFILLED"),
      ];

      it("canceled minutes are paid by default", () => {
        expect(basicPay(withCancel, rate)).toBe((20 + 30) * 30);
      });

      it("canceled minutes are unpaid when payCanceledTime = false", () => {
        expect(basicPay(withCancel, { ...rate, payCanceledTime: false })).toBe(30 * 30);
      });

      it("order never closed is not paid", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "11:00", "ACCEPTED"),
          ev("b", "11:10", "FULFILLED"),
        ];
        expect(basicPay(events, rate)).toBe(10 * 30);
      });
    });
  });

  describe("Part 3: storeWaitPay", () => {
    describe("basic", () => {
      it("without wait events, matches basicPay", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:15", "ACCEPTED"),
          ev("a", "10:30", "FULFILLED"),
          ev("b", "10:45", "FULFILLED"),
        ];
        expect(storeWaitPay(events, rate)).toBe(60 * 30);
      });

      it("wait at store is billed only to the waiting order", () => {
        // 10:00-10:05 ×1, 10:05-10:10 ×2, 10:10-10:20 a waiting → ×1, 10:20-10:30 ×2, 10:30-10:40 ×1
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:05", "ACCEPTED"),
          ev("a", "10:10", "ARRIVED"),
          ev("a", "10:20", "PICKED_UP"),
          ev("a", "10:30", "FULFILLED"),
          ev("b", "10:40", "FULFILLED"),
        ];
        expect(storeWaitPay(events, rate)).toBe((5 + 10 + 10 + 20 + 10) * 30);
      });

      it("single order's own wait is still paid", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("a", "10:05", "ARRIVED"),
          ev("a", "10:15", "PICKED_UP"),
          ev("a", "10:30", "FULFILLED"),
        ];
        expect(storeWaitPay(events, rate)).toBe(30 * 30);
      });
    });

    describe("corner cases", () => {
      it("two orders waiting at the same store bill the wait once", () => {
        // 10:00-10:05 ×2, 10:05-10:15 both waiting → ×1, 10:15-10:30 ×2
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:00", "ACCEPTED"),
          ev("a", "10:05", "ARRIVED"),
          ev("b", "10:05", "ARRIVED"),
          ev("a", "10:15", "PICKED_UP"),
          ev("b", "10:15", "PICKED_UP"),
          ev("a", "10:30", "FULFILLED"),
          ev("b", "10:30", "FULFILLED"),
        ];
        expect(storeWaitPay(events, rate)).toBe((10 + 10 + 30) * 30);
      });

      it("canceled while waiting ends the wait at cancel time", () => {
        // 10:00-10:10 ×2, 10:10-10:20 a waiting → ×1, 10:20-10:40 ×1
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:00", "ACCEPTED"),
          ev("a", "10:10", "ARRIVED"),
          ev("a", "10:20", "CANCELED"),
          ev("b", "10:40", "FULFILLED"),
        ];
        expect(storeWaitPay(events, rate)).toBe((20 + 10 + 20) * 30);
      });

      it("unpaid canceled order's wait does not suppress other orders", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:00", "ACCEPTED"),
          ev("a", "10:10", "ARRIVED"),
          ev("a", "10:20", "CANCELED"),
          ev("b", "10:40", "FULFILLED"),
        ];
        expect(storeWaitPay(events, { ...rate, payCanceledTime: false })).toBe(40 * 30);
      });

      it("a wait only affects orders ongoing at the same time", () => {
        // x's wait at 09:05-09:15 is long over by the time y is accepted
        const events = [
          ev("x", "09:00", "ACCEPTED"),
          ev("x", "09:05", "ARRIVED"),
          ev("x", "09:15", "PICKED_UP"),
          ev("x", "09:20", "FULFILLED"),
          ev("y", "11:00", "ACCEPTED"),
          ev("y", "11:30", "FULFILLED"),
        ];
        expect(storeWaitPay(events, rate)).toBe((20 + 30) * 30);
      });

      it("unpaid canceled order picked up before canceling does not suppress other orders", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:00", "ACCEPTED"),
          ev("a", "10:10", "ARRIVED"),
          ev("a", "10:20", "PICKED_UP"),
          ev("a", "10:30", "CANCELED"),
          ev("b", "10:40", "FULFILLED"),
        ];
        expect(storeWaitPay(events, { ...rate, payCanceledTime: false })).toBe(40 * 30);
      });

      it("fulfilled order still suppresses others while waiting when payCanceledTime = false", () => {
        // a is never PICKED_UP, so it waits 10:10-10:20 until it is fulfilled
        // 10:00-10:10 ×2, 10:10-10:20 a waiting → ×1, 10:20-10:40 ×1
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("b", "10:00", "ACCEPTED"),
          ev("a", "10:10", "ARRIVED"),
          ev("a", "10:20", "FULFILLED"),
          ev("b", "10:40", "FULFILLED"),
        ];
        expect(storeWaitPay(events, { ...rate, payCanceledTime: false })).toBe((20 + 10 + 20) * 30);
      });
    });
  });

  describe("Part 4: peakPay", () => {
    const evening = [win("17:00", "19:00")];
    const order = (start: string, end: string) => [ev("a", start, "ACCEPTED"), ev("a", end, "FULFILLED")];

    describe("basic", () => {
      it("no peak windows matches basicPay", () => {
        expect(peakPay(order("10:00", "10:30"), [], rate)).toBe(30 * 30);
      });

      it("order fully outside peak", () => {
        expect(peakPay(order("12:00", "12:30"), evening, rate)).toBe(30 * 30);
      });

      it("order fully inside peak pays double", () => {
        expect(peakPay(order("17:30", "18:00"), evening, rate)).toBe(30 * 60);
      });

      it("straddles peak start: cut at the boundary", () => {
        expect(peakPay(order("16:45", "17:15"), evening, rate)).toBe(15 * 30 + 15 * 60);
      });

      it("straddles peak end: cut at the boundary", () => {
        expect(peakPay(order("18:50", "19:10"), evening, rate)).toBe(10 * 60 + 10 * 30);
      });

      it("concurrent orders inside peak multiply and double", () => {
        const events = [
          ev("a", "17:00", "ACCEPTED"),
          ev("b", "17:10", "ACCEPTED"),
          ev("b", "17:20", "FULFILLED"),
          ev("a", "17:30", "FULFILLED"),
        ];
        expect(peakPay(events, evening, rate)).toBe(40 * 60);
      });
    });

    describe("corner cases", () => {
      it("order spans the whole window", () => {
        expect(peakPay(order("16:00", "20:00"), evening, rate)).toBe(120 * 30 + 120 * 60);
      });

      it("order exactly matches the window", () => {
        expect(peakPay(order("17:00", "19:00"), evening, rate)).toBe(120 * 60);
      });

      it("order ending exactly at peak start is not boosted", () => {
        expect(peakPay(order("16:30", "17:00"), evening, rate)).toBe(30 * 30);
      });

      it("order starting exactly at peak end is not boosted", () => {
        expect(peakPay(order("19:00", "19:30"), evening, rate)).toBe(30 * 30);
      });

      it("one order spanning multiple windows", () => {
        // 360 minutes total, 30 of them in each window
        expect(peakPay(order("11:30", "17:30"), [win("11:00", "12:00"), win("17:00", "19:00")], rate)).toBe(
          360 * 30 + 60 * 30,
        );
      });

      it("windows with no activity contribute nothing", () => {
        const windows = [win("08:00", "09:00"), win("17:00", "19:00"), win("21:00", "22:00")];
        expect(peakPay(order("12:00", "12:30"), windows, rate)).toBe(30 * 30);
      });

      it("multiple orders each hitting a different window", () => {
        const events = [
          ev("a", "10:00", "ACCEPTED"),
          ev("a", "10:30", "FULFILLED"),
          ev("b", "17:15", "ACCEPTED"),
          ev("b", "17:45", "FULFILLED"),
        ];
        const windows = [win("10:15", "10:20"), win("17:00", "17:30")];
        expect(peakPay(events, windows, rate)).toBe(30 * 30 + 5 * 30 + (30 * 30 + 15 * 30));
      });

      it("unpaid canceled order inside peak earns nothing", () => {
        const events = [ev("a", "17:00", "ACCEPTED"), ev("a", "17:20", "CANCELED")];
        expect(peakPay(events, evening, { ...rate, payCanceledTime: false })).toBe(0);
      });
    });
  });
});
