// src/lib/transport.js
import { haversineKm, geocodeViaGemini } from './geo.js';
import { callGeminiLowLevel } from './geminiClient.js';

const SPEED_KMPH = { flight:650, train:55, bus:45, car:50, bike:38 };
const FARE = {
  flight:{ pk:7.5, min:2500 }, // per km per person
  train: { pk:0.9, min:120  },
  bus:   { pk:1.6, min:250  },
  car:   { pk:12,  min:1600 }, // per car (group split)
  bike:  { pk:5,   min:400  }, // per bike (2 pax/bike)
};

export async function estimateIntercity({
  origin, originCoords, destination, travellers=1, mode='train', roundTrip=true
}) {
  const o = originCoords || (await geocodeViaGemini(origin));
  const d = await geocodeViaGemini(destination);
  if (!o || !d) return { ok:false, reason:'Could not geocode' };

  const km = Math.max(1, Math.round(haversineKm(o,d)));
  const hours = +(km / (SPEED_KMPH[mode] || 50)).toFixed(1);

  let perPerson=0, total=0, notes='';
  if (mode==='car'){
    const base = Math.max(FARE.car.min, FARE.car.pk*km);
    total = roundTrip ? base*2 : base;
    perPerson = Math.ceil(total/Math.max(1,travellers));
    notes = 'Self-drive/with driver + fuel, split across group.';
  } else if (mode==='bike'){
    const bikes = Math.ceil(travellers/2);
    const base = Math.max(FARE.bike.min, FARE.bike.pk*km);
    total = (roundTrip ? base*2 : base) * bikes;
    perPerson = Math.ceil(total/Math.max(1,travellers));
    notes = `~${bikes} bike(s). Helmets mandatory.`;
  } else {
    const base = Math.max(FARE[mode].min, FARE[mode].pk*km);
    perPerson = Math.ceil(roundTrip ? base*2 : base);
    total = perPerson * Math.max(1,travellers);
    notes = 'Indicative; book early for better fares.';
  }
  return { ok:true, km, hours, mode, roundTrip, perPerson, total, notes };
}

export async function compareModes({
  origin, originCoords, destination, travellers=1, roundTrip=true, modes=['flight','train','bus','car','bike']
}) {
  const items = [];
  for (const m of modes) {
    const r = await estimateIntercity({ origin, originCoords, destination, travellers, mode:m, roundTrip });
    if (r.ok) items.push(r);
  }
  items.sort((a,b)=>a.total-b.total);
  return { items, best: items[0] || null };
}

export async function aiSuggestTransport({ origin, destination, startDate, endDate, travellers=1, modeHint=null }) {
  const prompt = [
    `Suggest 2–5 realistic intercity transport options ${origin} → ${destination} (India).`,
    `Depart ${startDate || 'flexible'}; return ${endDate || 'flexible'}. Travellers: ${travellers}.`,
    `Prefer "${modeHint||'any'}" if sensible.`,
    `JSON only: {"options":[{"mode":"flight|train|bus|car|bike","name":"operator or 'Self-drive'","depart":"~HH:MM","durationHours":<num>,"oneWayFareRangeINR":[min,max],"notes":"<short>"}]}`
  ].join('\n');
  try {
    const text = await callGeminiLowLevel(prompt);
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return Array.isArray(json.options) ? json.options.slice(0,5) : [];
  } catch { return []; }
}
