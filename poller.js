require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const pool = require('./db');

const ORIGIN = 'New Delhi, India';
const DESTINATIONS = [
  'Shimla', 'Manali', 'Dalhousie', 'McLeod Ganj', 'Chail', 'Kasol',
  'Dharamshala', 'Kasauli', 'Kufri', 'Narkanda', 'Chamba', 'Solan',
  'Khajjiar', 'Spiti Valley', 'Pragpur', 'Pin Valley',
  'Mussoorie', 'Nainital', 'Rishikesh', 'Almora', 'Chakrata', 'Lansdowne',
  'Ranikhet', 'Mukteshwar', 'Haridwar', 'Naukuchiatal', 'Pangot', 'Ramgarh',
  'Munsiyari', 'Lohaghat', 'Auli', 'Chopta', 'New Tehri', 'Pauri', 'Sankri',
  'Gulmarg', 'Srinagar', 'Pahalgam', 'Sonamarg', 'Patnitop', 'Yusmarg', 'Dachigam',
];

const BATCH_SIZE = 20;

// Seasonal multiplier: how much busier a destination has been recently (last
// 15 days) vs its longer-term baseline (last 90 days), based on the Delhi-
// anchored travel_logs history. Applied on top of each origin's "pessimistic"
// estimate so a destination in high season reads higher for every origin,
// without needing per-origin historical data. Clamped to [1, MAX] so it only
// ever raises the estimate above the pessimistic baseline, never below it.
const SEASONAL_MIN_BASELINE_SAMPLES = 30;
const SEASONAL_MAX_MULTIPLIER = 2.0;

function getBaselineTimestamp() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilTuesday = (2 - day + 7) % 7 || 7;
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() + daysUntilTuesday);
  tuesday.setHours(6, 0, 0, 0);
  return Math.floor(tuesday.getTime() / 1000);
}

async function apiBatch(originStr, destBatch, nowTs, baselineTs, apiKey, fetchTypical, currentTrafficModel = 'best_guess') {
  const destStr = destBatch.join('|');
  const calls = [
    axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: { origins: originStr, destinations: destStr, departure_time: nowTs, traffic_model: currentTrafficModel, key: apiKey },
    }),
  ];
  if (fetchTypical) {
    calls.push(axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: { origins: originStr, destinations: destStr, departure_time: baselineTs, traffic_model: 'optimistic', key: apiKey },
    }));
  }
  const [currentRes, typicalRes] = await Promise.all(calls);
  return {
    currentElements: currentRes.data.rows[0].elements,
    typicalElements: fetchTypical ? typicalRes.data.rows[0].elements : null,
  };
}

// Map a display city name to a Google-Maps-friendly query string.
// Most Indian city names resolve fine with just ", India" appended;
// a couple of well-known aliases get an explicit override.
const ORIGIN_QUERY_OVERRIDES = {
  Delhi: 'New Delhi, Delhi, India',
  Gurgaon: 'Gurugram, Haryana, India',
};
function originQueryString(origin) {
  return ORIGIN_QUERY_OVERRIDES[origin] || `${origin}, India`;
}

// Full poll: fetches current + typical, updates destinations.typical_mins
async function fetchTravelData() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_ME') {
    console.log('[Poller] No valid API key — skipping live poll');
    return;
  }

  const nowTs = Math.floor(Date.now() / 1000);
  const baselineTs = getBaselineTimestamp();
  const timestamp = new Date().toISOString();
  let updated = 0;

  // Check which destinations already have stored typical_mins
  const { rows: storedTypical } = await pool.query(
    'SELECT name, typical_mins FROM destinations WHERE typical_mins IS NOT NULL'
  );
  const alreadyHaveTypical = new Set(storedTypical.map(r => r.name));

  for (let i = 0; i < DESTINATIONS.length; i += BATCH_SIZE) {
    const batch = DESTINATIONS.slice(i, i + BATCH_SIZE);
    const needTypical = batch.some(d => !alreadyHaveTypical.has(d));
    try {
      const { currentElements, typicalElements } = await apiBatch(ORIGIN, batch, nowTs, baselineTs, apiKey, needTypical);
      for (let j = 0; j < batch.length; j++) {
        const dest = batch[j];
        const curr = currentElements[j];
        if (curr.status !== 'OK') {
          // Mark as no_route so the API can filter it out
          await pool.query('UPDATE destinations SET no_route = TRUE WHERE name = $1', [dest]);
          console.warn(`[Poller] No route for ${dest}: ${curr.status}`);
          continue;
        }
        // Clear no_route flag if it was previously set
        await pool.query('UPDATE destinations SET no_route = FALSE WHERE name = $1 AND no_route = TRUE', [dest]);

        const currentMins = curr.duration_in_traffic
          ? curr.duration_in_traffic.value / 60
          : curr.duration.value / 60;

        let typicalMins;
        if (needTypical && typicalElements) {
          const typ = typicalElements[j];
          if (typ.status === 'OK') {
            typicalMins = typ.duration.value / 60;
            // Save typical to destinations table (once)
            if (!alreadyHaveTypical.has(dest)) {
              await pool.query(
                'UPDATE destinations SET typical_mins = $1 WHERE name = $2',
                [Math.round(typicalMins), dest]
              );
              alreadyHaveTypical.add(dest);
            }
          }
        } else {
          // Use stored typical
          const stored = storedTypical.find(r => r.name === dest);
          typicalMins = stored?.typical_mins;
        }

        if (!typicalMins) continue;

        const congestionScore = parseFloat((currentMins / typicalMins).toFixed(3));
        await pool.query(
          `INSERT INTO travel_logs (destination, timestamp, current_duration_mins, typical_duration_mins, congestion_score)
           VALUES ($1, $2, $3, $4, $5)`,
          [dest, timestamp, Math.round(currentMins), Math.round(typicalMins), congestionScore]
        );
        updated++;
      }
    } catch (err) {
      console.error(`[Poller] Batch error: ${err.message}`);
    }
  }
  console.log(`[Poller] Updated ${updated}/${DESTINATIONS.length} at ${timestamp}`);
}

