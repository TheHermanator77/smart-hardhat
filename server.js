require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// --- Simple API Key Middleware ---
function requireKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ---------------- HEALTH ----------------
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// ---------------- INSERT (Arduino) ----------------
app.post("/api/impact", requireKey, async (req, res) => {
  try {
    const { impact, light, g_force, light_raw } = req.body;

    const [result] = await pool.query(
      `INSERT INTO impact_events (hat_id, impact, light_state, g_force, light_raw)
       VALUES (1, ?, ?, ?, ?)`,
      [impact, light, g_force, light_raw]
    );

    res.status(201).json({ inserted: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database insert failed" });
  }
});

// ---------------- GET LATEST (Alexa) ----------------
app.get("/api/impact/latest", requireKey, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT impact, light_state, g_force, created_at
       FROM impact_events
       ORDER BY created_at DESC
       LIMIT 1`
    );

    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: "Query failed" });
  }
});

// ---------------- UPDATE HARD HAT ----------------
app.put("/api/hardhat", requireKey, async (req, res) => {
  try {
    const { nickname, owner_name } = req.body;

    await pool.query(
      `UPDATE hard_hats SET nickname=?, owner_name=? WHERE id=1`,
      [nickname, owner_name]
    );

    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// ---------------- DELETE EVENTS ----------------
app.delete("/api/events", requireKey, async (req, res) => {
  try {
    const [result] = await pool.query(`DELETE FROM impact_events`);
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ---------------- INNER JOIN (RUBRIC PROOF) ----------------
app.get("/api/events", requireKey, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        h.nickname,
        h.owner_name,
        e.impact,
        e.light_state,
        e.g_force,
        e.created_at
      FROM impact_events e
      INNER JOIN hard_hats h ON e.hat_id = h.id
      ORDER BY e.created_at DESC`
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Join query failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
