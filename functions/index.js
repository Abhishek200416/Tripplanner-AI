import express from 'express';
import functions from 'firebase-functions';

const app = express();
app.use(express.json());

app.post('/api/book', (req, res) => {
  const { itineraryId, amountINR } = req.body || {};
  const pnr = 'EMT-DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  return res.json({ status: 'CONFIRMED', pnr, amountINR: amountINR || 0 });
});

export const api = functions.https.onRequest(app);
