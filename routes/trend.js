const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/destination/:id/trend — last 15 days of data
router.get('/:id/trend', async (req, res) => {
  try {
    const { id } = req.params;

    const destResult = await pool.query('SELECT name FROM destinations WHERE id = $1', [id]);
    if (destResult.rows.length === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    const name = destResult.rows[0].name;

    const result = await pool.query(`
      SELECT
        DATE_TRUNC('day', timestamp) AS day,
        AVG(congestion_score) AS avg_score,
        MIN(congestion_score) AS min_score,
        MAX(congestion_score) AS max_score,
        AVG(current_duration_mins) AS avg_current_mins,
        AVG(typical_duration_mins) AS avg_typical_mins
      FROM travel_logs
      WHERE destination = $1
        AND timestamp >= NOW() - INTERVAL '15 days'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY day ASC
    `, [name]);

    res.json({ destination: name, trend: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
