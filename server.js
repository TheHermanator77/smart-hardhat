// server.js (CommonJS)
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(express.json());

// ---------------- CONFIG ----------------
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY;

// ---------------- MYSQL ----------------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
});

// ---------------- HEALTH ----------------
app.get("/", (req, res) => {
  res.json({ status: "Smart Hard Hat API running" });
});

// ---------------- API KEY (protect /api) ----------------
app.use("/api", (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ---------------- HELPERS ----------------
function normalizeImpactToInt(impact) {
  // Accept: 1/2/3, "1"/"2"/"3", "light"/"hard"/"severe", "none"
  if (impact === null || impact === undefined) return 0;

  // number or numeric string
  const asNum = Number(impact);
  if (!Number.isNaN(asNum) && Number.isFinite(asNum)) {
    if (asNum <= 0) return 0;
    if (asNum >= 3) return 3;
    return Math.round(asNum);
  }

  // string labels
  const s = String(impact).trim().toLowerCase();
  if (s === "none") return 0;
  if (s === "light") return 1;
  if (s === "hard") return 2;
  if (s === "severe") return 3;

  return 0;
}

function normalizeLightState(light) {
  // Accept: "dark"/"bright"/"normal"/"none"
  if (light === null || light === undefined) return "none";
  const s = String(light).trim().toLowerCase();
  if (s === "dark") return "dark";
  if (s === "bright") return "bright";
  if (s === "normal") return "normal";
  if (s === "none") return "none";
  return s; // last resort: store whatever came in
}

// ------------- RECEIVE DATA (Arduino POST) -------------
app.post("/api/impact", async (req, res) => {
  const { impact, light, g_force, light_raw } = req.body;

  if (impact === undefined || light === undefined) {
    return res.status(400).json({ error: "Missing impact or light" });
  }

  const impactInt = normalizeImpactToInt(impact);
  const lightState = normalizeLightState(light);

  try {
    await pool.query(
      `
      INSERT INTO impact_events
        (hat_id, impact, light_state, g_force, light_raw)
      VALUES
        (?, ?, ?, ?, ?)
      `,
      [1, impactInt, lightState, g_force ?? null, light_raw ?? null]
    );

    res.status(201).json({ message: "Impact event recorded", impact: impactInt, light_state: lightState });
  } catch (err) {
    console.error("DB insert failed:", err);
    res.status(500).json({ error: "Database insert failed" });
  }
});

// ------------- ALEXA FETCH (NEW: match Alexa path) -------------
// Alexa currently calls: /api/impact/latest :contentReference[oaicite:5]{index=5}
app.get("/api/impact/latest", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT impact, light_state, g_force, light_raw, created_at
      FROM impact_events
      ORDER BY created_at DESC
      LIMIT 1
      `
    );

    if (rows.length === 0) {
      return res.json({});
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("DB read failed:", err);
    res.status(500).json({ error: "Database read failed" });
  }
});

// ------------- BACKWARD COMPAT (keep old route too) -------------
app.get("/api/latest", async (req, res) => {
  // same response as /api/impact/latest
  try {
    const [rows] = await pool.query(
      `
      SELECT impact, light_state, g_force, light_raw, created_at
      FROM impact_events
      ORDER BY created_at DESC
      LIMIT 1
      `
    );

    if (rows.length === 0) return res.json({});
    res.json(rows[0]);
  } catch (err) {
    console.error("DB read failed:", err);
    res.status(500).json({ error: "Database read failed" });
  }
});

// ------------- CLEAR EVENTS (matches your Alexa DELETE) -------------
app.delete("/api/events", async (req, res) => {
  try {
    await pool.query(`DELETE FROM impact_events WHERE hat_id = ?`, [1]);
    res.json({ message: "Helmet impact history cleared" });
  } catch (err) {
    console.error("DB delete failed:", err);
    res.status(500).json({ error: "Database delete failed" });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
