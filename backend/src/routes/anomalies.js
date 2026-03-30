import { Router } from "express";
import { listAnomalies, dismissAnomaly } from "../services/anomalyService.js";

export const anomaliesRouter = Router();

anomaliesRouter.get("/", async (req, res) => {
  try {
    const rows = await listAnomalies({
      gym_id: req.query.gym_id,
      severity: req.query.severity,
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

anomaliesRouter.patch("/:id/dismiss", async (req, res) => {
  try {
    const r = await dismissAnomaly(req.params.id);
    if (r.error === "not_found") return res.status(404).json({ error: "Not found" });
    if (r.error === "forbidden")
      return res.status(403).json({ error: "Critical anomalies cannot be dismissed" });
    res.json(r.row);
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});
