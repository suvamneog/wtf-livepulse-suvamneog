import { Router } from "express";
import {
  startSimulator,
  stopSimulator,
  resetSimulator,
  getSimulatorState,
} from "../services/simulatorService.js";

export function createSimulatorRouter(broadcast) {
  const router = Router();

  router.post("/start", (req, res) => {
    const s = req.body?.speed;
    if (![1, 5, 10].includes(s))
      return res.status(400).json({ error: "speed must be 1, 5, or 10" });
    startSimulator(s, broadcast);
    res.json({ status: "running", speed: s });
  });

  router.post("/stop", (_req, res) => {
    stopSimulator();
    res.json({ status: "paused" });
  });

  router.post("/reset", async (_req, res) => {
    await resetSimulator();
    res.json({ status: "reset" });
  });

  router.get("/state", (_req, res) => {
    res.json(getSimulatorState());
  });

  return router;
}
