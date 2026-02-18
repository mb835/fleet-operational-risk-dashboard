import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = 3001;

/* ---------------------------
   MIDDLEWARE
---------------------------- */

app.use(cors());

/* ---------------------------
   ENV VALIDATION
---------------------------- */

const BASE_URL = process.env.GPS_API_BASE;
const USERNAME = process.env.GPS_API_USER;
const PASSWORD = process.env.GPS_API_PASSWORD;

if (!BASE_URL || !USERNAME || !PASSWORD) {
  console.error("❌ Missing GPS API environment variables.");
  console.error("Required:");
  console.error("GPS_API_BASE");
  console.error("GPS_API_USER");
  console.error("GPS_API_PASSWORD");
  process.exit(1);
}

/* ---------------------------
   AUTH HEADER
---------------------------- */

function getAuthHeaders() {
  const credentials = Buffer.from(
    `${USERNAME}:${PASSWORD}`
  ).toString("base64");

  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };
}

/* ---------------------------
   PROXY HANDLER
---------------------------- */

async function proxyRequest(res, url) {
  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: "Upstream API error",
        status: response.status,
        message: text,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({
      error: "Proxy error",
      message: "Failed to communicate with GPS API",
    });
  }
}

/* ---------------------------
   ROUTES
---------------------------- */

app.get("/api/groups", async (_, res) => {
  await proxyRequest(res, `${BASE_URL}/groups`);
});

app.get("/api/vehicles/:groupCode", async (req, res) => {
  const { groupCode } = req.params;

  await proxyRequest(
    res,
    `${BASE_URL}/vehicles/group/${groupCode}`
  );
});

app.get("/api/vehicle/:vehicleCode/eco", async (req, res) => {
  const { vehicleCode } = req.params;

  const to = new Date();
  const from = new Date(
    to.getTime() - 24 * 60 * 60 * 1000
  );

  const format = (date) =>
    date.toISOString().slice(0, 16);

  const fromStr = format(from);
  const toStr = format(to);

  await proxyRequest(
    res,
    `${BASE_URL}/vehicle/${vehicleCode}/eco-driving-events?from=${fromStr}&to=${toStr}`
  );
});

/* ---------------------------
   FUEL / SENSOR ROUTE
---------------------------- */

app.get("/api/vehicle/:vehicleCode/sensors/:sensorNames", async (req, res) => {
  const { vehicleCode, sensorNames } = req.params;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: "Missing required query params: from, to" });
  }

  await proxyRequest(
    res,
    `${BASE_URL}/vehicle/${vehicleCode}/sensors/${sensorNames}?from=${from}&to=${to}`
  );
});

/* ---------------------------
   FUEL ANOMALY DETECTION ROUTE
---------------------------- */

