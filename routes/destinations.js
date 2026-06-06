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
        d.typical_mins, d.no_route,
        l.congestion_score, l.timestamp AS last_updated
      FROM destinations d
      LEFT JOIN LATERAL (
        SELECT congestion_score, timestamp
        FROM travel_logs tl
        WHERE tl.destination = d.name
        ORDER BY tl.timestamp DESC
        LIMIT 1
      ) l ON true
      WHERE d.no_route IS NOT TRUE
    `);

    const rows = result.rows
      .map(d => {
        const typical = getTypicalTime(origin, d.name);
        if (!typical && !d.typical_mins) return null; // unknown destination
        if (!d.congestion_score) return null;           // no route data at all

        const effectiveTypical = typical || d.typical_mins;
        const current = Math.round(effectiveTypical * d.congestion_score);

        return {
          id: d.id, name: d.name, lat: d.lat, lng: d.lng,
          description: d.description, image_url: d.image_url,
          congestion_score: d.congestion_score,
          typical_duration_mins: effectiveTypical,
          current_duration_mins: current,
          last_updated: d.last_updated,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.congestion_score - b.congestion_score);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
