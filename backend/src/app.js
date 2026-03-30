import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { waitForDb, pool } from "./db/pool.js";
import { runSeed } from "./db/seeds/seed.js";
import { gymsRouter } from "./routes/gyms.js";
import { analyticsRouter } from "./routes/analytics.js";
import { anomaliesRouter } from "./routes/anomalies.js";
import { createSimulatorRouter } from "./routes/simulator.js";
import { attachWebSocketServer, makeBroadcaster } from "./websocket/broadcast.js";
import { runAnomalyCycle } from "./services/anomalyService.js";

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const broadcast = makeBroadcaster();
app.use("/api/gyms", gymsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/anomalies", anomaliesRouter);
app.use("/api/simulator", createSimulatorRouter(broadcast));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
attachWebSocketServer(wss);

async function refreshHourlyStats() {
  try {
    await pool.query("REFRESH MATERIALIZED VIEW gym_hourly_stats");
  } catch (e) {
    console.error("refreshHourlyStats", e);
  }
}

async function main() {
  console.log("Waiting for database...");
  await waitForDb();
  console.log("Running seed check...");
  await runSeed();
  console.log("Backend ready.");

  setInterval(() => {
    runAnomalyCycle((type, payload) => broadcast(type, payload)).catch((e) =>
      console.error("anomaly cycle", e)
    );
  }, 30_000);

  setInterval(refreshHourlyStats, 15 * 60 * 1000);

  setTimeout(() => {
    runAnomalyCycle((type, payload) => broadcast(type, payload)).catch(
      console.error
    );
  }, 3000);

  const port = Number(process.env.PORT || 3001);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Listening on ${port}`);
  });
}

if (!process.env.JEST_WORKER_ID) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { app, server };
