require('dotenv').config();
const pool = require('./db');

const DESTINATIONS = [
  { name: 'Shimla', lat: 31.1048, lng: 77.1734, description: 'The Queen of Hills — colonial charm, pine forests, and the famous Mall Road at 2200m.', image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' },
  { name: 'Manali', lat: 32.2432, lng: 77.1892, description: 'Adventure capital of the Himalayas — snow peaks, river rapids, and gateway to Rohtang Pass.', image_url: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800' },
  { name: 'Mussoorie', lat: 30.4598, lng: 78.0664, description: 'Queen of the Hills near Dehradun — Kempty Falls, Camel Back Road, and panoramic Himalayan views.', image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800' },
  { name: 'Nainital', lat: 29.3919, lng: 79.4542, description: 'The Lake District of India — emerald Naini Lake surrounded by forested hills at 2084m.', image_url: 'https://images.unsplash.com/photo-1609766857769-00a8cf1e4f97?w=800' },
  { name: 'Kasol', lat: 32.0098, lng: 77.3148, description: 'Mini Israel of India — backpacker paradise in Parvati Valley with stunning river gorges.', image_url: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800' },
  { name: 'Chakrata', lat: 30.6955, lng: 77.8638, description: 'Hidden gem near Dehradun — Tiger Falls, dense deodar forests, and virtually no crowds.', image_url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800' },
  { name: 'Lansdowne', lat: 29.8384, lng: 78.6856, description: 'Serene cantonment town in Uttarakhand — oak forests, colonial churches, and Garhwali culture.', image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800' },
  { name: 'Dalhousie', lat: 32.5387, lng: 75.9734, description: 'Scottish-style hill station in Himachal — Victorian architecture, Khajjiar meadows, and Ravi River views.', image_url: 'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=800' },
  { name: 'McLeod Ganj', lat: 32.2427, lng: 76.3234, description: 'Little Lhasa — home of the Dalai Lama, Tibetan culture, monasteries, and trekking trails.', image_url: 'https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?w=800' },
  { name: 'Rishikesh', lat: 30.0869, lng: 78.2676, description: 'Yoga capital of the world — Ganges ghats, suspension bridges, white-water rafting, and ashrams.', image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800' },
  { name: 'Almora', lat: 29.5975, lng: 79.6551, description: 'Cultural heart of Kumaon — ancient temples, Crank\'s Ridge sunrise views, and famous copper crafts.', image_url: 'https://images.unsplash.com/photo-1571863533956-01a000537df0?w=800' },
  { name: 'Chail', lat: 30.9671, lng: 77.2049, description: 'Maharaja\'s retreat — world\'s highest cricket ground, Chail Palace, and dense Himalayan forests.', image_url: 'https://images.unsplash.com/photo-1605538883019-e4b28e14a4e7?w=800' },
];

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

    console.log('Schema ready');

    // Seed destinations (upsert — safe to run every startup)
    for (const d of DESTINATIONS) {
      await client.query(
        `INSERT INTO destinations (name, lat, lng, description, image_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET lat=$2, lng=$3, description=$4, image_url=$5`,
        [d.name, d.lat, d.lng, d.description, d.image_url]
      );
    }
    console.log('Destinations ready');

    // Only seed mock travel_logs if the table is empty (avoids re-seeding on Render restarts)
    const { rows: countRows } = await client.query('SELECT COUNT(*) AS c FROM travel_logs');
    if (parseInt(countRows[0].c) > 0) {
      console.log('travel_logs already seeded — skipping');
    } else {
      const now = new Date();
      let insertCount = 0;

      for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
        for (let poll = 0; poll < 6; poll++) {
          const ts = new Date(now);
          ts.setDate(ts.getDate() - daysAgo);
          ts.setHours(poll * 4, 0, 0, 0);

          const dayOfWeek = ts.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
          const isMorningWeekday = !isWeekend && poll === 1;

          for (const dest of DESTINATIONS) {
            let baseScore;
            if (isWeekend) {
              baseScore = 1.3 + Math.random() * 0.5;
            } else if (isMorningWeekday) {
              baseScore = 1.0 + Math.random() * 0.15;
            } else {
              baseScore = 1.1 + Math.random() * 0.3;
            }

            const destVariation = (dest.name.length % 5) * 0.02;
            baseScore += destVariation * (Math.random() - 0.5);
            baseScore = Math.max(1.0, Math.min(2.0, baseScore));

            const typicalTimes = {
              'Shimla': 350, 'Manali': 540, 'Mussoorie': 290, 'Nainital': 310,
              'Kasol': 500, 'Chakrata': 320, 'Lansdowne': 270, 'Dalhousie': 590,
              'McLeod Ganj': 570, 'Rishikesh': 250, 'Almora': 350, 'Chail': 330
            };
            const typical = typicalTimes[dest.name] || 360;
            const current = Math.round(typical * baseScore);

            await client.query(
              `INSERT INTO travel_logs (destination, timestamp, current_duration_mins, typical_duration_mins, congestion_score)
               VALUES ($1, $2, $3, $4, $5)`,
              [dest.name, ts.toISOString(), current, typical, parseFloat(baseScore.toFixed(3))]
            );
            insertCount++;
          }
        }
      }
      console.log(`Seeded ${insertCount} mock travel log records`);
    }
  } finally {
    client.release();
  }
}

module.exports = { initSchema, DESTINATIONS };
