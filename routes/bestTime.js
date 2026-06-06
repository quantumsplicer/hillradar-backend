const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/best-time/:id — best day + time to leave in next 3 days
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const destResult = await pool.query('SELECT name FROM destinations WHERE id = $1', [id]);
    if (destResult.rows.length === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    const name = destResult.rows[0].name;

    // Get historical avg congestion by day-of-week and hour-bucket
    const result = await pool.query(`
      SELECT
        EXTRACT(DOW FROM timestamp) AS dow,
        FLOOR(EXTRACT(HOUR FROM timestamp) / 4) * 4 AS hour_bucket,
        AVG(congestion_score) AS avg_score,
        COUNT(*) AS sample_count
      FROM travel_logs
      WHERE destination = $1
        AND timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY dow, hour_bucket
      ORDER BY avg_score ASC
      LIMIT 5
    `, [name]);

    const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const slots = result.rows.map(row => {
      const d = DOW_NAMES[parseInt(row.dow)];
      const h = parseInt(row.hour_bucket);
      const label = `${d} at ${h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}`;
      return {
        day: d,
        hour: h,
        time_slot: label,
        avg_score: parseFloat(parseFloat(row.avg_score).toFixed(3)),
        sample_count: parseInt(row.sample_count),
      };
    });

    const best = slots[0] || null;

    res.json({
      destination: name,
      best_slot: best,
      all_slots: slots,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
