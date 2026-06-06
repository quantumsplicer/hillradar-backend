const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getTypicalTime } = require('../cityTimes');

// GET /api/best-now?origin=Chandigarh
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
      WHERE l.congestion_score IS NOT NULL
      ORDER BY l.congestion_score ASC
      LIMIT 3
    `);

    const rows = result.rows.map(d => {
      const typical = getTypicalTime(origin, d.name);
      const score = d.congestion_score || 1;
      return {
        ...d,
        typical_duration_mins: typical,
        current_duration_mins: Math.round(typical * score),
      };
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
