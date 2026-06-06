const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getTypicalTime } = require('../cityTimes');

// GET /api/destinations?origin=Chandigarh
router.get('/', async (req, res) => {
  const origin = req.query.origin || null;

  try {
    const result = await pool.query(`
      SELECT
        d.id, d.name, d.lat, d.lng, d.description, d.image_url,
        l.congestion_score, l.timestamp AS last_updated
      FROM destinations d
      LEFT JOIN LATERAL (
        SELECT congestion_score, timestamp
        FROM travel_logs tl
        WHERE tl.destination = d.name
        ORDER BY tl.timestamp DESC
        LIMIT 1
      ) l ON true
    `);

    const rows = result.rows.map(d => {
      const typical = getTypicalTime(origin, d.name);
      const score = d.congestion_score || 1;
      const current = Math.round(typical * score);
      return {
        ...d,
        typical_duration_mins: typical,
        current_duration_mins: current,
        congestion_score: d.congestion_score,
      };
    });

    rows.sort((a, b) => (b.congestion_score || 0) - (a.congestion_score || 0));

    // Sort ascending by score (lower congestion = better = first)
    rows.sort((a, b) => (a.congestion_score || 999) - (b.congestion_score || 999));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
