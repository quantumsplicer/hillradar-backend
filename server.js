require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./schema');
const { startPoller } = require('./poller');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/destinations', require('./routes/destinations'));
app.use('/api/destination', require('./routes/trend'));
app.use('/api/best-now', require('./routes/bestNow'));
app.use('/api/best-time', require('./routes/bestTime'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;

async function main() {
  await initSchema();
  startPoller();
  app.listen(PORT, () => {
    console.log(`HillRadar backend running on http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log('  GET /api/destinations');
    console.log('  GET /api/destination/:id/trend');
    console.log('  GET /api/best-now');
    console.log('  GET /api/best-time/:id');
  });
}

main().catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