// Computes a per-destination seasonal multiplier from the Delhi-anchored
// travel_logs history: (avg congestion, last 15 days) / (avg congestion,
// last 90 days), clamped to [1, SEASONAL_MAX_MULTIPLIER]. Falls back to 1
// (no adjustment) until enough baseline history has accumulated.
async function getSeasonalMultipliers() {
  const { rows } = await pool.query(`
    SELECT destination,
      AVG(congestion_score) FILTER (WHERE timestamp >= NOW() - INTERVAL '15 days') AS recent_avg,
      AVG(congestion_score) FILTER (WHERE timestamp >= NOW() - INTERVAL '90 days') AS baseline_avg,
      COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '90 days') AS baseline_count
    FROM travel_logs
    GROUP BY destination
  `);
  const multipliers = {};
  for (const r of rows) {
    let m = 1;
    if (r.recent_avg != null && r.baseline_avg > 0 && parseInt(r.baseline_count, 10) >= SEASONAL_MIN_BASELINE_SAMPLES) {
      m = Math.max(1, Math.min(r.recent_avg / r.baseline_avg, SEASONAL_MAX_MULTIPLIER));
    }
    multipliers[r.destination] = parseFloat(m.toFixed(3));
  }
  return multipliers;
}

// Live poll for a SPECIFIC user-selected origin city. Fetches the REAL
// Google Maps current time (and, the first time, the real typical baseline)
// for that exact origin -> destination route, so the displayed "Right Now"
// matches what the user sees in Google Maps from their own city — instead of
// being synthesized from a Delhi-route congestion ratio.
async function fetchForOrigin(origin) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_ME') return { ok: false };

  const originStr = originQueryString(origin);
  const nowTs = Math.floor(Date.now() / 1000);
  const baselineTs = getBaselineTimestamp();
  const timestamp = new Date().toISOString();
  let updated = 0;

  const { rows: destRows } = await pool.query(
    'SELECT name FROM destinations WHERE no_route IS NOT TRUE'
  );
  const { rows: cachedRows } = await pool.query(
    'SELECT destination, typical_mins FROM origin_travel_cache WHERE origin = $1 AND typical_mins IS NOT NULL',
    [origin]
  );
  const typicalMap = Object.fromEntries(cachedRows.map(r => [r.destination, r.typical_mins]));
  const destNames = destRows.map(r => r.name);
  const seasonalMultipliers = await getSeasonalMultipliers();

  for (let i = 0; i < destNames.length; i += BATCH_SIZE) {
    const batch = destNames.slice(i, i + BATCH_SIZE);
    const needTypical = batch.some(d => typicalMap[d] == null);
    try {
      // "Now" uses the pessimistic traffic model — Google's safe-upper-bound
      // prediction for this exact origin -> destination route, so it errs
      // toward not understating travel time.
      const { currentElements, typicalElements } = await apiBatch(originStr, batch, nowTs, baselineTs, apiKey, needTypical, 'pessimistic');
      for (let j = 0; j < batch.length; j++) {
        const dest = batch[j];
        const curr = currentElements[j];
        if (curr.status !== 'OK') continue; // route status for this origin is unreliable; skip rather than mis-flag

        const rawCurrentMins = curr.duration_in_traffic ? curr.duration_in_traffic.value / 60 : curr.duration.value / 60;

        let typicalMins = typicalMap[dest];
        if (typicalMins == null && typicalElements) {
          const typ = typicalElements[j];
          if (typ.status === 'OK') {
            typicalMins = Math.round(typ.duration.value / 60);
            typicalMap[dest] = typicalMins;
          }
        }
        if (typicalMins == null) continue;

        // Scale the pessimistic estimate up further if this destination has
        // been running hotter than its 90-day baseline lately (e.g. summer
        // tourist season) — never scales it down.
        const seasonalMultiplier = seasonalMultipliers[dest] ?? 1;
        const currentMins = rawCurrentMins * seasonalMultiplier;

        const congestionScore = parseFloat((currentMins / typicalMins).toFixed(3));
        await pool.query(
          `INSERT INTO origin_travel_cache (origin, destination, current_mins, typical_mins, congestion_score, seasonal_multiplier, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (origin, destination) DO UPDATE SET
             current_mins = EXCLUDED.current_mins,
             typical_mins = COALESCE(origin_travel_cache.typical_mins, EXCLUDED.typical_mins),
             congestion_score = EXCLUDED.current_mins / COALESCE(origin_travel_cache.typical_mins, EXCLUDED.typical_mins),
             seasonal_multiplier = EXCLUDED.seasonal_multiplier,
             updated_at = EXCLUDED.updated_at`,
          [origin, dest, Math.round(currentMins), typicalMins, congestionScore, seasonalMultiplier, timestamp]
        );
        updated++;
      }
    } catch (err) {
      console.error(`[Poller:origin=${origin}] Batch error: ${err.message}`);
    }
  }
  console.log(`[Poller:origin=${origin}] Updated ${updated} destinations at ${timestamp}`);
  return { ok: true, updated, timestamp };
}

function startPoller() {
  cron.schedule('0 */4 * * *', fetchTravelData);
  console.log('[Poller] Scheduler started — runs every 4 hours');
  fetchTravelData();
}

module.exports = { startPoller, fetchTravelData, fetchForOrigin, getSeasonalMultipliers };
