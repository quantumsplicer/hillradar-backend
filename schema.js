require('dotenv').config();
const pool = require('./db');

const DESTINATIONS = [
  // Himachal Pradesh (existing)
  { name: 'Shimla',      lat: 31.1048, lng: 77.1734, description: 'The Queen of Hills — colonial charm, pine forests, and the famous Mall Road at 2200m.', image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' },
  { name: 'Manali',      lat: 32.2432, lng: 77.1892, description: 'Adventure capital of the Himalayas — snow peaks, river rapids, and gateway to Rohtang Pass.', image_url: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800' },
  { name: 'Dalhousie',   lat: 32.5387, lng: 75.9734, description: 'Scottish-style hill station — Victorian architecture, Khajjiar meadows, and Ravi River views.', image_url: 'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=800' },
  { name: 'McLeod Ganj', lat: 32.2427, lng: 76.3234, description: 'Little Lhasa — home of the Dalai Lama, Tibetan culture, monasteries, and trekking trails.', image_url: 'https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?w=800' },
  { name: 'Chail',       lat: 30.9671, lng: 77.2049, description: "Maharaja's retreat — world's highest cricket ground, Chail Palace, and dense Himalayan forests.", image_url: 'https://images.unsplash.com/photo-1605538883019-e4b28e14a4e7?w=800' },
  { name: 'Kasol',       lat: 32.0098, lng: 77.3148, description: 'Mini Israel of India — backpacker paradise in Parvati Valley with stunning river gorges.', image_url: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800' },
  // Himachal Pradesh (new)
  { name: 'Dharamshala', lat: 32.2190, lng: 76.3234, description: 'Home of the Dalai Lama — Tibetan culture, Dhauladhar trekking, and a thriving spiritual scene.', image_url: 'https://images.unsplash.com/photo-1561361058-c24e89de50b6?w=800' },
  { name: 'Kasauli',     lat: 30.8984, lng: 76.9604, description: 'Closest hill retreat from Delhi — colonial-era cantonment with monkey trails, Christ Church, and pine walks.', image_url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800' },
  { name: 'Kufri',       lat: 31.0978, lng: 77.2673, description: 'Near Shimla at 2600m — snow activities, Himalayan Nature Park, and panoramic winter landscapes.', image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800' },
  { name: 'Narkanda',    lat: 31.2725, lng: 77.4500, description: 'Apple country of Himachal — skiing in winter, dense orchards, and Hatu Peak at 3143m.', image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800' },
  { name: 'Chamba',      lat: 32.5529, lng: 76.1236, description: 'Ancient kingdom — Chaugan ground, Lakshmi Narayan temples, and Ravi river gorge views.', image_url: 'https://images.unsplash.com/photo-1571863533956-01a000537df0?w=800' },
  { name: 'Solan',       lat: 30.9047, lng: 77.0966, description: 'Mushroom capital of India — gateway to Shimla, Mohan Shakti temple, and lush forested valleys.', image_url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800' },
  { name: 'Khajjiar',    lat: 32.5400, lng: 76.0400, description: "Mini Switzerland of India — circular meadow ringed by deodar forest and a glacial lake.", image_url: 'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=800' },
  { name: 'Spiti Valley', lat: 32.2461, lng: 78.0137, description: 'High-altitude cold desert — ancient monasteries, stark lunar landscapes, and the road to Kaza at 3800m.', image_url: 'https://images.unsplash.com/photo-1609766857769-00a8cf1e4f97?w=800' },
  { name: 'Pragpur',     lat: 31.9700, lng: 76.4700, description: "India's first heritage village — cobblestone lanes, restored havelis, and rural Himachali tranquility.", image_url: 'https://images.unsplash.com/photo-1625468745461-3f4e1e99d8ae?w=800' },
  { name: 'Pin Valley',  lat: 31.8100, lng: 78.1200, description: 'Remote cold desert sanctuary — Pin Valley National Park and snow leopard habitat near Spiti.', image_url: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800' },
  // Uttarakhand (existing)
  { name: 'Mussoorie',   lat: 30.4598, lng: 78.0664, description: 'Queen of the Hills near Dehradun — Kempty Falls, Camel Back Road, and panoramic Himalayan views.', image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800' },
  { name: 'Nainital',    lat: 29.3919, lng: 79.4542, description: 'The Lake District of India — emerald Naini Lake surrounded by forested hills at 2084m.', image_url: 'https://images.unsplash.com/photo-1609766857769-00a8cf1e4f97?w=800' },
  { name: 'Rishikesh',   lat: 30.0869, lng: 78.2676, description: 'Yoga capital of the world — Ganges ghats, suspension bridges, white-water rafting, and ashrams.', image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800' },
  { name: 'Almora',      lat: 29.5975, lng: 79.6551, description: "Cultural heart of Kumaon — ancient temples, Crank's Ridge sunrise views, and famous copper crafts.", image_url: 'https://images.unsplash.com/photo-1571863533956-01a000537df0?w=800' },
  { name: 'Chakrata',    lat: 30.6955, lng: 77.8638, description: 'Hidden gem near Dehradun — Tiger Falls, dense deodar forests, and virtually no crowds.', image_url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800' },
  { name: 'Lansdowne',   lat: 29.8384, lng: 78.6856, description: 'Serene cantonment town — oak forests, colonial churches, and Garhwali culture with zero commercialism.', image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800' },
  // Uttarakhand (new)
  { name: 'Ranikhet',    lat: 29.6424, lng: 79.4326, description: 'Peaceful military cantonment — apple orchards, Chaubatia gardens, and sweeping Himalayan panoramas.', image_url: 'https://images.unsplash.com/photo-1625468745461-3f4e1e99d8ae?w=800' },
  { name: 'Mukteshwar',  lat: 29.4743, lng: 79.6540, description: '9th-century Shiva temple town — cherry orchards, sunrise over Nanda Devi, and dramatic cliffs.', image_url: 'https://images.unsplash.com/photo-1571863533956-01a000537df0?w=800' },
  { name: 'Haridwar',    lat: 29.9457, lng: 78.1642, description: 'Gateway to the Himalayas — sacred Ganga Aarti at Har Ki Pauri, ashrams, and pilgrimage routes.', image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800' },
  { name: 'Naukuchiatal', lat: 29.3672, lng: 79.5094, description: 'Nine-cornered lake — serene Kumaon alternative to Nainital with boating and birdwatching.', image_url: 'https://images.unsplash.com/photo-1609766857769-00a8cf1e4f97?w=800' },
  { name: 'Pangot',      lat: 29.4800, lng: 79.4200, description: "Birdwatcher's paradise near Nainital — 250+ species, dense oak forests, and minimal tourist crowds.", image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800' },
  { name: 'Ramgarh',     lat: 29.4100, lng: 79.5800, description: "Tagore's retreat — fruit orchards, apricot blossoms in spring, and quiet mountain village walks.", image_url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800' },
  { name: 'Munsiyari',   lat: 30.0678, lng: 80.2373, description: "Tiny Tibet of Uttarakhand — trekking base for Milam glacier and Panchachuli peaks views.", image_url: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800' },
  { name: 'Lohaghat',    lat: 29.4167, lng: 80.0667, description: 'Peaceful temple town on the Lohawati river — Banasur Fort ruins and Advaita Ashram.', image_url: 'https://images.unsplash.com/photo-1571863533956-01a000537df0?w=800' },
  { name: 'Auli',        lat: 30.5241, lng: 79.5700, description: 'Skiing paradise in Garhwal — Asia\'s longest gondola over Himalayan peaks, Joshimath base.', image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800' },
  { name: 'Chopta',      lat: 30.3600, lng: 79.1900, description: "Mini Switzerland of Uttarakhand — base for Tungnath, the world's highest Shiva temple, and Chandrashila peak.", image_url: 'https://images.unsplash.com/photo-1625468745461-3f4e1e99d8ae?w=800' },
  { name: 'New Tehri',   lat: 30.3939, lng: 78.4300, description: 'Lakeside planned town on the Tehri Dam reservoir — water sports, camping, and Himalayan lake views.', image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800' },
  { name: 'Pauri',       lat: 29.8833, lng: 78.7833, description: 'Garhwal district town — Kandoliya temple, sweeping views of 300km of Himalayan peaks.', image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800' },
  { name: 'Sankri',      lat: 31.0800, lng: 78.0300, description: 'Base village for Kedarkantha trek — snow-covered meadows and ridgelines in winter, pristine forest.', image_url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800' },
  // Jammu & Kashmir
  { name: 'Gulmarg',     lat: 34.0484, lng: 74.3805, description: "World-class skiing destination — Asia's highest gondola and summer meadows of wildflowers.", image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' },
  { name: 'Srinagar',    lat: 34.0837, lng: 74.7973, description: 'Dal Lake, shikaras, and floating gardens — Mughal architecture, Hazratbal shrine, and houseboat stays.', image_url: 'https://images.unsplash.com/photo-1609766857769-00a8cf1e4f97?w=800' },
  { name: 'Pahalgam',    lat: 34.0160, lng: 75.3148, description: 'Valley of Shepherds — Betaab Valley, Aru meadows, Chandanwari, and base for Amarnath pilgrimage.', image_url: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800' },
  { name: 'Sonamarg',    lat: 34.2964, lng: 75.2875, description: 'Meadow of Gold — Thajiwas glacier, glacier walks, and gateway to Ladakh via Zoji La pass.', image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' },
  { name: 'Patnitop',    lat: 33.2667, lng: 75.2833, description: 'Accessible hill station near Jammu — pine meadows, adventure sports, and reliable snowfall in winter.', image_url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800' },
  { name: 'Yusmarg',     lat: 33.8167, lng: 74.6167, description: 'Untouched meadow near Srinagar — dense pine forests, pony rides, and zero tourist crowds.', image_url: 'https://images.unsplash.com/photo-1571863533956-01a000537df0?w=800' },
  { name: 'Dachigam',    lat: 34.1500, lng: 74.9500, description: 'Wildlife sanctuary near Srinagar — last natural habitat of the endangered Hangul deer.', image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800' },
];

// Deduplicate by name (Munsiyari appeared twice above — filter)
const seen = new Set();
const DESTINATIONS_CLEAN = DESTINATIONS.filter(d => {
  if (seen.has(d.name)) return false;
  seen.add(d.name);
  return true;
});

const TYPICAL_FROM_DELHI = {
  Shimla: 350, Manali: 540, Mussoorie: 290, Nainital: 310,
  Kasol: 500, Chakrata: 320, Lansdowne: 270, Dalhousie: 590,
  'McLeod Ganj': 570, Rishikesh: 250, Almora: 350, Chail: 330,
  Dharamshala: 510, Kasauli: 310, Kufri: 370, Narkanda: 420,
  Chamba: 600, Solan: 290, Khajjiar: 590, 'Spiti Valley': 780,
  Pragpur: 450, 'Pin Valley': 810,
  Ranikhet: 360, Mukteshwar: 380, Haridwar: 240, Naukuchiatal: 330,
  Pangot: 305, Ramgarh: 340, Munsiyari: 480, Lohaghat: 400,
  Auli: 480, Chopta: 430, 'New Tehri': 305, Pauri: 300, Sankri: 450,
  Gulmarg: 780, Srinagar: 720, Pahalgam: 750, Sonamarg: 780,
  Patnitop: 590, Yusmarg: 750, Dachigam: 740,
};

async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS destinations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        description TEXT,
        image_url TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS travel_logs (
        id SERIAL PRIMARY KEY,
        destination VARCHAR(100) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        current_duration_mins DOUBLE PRECISION,
        typical_duration_mins DOUBLE PRECISION,
        congestion_score DOUBLE PRECISION
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_travel_logs_destination ON travel_logs(destination);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_travel_logs_timestamp ON travel_logs(timestamp DESC);`);

    // Per-origin live cache — stores REAL Google Maps current+typical times for
    // each (user city -> destination) route, so "Right Now" matches what the
    // user sees in Google Maps from their own city (not a synthesized estimate)
    await client.query(`
      CREATE TABLE IF NOT EXISTS origin_travel_cache (
        origin VARCHAR(100) NOT NULL,
        destination VARCHAR(100) NOT NULL,
        current_mins DOUBLE PRECISION,
        typical_mins DOUBLE PRECISION,
        congestion_score DOUBLE PRECISION,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (origin, destination)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_origin_cache_origin ON origin_travel_cache(origin);`);

    // Persist typical (no-traffic) time per destination so live endpoint only needs one Google Maps call
    await client.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS typical_mins DOUBLE PRECISION;`);
    // Track destinations Google Maps confirmed have no drivable route
    await client.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS no_route BOOLEAN DEFAULT FALSE;`);

    console.log('Schema ready');

    // Upsert destinations
    for (const d of DESTINATIONS_CLEAN) {
      await client.query(
        `INSERT INTO destinations (name, lat, lng, description, image_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET lat=$2, lng=$3, description=$4, image_url=$5`,
        [d.name, d.lat, d.lng, d.description, d.image_url]
      );
    }
    console.log(`${DESTINATIONS_CLEAN.length} destinations ready`);

    // Seed mock travel_logs per-destination (only for destinations with no data yet)
    const now = new Date();
    let insertCount = 0;

    for (const dest of DESTINATIONS_CLEAN) {
      const { rows } = await client.query(
        'SELECT COUNT(*) AS c FROM travel_logs WHERE destination = $1',
        [dest.name]
      );
      if (parseInt(rows[0].c) > 0) continue; // already has data

      const typical = TYPICAL_FROM_DELHI[dest.name] || 360;

      for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
        for (let poll = 0; poll < 6; poll++) {
          const ts = new Date(now);
          ts.setDate(ts.getDate() - daysAgo);
          ts.setHours(poll * 4, 0, 0, 0);

          const dayOfWeek = ts.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
          const isMorningWeekday = !isWeekend && poll === 1;

          let baseScore;
          if (isWeekend)         baseScore = 1.3 + Math.random() * 0.5;
          else if (isMorningWeekday) baseScore = 1.0 + Math.random() * 0.15;
          else                   baseScore = 1.1 + Math.random() * 0.3;

          const variation = (dest.name.length % 5) * 0.02;
          baseScore += variation * (Math.random() - 0.5);
          baseScore = Math.max(1.0, Math.min(2.0, parseFloat(baseScore.toFixed(3))));

          await client.query(
            `INSERT INTO travel_logs (destination, timestamp, current_duration_mins, typical_duration_mins, congestion_score)
             VALUES ($1, $2, $3, $4, $5)`,
            [dest.name, ts.toISOString(), Math.round(typical * baseScore), typical, baseScore]
          );
          insertCount++;
        }
      }
    }
    if (insertCount > 0) console.log(`Seeded ${insertCount} mock travel log records`);
    else console.log('All destinations already have travel_logs — skipping seed');
  } finally {
    client.release();
  }
}

module.exports = { initSchema, DESTINATIONS: DESTINATIONS_CLEAN };
