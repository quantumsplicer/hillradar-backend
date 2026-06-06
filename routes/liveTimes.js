const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getTypicalTime } = require('../cityTimes');
const { fetchCurrentOnly } = require('../poller');

const CACHE_MINUTES = 10;
let refreshing = false; // simple lock to prevent parallel refreshes

// GET /api/live-times?origin=Delhi
router.get('/', async (req, res) => {
  const origin = req.query.origin || null;

  try {
    // Get all valid destinations with latest congestion score
    const { rows: dests } = await pool.query(`
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

    // Check cache age (based on the most recent travel_log entry)
    const latestTs = dests
      .filter(d => d.last_updated)
      .map(d => new Date(d.last_updated).getTime());
    const lastUpdate = latestTs.length ? Math.max(...latestTs) : 0;
    const ageMinutes = lastUpdate ? (Date.now() - lastUpdate) / 60000 : 999;

    // Refresh if stale and not already refreshing
    if (ageMinutes >= CACHE_MINUTES && !refreshing) {
      refreshing = true;
      fetchCurrentOnly()
        .catch(e => console.error('[LiveTimes] refresh error:', e.message))
        .finally(() => { refreshing = false; });
      // Don't await — respond with current (slightly stale) data immediately
    }

    // Build response — filter destinations with no usable data
    const rows = dests
      .map(d => {
        const typical = getTypicalTime(origin, d.name);
        // No route data and no cityTimes entry → skip
        if (!typical && !d.typical_mins) return null;
        // No congestion score → can't show times
        if (!d.congestion_score) return null;

        const effectiveTypical = typical || d.typical_mins;
        const current = Math.round(effectiveTypical * d.congestion_score);

        return {
          id: d.id,
          name: d.name,
          lat: d.lat,
          lng: d.lng,
          description: d.description,
          image_url: d.image_url,
          congestion_score: d.congestion_score,
          typical_duration_mins: effectiveTypical,
          current_duration_mins: current,
          last_updated: d.last_updated,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.congestion_score - b.congestion_score);

    res.json({
      destinations: rows,
      last_updated: lastUpdate ? new Date(lastUpdate).toISOString() : null,
      cache_age_minutes: Math.round(ageMinutes),
      refreshing,
    });
  } catch (err) {
    console.error('[LiveTimes]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
