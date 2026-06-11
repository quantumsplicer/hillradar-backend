const express = require('express');
const router = express.Router();
const { normalizeOrigin, getLiveDataForOrigin } = require('../liveTimesCore');

function mapRow(r) {
  return {
    id: r.id,
    name: r.destination,
    lat: r.lat,
    lng: r.lng,
    description: r.description,
    image_url: r.image_url,
    congestion_score: r.congestion_score,
    typical_duration_mins: Math.round(r.typical_mins),
    current_duration_mins: Math.round(r.current_mins),
    seasonal_multiplier: r.seasonal_multiplier,
    last_updated: r.updated_at,
  };
}

// GET /api/destinations?origin=Chandigarh
// Legacy/fallback endpoint — now backed by the same real per-origin live
// cache as /api/live-times (no more synthesized "typical x congestion" math),
// just returned as a flat array for older callers.
router.get('/', async (req, res) => {
  const origin = normalizeOrigin(req.query.origin);
  if (!origin) return res.json([]);

  try {
    const { rows } = await getLiveDataForOrigin(origin);
    const destinations = rows
      .map(mapRow)
      .sort((a, b) => a.congestion_score - b.congestion_score);
    res.json(destinations);
  } catch (err) {
    console.error('[Destinations]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
