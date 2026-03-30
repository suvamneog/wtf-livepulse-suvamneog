/** Exact gym rows + member distribution (GUIDE.MD) */

export const GYM_ROWS = [
  {
    name: "WTF Gyms — Lajpat Nagar",
    city: "New Delhi",
    capacity: 220,
    opens: "05:30",
    closes: "22:30",
    memberCount: 650,
    planPct: { monthly: 0.5, quarterly: 0.3, annual: 0.2 },
    activePct: 0.88,
    openCheckinsRange: [15, 25],
    tier: "medium",
  },
  {
    name: "WTF Gyms — Connaught Place",
    city: "New Delhi",
    capacity: 180,
    opens: "06:00",
    closes: "22:00",
    memberCount: 550,
    planPct: { monthly: 0.4, quarterly: 0.4, annual: 0.2 },
    activePct: 0.85,
    openCheckinsRange: [15, 25],
    tier: "medium",
  },
  {
    key: "bandra",
    name: "WTF Gyms — Bandra West",
    city: "Mumbai",
    capacity: 300,
    opens: "05:00",
    closes: "23:00",
    memberCount: 750,
    planPct: { monthly: 0.4, quarterly: 0.4, annual: 0.2 },
    activePct: 0.9,
    openCheckinsRange: [275, 285],
    tier: "large",
    bandraBreach: true,
  },
  {
    name: "WTF Gyms — Powai",
    city: "Mumbai",
    capacity: 250,
    opens: "05:30",
    closes: "22:30",
    memberCount: 600,
    planPct: { monthly: 0.4, quarterly: 0.4, annual: 0.2 },
    activePct: 0.87,
    openCheckinsRange: [10, 14],
    tier: "large",
  },
  {
    name: "WTF Gyms — Indiranagar",
    city: "Bengaluru",
    capacity: 200,
    opens: "05:30",
    closes: "22:00",
    memberCount: 550,
    planPct: { monthly: 0.4, quarterly: 0.4, annual: 0.2 },
    activePct: 0.89,
    openCheckinsRange: [3, 5],
    tier: "medium",
  },
  {
    name: "WTF Gyms — Koramangala",
    city: "Bengaluru",
    capacity: 180,
    opens: "06:00",
    closes: "22:00",
    memberCount: 500,
    planPct: { monthly: 0.4, quarterly: 0.4, annual: 0.2 },
    activePct: 0.86,
    openCheckinsRange: [3, 5],
    tier: "medium",
  },
  {
    name: "WTF Gyms — Banjara Hills",
    city: "Hyderabad",
    capacity: 160,
    opens: "06:00",
    closes: "22:00",
    memberCount: 450,
    planPct: { monthly: 0.5, quarterly: 0.3, annual: 0.2 },
    activePct: 0.84,
    openCheckinsRange: [3, 5],
    tier: "medium",
  },
  {
    name: "WTF Gyms — Sector 18 Noida",
    city: "Noida",
    capacity: 140,
    opens: "06:00",
    closes: "21:30",
    memberCount: 400,
    planPct: { monthly: 0.6, quarterly: 0.25, annual: 0.15 },
    activePct: 0.82,
    openCheckinsRange: [2, 4],
    tier: "small",
  },
  {
    key: "saltlake",
    name: "WTF Gyms — Salt Lake",
    city: "Kolkata",
    capacity: 120,
    opens: "06:00",
    closes: "21:00",
    memberCount: 300,
    planPct: { monthly: 0.6, quarterly: 0.3, annual: 0.1 },
    activePct: 0.8,
    openCheckinsRange: [2, 4],
    tier: "small",
  },
  {
    key: "velachery",
    name: "WTF Gyms — Velachery",
    city: "Chennai",
    capacity: 110,
    opens: "06:00",
    closes: "21:00",
    memberCount: 250,
    planPct: { monthly: 0.6, quarterly: 0.3, annual: 0.1 },
    activePct: 0.78,
    openCheckinsRange: [0, 0],
    tier: "small",
    zeroCheckinScenario: true,
  },
];

export const PLAN_AMOUNTS = {
  monthly: 1499,
  quarterly: 3999,
  annual: 11999,
};

export const DOW_MULT = [0.45, 1.0, 0.95, 0.9, 0.95, 0.85, 0.7]; // Sun..Sat

export function hourMultiplier(hourFloat) {
  if (hourFloat < 5.5 || hourFloat >= 22.5) return 0;
  if (hourFloat < 7) return 0.6;
  if (hourFloat < 10) return 1.0;
  if (hourFloat < 12) return 0.4;
  if (hourFloat < 14) return 0.3;
  if (hourFloat < 17) return 0.2;
  if (hourFloat < 21) return 0.9;
  return 0.35;
}
