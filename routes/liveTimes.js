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

// GET /api/live-times?origin=Jaipur
// Returns LIVE travel times fetched directly from Google Maps for the user's
// actual origin city (cached 10 min per origin) — not a synthesized estimate.
router.get('/', async (req, res) => {
  const origin = normalizeOrigin(req.query.origin);
  if (!origin) {
    // No city selected yet — nothing to show, and no point spending API quota
    return res.json({ destinations: [], last_updated: null, cache_age_minutes: null, refreshing: false });
  }

  try {
    const { rows, lastUpdate, ageMinutes, refreshing } = await getLiveDataForOrigin(origin);

    const destinations = rows
      .map(mapRow)
      .sort((a, b) => a.congestion_score - b.congestion_score);

    res.json({
      destinations,
      last_updated: lastUpdate ? new Date(lastUpdate).toISOString() : null,
      cache_age_minutes: ageMinutes,
      refreshing,
    });
  } catch (err) {
    console.error('[LiveTimes]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
