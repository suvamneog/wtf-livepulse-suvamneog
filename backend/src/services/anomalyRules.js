/**
 * Pure rules for unit tests (GUIDE.MD anomaly matrix).
 * Times are wall-clock minutes 0–1440 for "operating hours" checks when not using DB times.
 */

export function isWithinOperatingHoursUtc(now, opensAtHours, closesAtHours) {
  const h =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  return h >= opensAtHours && h < closesAtHours;
}

export function wallHourInTz(date, timeZone) {
  const f = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = f.formatToParts(date);
  const hh = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hh + mm / 60;
}

export function shouldFireZeroCheckins({
  gymStatus,
  lastCheckinAt,
  now,
  opensAtHours,
  closesAtHours,
  idleHours = 2,
  timeZone = "Asia/Kolkata",
}) {
  if (gymStatus !== "active") return false;
  const ch = wallHourInTz(now, timeZone);
  if (ch < opensAtHours || ch >= closesAtHours) return false;
  if (!lastCheckinAt) return true;
  const ms = idleHours * 60 * 60 * 1000;
  return now.getTime() - new Date(lastCheckinAt).getTime() >= ms;
}

export function shouldFireCapacityBreach({ occupancy, capacity }) {
  return occupancy > capacity * 0.9;
}

export function shouldResolveCapacityBreach({ occupancy, capacity }) {
  return occupancy < capacity * 0.85;
}

export function shouldFireRevenueDrop({
  todayRevenue,
  sameWeekdayLastWeekRevenue,
  thresholdRatio = 0.7,
}) {
  if (sameWeekdayLastWeekRevenue <= 0) return false;
  return todayRevenue < sameWeekdayLastWeekRevenue * thresholdRatio;
}

export function shouldResolveRevenueDrop({
  todayRevenue,
  sameWeekdayLastWeekRevenue,
  recoveryRatio = 0.8,
}) {
  if (sameWeekdayLastWeekRevenue <= 0) return true;
  return todayRevenue >= sameWeekdayLastWeekRevenue * recoveryRatio;
}
