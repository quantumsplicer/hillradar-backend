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

function getBaselineTimestamp() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilTuesday = (2 - day + 7) % 7 || 7;
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() + daysUntilTuesday);
  tuesday.setHours(6, 0, 0, 0);
  return Math.floor(tuesday.getTime() / 1000);
}

async function apiBatch(destBatch, nowTs, baselineTs, apiKey, fetchTypical) {
  const destStr = destBatch.join('|');
  const calls = [
    axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: { origins: ORIGIN, destinations: destStr, departure_time: nowTs, traffic_model: 'best_guess', key: apiKey },
    }),
  ];
  if (fetchTypical) {
    calls.push(axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: { origins: ORIGIN, destinations: destStr, departure_time: baselineTs, traffic_model: 'optimistic', key: apiKey },
    }));
  }
  const [currentRes, typicalRes] = await Promise.all(calls);
  return {
    currentElements: currentRes.data.rows[0].elements,
    typicalElements: fetchTypical ? typicalRes.data.rows[0].elements : null,
  };
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
      const { currentElements, typicalElements } = await apiBatch(batch, nowTs, baselineTs, apiKey, needTypical);
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

// Light poll: current time only (for live endpoint, uses stored typical_mins)
async function fetchCurrentOnly() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_ME') return { ok: false };

  const nowTs = Math.floor(Date.now() / 1000);
  const timestamp = new Date().toISOString();
  let updated = 0;

  // Get destinations that have typical_mins stored and are not no_route
  const { rows: dests } = await pool.query(
    'SELECT name, typical_mins FROM destinations WHERE typical_mins IS NOT NULL AND no_route IS NOT TRUE'
  );
  if (dests.length === 0) return { ok: false, reason: 'no stored typical_mins yet' };

  const destNames = dests.map(d => d.name);
  const typicalMap = Object.fromEntries(dests.map(d => [d.name, d.typical_mins]));

  for (let i = 0; i < destNames.length; i += BATCH_SIZE) {
    const batch = destNames.slice(i, i + BATCH_SIZE);
    try {
      const res = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: { origins: ORIGIN, destinations: batch.join('|'), departure_time: nowTs, traffic_model: 'best_guess', key: apiKey },
      });
      const elements = res.data.rows[0].elements;
      for (let j = 0; j < batch.length; j++) {
        const dest = batch[j];
        const el = elements[j];
        if (el.status !== 'OK') {
          await pool.query('UPDATE destinations SET no_route = TRUE WHERE name = $1', [dest]);
          continue;
        }
        const currentMins = el.duration_in_traffic ? el.duration_in_traffic.value / 60 : el.duration.value / 60;
        const typicalMins = typicalMap[dest];
        const congestionScore = parseFloat((currentMins / typicalMins).toFixed(3));
        await pool.query(
          `INSERT INTO travel_logs (destination, timestamp, current_duration_mins, typical_duration_mins, congestion_score)
           VALUES ($1, $2, $3, $4, $5)`,
          [dest, timestamp, Math.round(currentMins), typicalMins, congestionScore]
        );
        updated++;
      }
    } catch (err) {
      console.error(`[Poller:light] Batch error: ${err.message}`);
    }
  }
  console.log(`[Poller:light] Updated ${updated} destinations at ${timestamp}`);
  return { ok: true, updated, timestamp };
}

function startPoller() {
  cron.schedule('0 */4 * * *', fetchTravelData);
  console.log('[Poller] Scheduler started — runs every 4 hours');
  fetchTravelData();
}

module.exports = { startPoller, fetchTravelData, fetchCurrentOnly };
