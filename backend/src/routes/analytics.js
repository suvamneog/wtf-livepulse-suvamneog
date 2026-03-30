import { Router } from "express";
import { crossGymRevenue } from "../services/statsService.js";

export const analyticsRouter = Router();

analyticsRouter.get("/cross-gym", async (_req, res) => {
  try {
    const rows = await crossGymRevenue();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});
