import { Router } from "express";
import { pool } from "../db/pool.js";
import {
  listGymsWithStats,
  liveSnapshot,
  analyticsForGym,
  globalSummary,
  activityFeed,
} from "../services/statsService.js";

export const gymsRouter = Router();

gymsRouter.get("/summary", async (_req, res) => {
  try {
    const s = await globalSummary();
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

gymsRouter.get("/feed", async (_req, res) => {
  try {
    const rows = await activityFeed(20);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

gymsRouter.get("/", async (_req, res) => {
  try {
    const gyms = await listGymsWithStats();
    res.json(gyms);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

gymsRouter.get("/:id/live", async (req, res) => {
  try {
    const snap = await liveSnapshot(req.params.id);
    if (!snap) return res.status(404).json({ error: "Gym not found" });
    res.json(snap);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

gymsRouter.get("/:id/analytics", async (req, res) => {
  const dr = req.query.dateRange || "7d";
  if (!["7d", "30d", "90d"].includes(dr))
    return res.status(400).json({ error: "Invalid dateRange" });
  try {
    const ex = await pool.query(`SELECT 1 FROM gyms WHERE id = $1`, [
      req.params.id,
    ]);
    if (!ex.rows[0]) return res.status(404).json({ error: "Gym not found" });
    const analytics = await analyticsForGym(req.params.id, dr);
    res.json(analytics);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});