app.get("/api/vehicle/:vehicleCode/fuelAnomaly", async (req, res) => {
  const { vehicleCode } = req.params;

  if (!vehicleCode || typeof vehicleCode !== "string" || !vehicleCode.trim()) {
    return res.status(400).json({ error: "Invalid vehicleCode parameter" });
  }

  const debugFuelDrop = req.query.debugFuelDrop;

  if (process.env.NODE_ENV !== "production" && debugFuelDrop) {
    const fuelDrop = Number(debugFuelDrop);
    const durationMinutes = 5;

    if (fuelDrop > 5) {
      return res.json({
        status: "anomaly",
        severity: "high",
        fuelDrop,
        durationMinutes,
        riskImpact: 3,
        reason: "Úbytek paliva během stání",
      });
    }

    if (fuelDrop >= 3) {
      return res.json({
        status: "anomaly",
        severity: "low",
        fuelDrop,
        durationMinutes,
        riskImpact: 1,
        reason: "Menší úbytek paliva během stání",
      });
    }

    return res.json({ status: "normal", riskImpact: 0 });
  }

  // Fetch last 30 minutes — enough to capture 3–5 readings at typical GPS poll rates
  const to   = new Date();
  const from = new Date(to.getTime() - 90 * 60 * 1000);
  const fmt  = (d) => d.toISOString().slice(0, 16);

  const url = `${BASE_URL}/vehicle/${vehicleCode}/sensors/FuelActualVolume,Speed?from=${fmt(from)}&to=${fmt(to)}`;

  let raw;
  try {
    const response = await fetch(url, { headers: getAuthHeaders() });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: "Upstream API error",
        status: response.status,
        message: text,
      });
    }

    raw = await response.json();
  } catch (err) {
    console.error("fuelAnomaly proxy error:", err);
    return res.status(500).json({ error: "Failed to reach GPS API" });
  }

  // Parse per-sensor format: [{ Name, data: [{t, v}] }]
  if (!Array.isArray(raw)) {
    return res.json({ status: "insufficient_data", riskImpact: 0 });
  }

  const findSensor = (name) => {
    const item = raw.find(
      (i) => (i.Name ?? i.name ?? "").toLowerCase() === name.toLowerCase()
    );
    return (item?.data ?? item?.Data ?? [])
      .filter((p) => p.t && p.v !== undefined)
      .sort((a, b) => a.t.localeCompare(b.t));
  };

  const fuelPoints  = findSensor("FuelActualVolume");
  const speedPoints = findSensor("Speed");

  // Dev-only simulation: bypass sensor data requirements when debugFuelDrop is set
  const isDebugMode   = process.env.NODE_ENV !== "production" &&
                        debugFuelDrop !== undefined &&
                        !isNaN(parseFloat(debugFuelDrop));

  // Need at least two fuel readings to detect a drop (skipped in debug mode)
  if (!isDebugMode && fuelPoints.length < 2) {
    return res.json({ status: "insufficient_data", riskImpact: 0 });
  }

  let fuelDrop, durationMinutes, isStationary;

  if (isDebugMode) {
    fuelDrop        = parseFloat(debugFuelDrop);
    durationMinutes = 5;
    isStationary    = true;
  } else {
    // Take the last two fuel records
    const prev = fuelPoints.at(-2);
    const curr = fuelPoints.at(-1);

    fuelDrop = parseFloat((prev.v - curr.v).toFixed(2));

    // Ignore refueling events and sensor noise
    if (fuelDrop <= 0) {
      return res.json({ status: "normal" });
    }

    // Duration between the two readings in minutes
    durationMinutes = parseFloat(
      ((new Date(curr.t).getTime() - new Date(prev.t).getTime()) / 60_000).toFixed(1)
    );

    if (durationMinutes <= 0) {
      return res.json({ status: "insufficient_data", riskImpact: 0 });
    }

    // Speed record whose timestamp is closest to the current fuel reading
    const currTime = new Date(curr.t).getTime();
    const closestSpeed = speedPoints.length > 0
      ? speedPoints.reduce((best, p) =>
          Math.abs(new Date(p.t).getTime() - currTime) <
          Math.abs(new Date(best.t).getTime() - currTime)
            ? p
            : best
        )
      : null;
    const currentSpeed = closestSpeed?.v ?? null;
    isStationary = currentSpeed !== null && currentSpeed < 3;
  }

  // Classification
  if (isStationary && fuelDrop > 5 && durationMinutes <= 10) {
    return res.json({
      status: "anomaly",
      severity: "high",
      reason: "Úbytek paliva během stání",
      fuelDrop,
      durationMinutes,
      riskImpact: 3,
    });
  }

  if (isStationary && fuelDrop >= 3 && fuelDrop <= 5) {
    return res.json({
      status: "anomaly",
      severity: "low",
      reason: "Menší úbytek paliva během stání",
      fuelDrop,
      durationMinutes,
      riskImpact: 1,
    });
  }

  return res.json({ status: "normal", riskImpact: 0 });
});

/* ---------------------------
   START SERVER
---------------------------- */

app.listen(PORT, () => {
  console.log(
    `🚀 Proxy server running on http://localhost:${PORT}`
  );
});
