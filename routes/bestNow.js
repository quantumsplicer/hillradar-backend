const express = require('express');
const router = express.Router();
const { normalizeOrigin, getLiveDataForOrigin } = require('../liveTimesCore');

// GET /api/best-now?origin=Chandigarh
// Top 3 calmest destinations right now, with REAL live times for the
// requested origin (backed by the same per-origin cache as /api/live-times).
router.get('/', async (req, res) => {
  const origin = normalizeOrigin(req.query.origin);
  if (!origin) return res.json([]);

  try {
    const { rows } = await getLiveDataForOrigin(origin);

    const top3 = rows
      .slice()
      .sort((a, b) => a.congestion_score - b.congestion_score)
      .slice(0, 3)
      .map(r => ({
        id: r.id,
        name: r.destination,
        lat: r.lat,
        lng: r.lng,
        description: r.description,
        image_url: r.image_url,
        congestion_score: r.congestion_score,
        typical_duration_mins: Math.round(r.typical_mins),
        current_duration_mins: Math.round(r.current_mins),
        last_updated: r.updated_at,
      }));

    res.json(top3);
  } catch (err) {
    console.error('[BestNow]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
