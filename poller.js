require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const pool = require('./db');

const ORIGIN = 'New Delhi, India';
const DESTINATIONS = [
  // Himachal Pradesh
  'Shimla', 'Manali', 'Dalhousie', 'McLeod Ganj', 'Chail', 'Kasol',
  'Dharamshala', 'Kasauli', 'Kufri', 'Narkanda', 'Chamba', 'Solan',
  'Khajjiar', 'Spiti Valley', 'Pragpur', 'Pin Valley',
  // Uttarakhand
  'Mussoorie', 'Nainital', 'Rishikesh', 'Almora', 'Chakrata', 'Lansdowne',
  'Ranikhet', 'Mukteshwar', 'Haridwar', 'Naukuchiatal', 'Pangot', 'Ramgarh',
  'Munsiyari', 'Lohaghat', 'Auli', 'Chopta', 'New Tehri', 'Pauri', 'Sankri',
  // Jammu & Kashmir
  'Gulmarg', 'Srinagar', 'Pahalgam', 'Sonamarg', 'Patnitop', 'Yusmarg', 'Dachigam',
];

const BATCH_SIZE = 20; // stay under Google's 25-dest limit

function getBaselineTimestamp() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilTuesday = (2 - day + 7) % 7 || 7;
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() + daysUntilTuesday);
  tuesday.setHours(6, 0, 0, 0);
  return Math.floor(tuesday.getTime() / 1000);
}

async function fetchBatch(batch, nowTs, baselineTs, apiKey) {
  const destinationsStr = batch.join('|');
  const [currentRes, typicalRes] = await Promise.all([
    axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: { origins: ORIGIN, destinations: destinationsStr, departure_time: nowTs, traffic_model: 'best_guess', key: apiKey },
    }),
    axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: { origins: ORIGIN, destinations: destinationsStr, departure_time: baselineTs, traffic_model: 'optimistic', key: apiKey },
    }),
  ]);
  return { currentElements: currentRes.data.rows[0].elements, typicalElements: typicalRes.data.rows[0].elements };
}

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

  for (let i = 0; i < DESTINATIONS.length; i += BATCH_SIZE) {
    const batch = DESTINATIONS.slice(i, i + BATCH_SIZE);
    try {
      const { currentElements, typicalElements } = await fetchBatch(batch, nowTs, baselineTs, apiKey);
      for (let j = 0; j < batch.length; j++) {
        const dest = batch[j];
        const curr = currentElements[j];
        const typ = typicalElements[j];
        if (curr.status !== 'OK' || typ.status !== 'OK') {
          console.warn(`[Poller] Bad status for ${dest}: curr=${curr.status} typ=${typ.status}`);
          continue;
        }
        const currentMins = curr.duration_in_traffic ? curr.duration_in_traffic.value / 60 : curr.duration.value / 60;
        const typicalMins = typ.duration.value / 60;
        const congestionScore = parseFloat((currentMins / typicalMins).toFixed(3));
        await pool.query(
          `INSERT INTO travel_logs (destination, timestamp, current_duration_mins, typical_duration_mins, congestion_score)
           VALUES ($1, $2, $3, $4, $5)`,
          [dest, timestamp, Math.round(currentMins), Math.round(typicalMins), congestionScore]
        );
        updated++;
      }
    } catch (err) {
      console.error(`[Poller] Batch error (${batch[0]}…): ${err.message}`);
    }
  }
  console.log(`[Poller] Updated ${updated}/${DESTINATIONS.length} destinations at ${timestamp}`);
}

function startPoller() {
  cron.schedule('0 */4 * * *', fetchTravelData);
  console.log('[Poller] Scheduler started — runs every 4 hours');
  fetchTravelData();
}

module.exports = { startPoller, fetchTravelData };
