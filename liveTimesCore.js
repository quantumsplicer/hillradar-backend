const pool = require('./db');
const { fetchForOrigin } = require('./poller');

const CACHE_MINUTES = 10;

// Per-origin in-flight fetch lock — shared across routes so concurrent
// requests for the same city reuse one Google Maps call instead of racing.
const inFlight = new Map(); // origin -> Promise

const ORIGIN_NAME_OVERRIDES = { 'new delhi': 'Delhi' };
function normalizeOrigin(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  return ORIGIN_NAME_OVERRIDES[trimmed.toLowerCase()] || trimmed;
}

function refresh(origin) {
  if (inFlight.has(origin)) return inFlight.get(origin);
  const p = fetchForOrigin(origin)
    .catch(e => console.error(`[LiveTimes] refresh error for "${origin}":`, e.message))
    .finally(() => inFlight.delete(origin));
  inFlight.set(origin, p);
  return p;
}

async function loadCache(origin) {
  const { rows } = await pool.query(`
    SELECT c.destination, c.current_mins, c.typical_mins, c.congestion_score, c.updated_at,
           d.id, d.lat, d.lng, d.description, d.image_url
    FROM origin_travel_cache c
    JOIN destinations d ON d.name = c.destination
    WHERE c.origin = $1 AND d.no_route IS NOT TRUE
      AND c.current_mins IS NOT NULL AND c.typical_mins IS NOT NULL
  `, [origin]);
  return rows;
}

// Returns live (real, per-origin) travel data for a city, refreshing from
// Google Maps when missing or stale (>10 min). Cold starts await the first
// fetch so the caller gets real numbers immediately; stale data is served
// right away while a background refresh runs.
async function getLiveDataForOrigin(origin) {
  let rows = await loadCache(origin);

  if (rows.length === 0) {
    await refresh(origin);
    rows = await loadCache(origin);
  } else {
    const lastUpdate = Math.max(...rows.map(r => new Date(r.updated_at).getTime()));
    if ((Date.now() - lastUpdate) / 60000 >= CACHE_MINUTES) refresh(origin);
  }

  const lastUpdate = rows.length ? Math.max(...rows.map(r => new Date(r.updated_at).getTime())) : 0;
  return {
    rows,
    lastUpdate: lastUpdate || null,
    ageMinutes: lastUpdate ? Math.round((Date.now() - lastUpdate) / 60000) : null,
    refreshing: inFlight.has(origin),
  };
}

module.exports = { normalizeOrigin, getLiveDataForOrigin, CACHE_MINUTES };
