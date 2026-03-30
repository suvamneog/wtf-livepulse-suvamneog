import {
  isWithinOperatingHoursUtc,
  shouldFireZeroCheckins,
  shouldFireCapacityBreach,
  shouldResolveCapacityBreach,
  shouldFireRevenueDrop,
  shouldResolveRevenueDrop,
} from "../../src/services/anomalyRules.js";

describe("anomalyRules", () => {
  test("isWithinOperatingHoursUtc respects window", () => {
    const d = new Date(Date.UTC(2025, 0, 6, 8, 0, 0));
    expect(isWithinOperatingHoursUtc(d, 6, 22)).toBe(true);
    const night = new Date(Date.UTC(2025, 0, 6, 4, 0, 0));
    expect(isWithinOperatingHoursUtc(night, 6, 22)).toBe(false);
  });

  test("zero_checkins fires when idle during operating hours", () => {
    const now = new Date("2025-01-06T10:00:00+05:30");
    const last = new Date(now.getTime() - 3 * 3600 * 1000);
    expect(
      shouldFireZeroCheckins({
        gymStatus: "active",
        lastCheckinAt: last,
        now,
        opensAtHours: 6,
        closesAtHours: 22,
        idleHours: 2,
      })
    ).toBe(true);
  });

  test("zero_checkins does not fire outside operating hours", () => {
    const now = new Date("2025-01-06T23:00:00+05:30");
    expect(
      shouldFireZeroCheckins({
        gymStatus: "active",
        lastCheckinAt: null,
        now,
        opensAtHours: 6,
        closesAtHours: 22,
        idleHours: 2,
      })
    ).toBe(false);
  });

  test("zero_checkins inactive gym", () => {
    const now = new Date(Date.UTC(2025, 0, 6, 10, 0, 0));
    expect(
      shouldFireZeroCheckins({
        gymStatus: "inactive",
        lastCheckinAt: null,
        now,
        opensAtHours: 6,
        closesAtHours: 22,
      })
    ).toBe(false);
  });

  test("capacity_breach fires above 90%", () => {
    expect(shouldFireCapacityBreach({ occupancy: 91, capacity: 100 })).toBe(
      true
    );
    expect(shouldFireCapacityBreach({ occupancy: 90, capacity: 100 })).toBe(
      false
    );
  });

  test("capacity_breach resolves below 85%", () => {
    expect(
      shouldResolveCapacityBreach({ occupancy: 84, capacity: 100 })
    ).toBe(true);
    expect(
      shouldResolveCapacityBreach({ occupancy: 86, capacity: 100 })
    ).toBe(false);
  });

  test("revenue_drop fires when today < 70% of baseline", () => {
    expect(
      shouldFireRevenueDrop({
        todayRevenue: 50,
        sameWeekdayLastWeekRevenue: 100,
      })
    ).toBe(true);
    expect(
      shouldFireRevenueDrop({
        todayRevenue: 80,
        sameWeekdayLastWeekRevenue: 100,
      })
    ).toBe(false);
  });

  test("revenue_drop no baseline", () => {
    expect(
      shouldFireRevenueDrop({
        todayRevenue: 0,
        sameWeekdayLastWeekRevenue: 0,
      })
    ).toBe(false);
  });

  test("revenue_drop resolves near baseline", () => {
    expect(
      shouldResolveRevenueDrop({
        todayRevenue: 85,
        sameWeekdayLastWeekRevenue: 100,
      })
    ).toBe(true);
  });
});
