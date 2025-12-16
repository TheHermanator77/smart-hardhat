import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

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
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10
});

// ---------------- HEALTH ----------------
app.get("/", (req, res) => {
  res.json({ status: "Smart Hard Hat API running" });
});

// ---------------- API KEY ----------------
app.use("/api", (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ------------- RECEIVE DATA -------------
app.post("/api/impact", async (req, res) => {
  const { impact, light, g_force, light_raw } = req.body;

  if (impact === undefined || light === undefined) {
    return res.status(400).json({ error: "Missing impact or light" });
  }

  try {
    await pool.query(
      `
      INSERT INTO impact_events
        (hat_id, impact, light_state, g_force, light_raw)
      VALUES
        (?, ?, ?, ?, ?)
      `,
      [
        1,
        impact,
        light,
        g_force ?? null,
        light_raw ?? null
      ]
    );

    res.status(201).json({ message: "Impact event recorded" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database insert failed" });
  }
});

// ------------- ALEXA FETCH -------------
app.get("/api/latest", async (req, res) => {
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
      return res.json({ message: "No data yet" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database read failed" });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
