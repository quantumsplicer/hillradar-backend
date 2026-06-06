require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const pool = require('./db');

const ORIGIN = 'New Delhi, India';
const DESTINATIONS = [
  'Shimla', 'Manali', 'Mussoorie', 'Nainital', 'Kasol', 'Chakrata',
  'Lansdowne', 'Dalhousie', 'McLeod Ganj', 'Rishikesh', 'Almora', 'Chail'
];

// Next Tuesday at 6am (for baseline)
function getBaselineTimestamp() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilTuesday = (2 - day + 7) % 7 || 7;
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() + daysUntilTuesday);
  tuesday.setHours(6, 0, 0, 0);
  return Math.floor(tuesday.getTime() / 1000);
}

async function fetchTravelData() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_ME') {
    console.log('[Poller] No valid API key — skipping live poll');
    return;
  }

  const destinationsStr = DESTINATIONS.join('|');
  const nowTs = Math.floor(Date.now() / 1000);
  const baselineTs = getBaselineTimestamp();

  try {
    const [currentRes, typicalRes] = await Promise.all([
      axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: ORIGIN,
          destinations: destinationsStr,
          departure_time: nowTs,
          traffic_model: 'best_guess',
          key: apiKey,
        },
      }),
      axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: ORIGIN,
          destinations: destinationsStr,
          departure_time: baselineTs,
          traffic_model: 'optimistic',
          key: apiKey,
        },
      }),
    ]);

    const currentElements = currentRes.data.rows[0].elements;
    const typicalElements = typicalRes.data.rows[0].elements;
    const timestamp = new Date().toISOString();

    for (let i = 0; i < DESTINATIONS.length; i++) {
      const dest = DESTINATIONS[i];
      const curr = currentElements[i];
      const typ = typicalElements[i];

      if (curr.status !== 'OK' || typ.status !== 'OK') {
        console.warn(`[Poller] Bad status for ${dest}: curr=${curr.status} typ=${typ.status}`);
        continue;
      }

      const currentMins = curr.duration_in_traffic
        ? curr.duration_in_traffic.value / 60
        : curr.duration.value / 60;
      const typicalMins = typ.duration.value / 60;
      const congestionScore = parseFloat((currentMins / typicalMins).toFixed(3));

      await pool.query(
        `INSERT INTO travel_logs (destination, timestamp, current_duration_mins, typical_duration_mins, congestion_score)
         VALUES ($1, $2, $3, $4, $5)`,
        [dest, timestamp, Math.round(currentMins), Math.round(typicalMins), congestionScore]
      );
    }
    console.log(`[Poller] Updated ${DESTINATIONS.length} destinations at ${timestamp}`);
  } catch (err) {
    console.error('[Poller] Error fetching travel data:', err.message);
  }
}

function startPoller() {
  // Run every 4 hours
  cron.schedule('0 */4 * * *', fetchTravelData);
  console.log('[Poller] Scheduler started — runs every 4 hours');
  // Also run once on startup
  fetchTravelData();
}

module.exports = { startPoller, fetchTravelData };
