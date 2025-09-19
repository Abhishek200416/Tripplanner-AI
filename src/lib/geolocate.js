// src/lib/geolocate.js
// Advanced geo utilities with robust fallbacks (no paid maps needed).
import { callGeminiLowLevel } from './geminiClient.js';

/* ──────────────────────────────────────────────────────────────────────────
   📦 Tiny in-memory + localStorage cache (with TTL)
   ────────────────────────────────────────────────────────────────────────── */
const mem = new Map();
const LS_KEY = 'tp_geo_cache_v1';

function loadLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveLS(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {}
}
const ls = loadLS();

function cacheGet(key) {
  const now = Date.now();
  if (mem.has(key)) {
    const v = mem.get(key);
    if (!v.exp || v.exp > now) return v.val;
    mem.delete(key);
  }
  const v = ls[key];
  if (v && (!v.exp || v.exp > now)) { mem.set(key, v); return v.val; }
  return null;
}
function cacheSet(key, val, ttlMs = 5 * 60 * 1000) { // default 5 min
  const obj = { val, exp: ttlMs ? Date.now() + ttlMs : 0 };
  mem.set(key, obj);
  ls[key] = obj;
  saveLS(ls);
}

/* ──────────────────────────────────────────────────────────────────────────
   🧭 Geometry helpers
   ────────────────────────────────────────────────────────────────────────── */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * (Math.sin(dLng / 2) ** 2);
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

export function bearingDeg(a, b) {
  const φ1 = a.lat * Math.PI/180, φ2 = b.lat * Math.PI/180;
  const Δλ = (b.lng - a.lng) * Math.PI/180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.cos(φ2) * Math.cos(Δλ) - Math.sin(φ1)*Math.sin(φ2);
  return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
}

export function prettyDistance(km) {
  if (!Number.isFinite(km)) return '–';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/* ──────────────────────────────────────────────────────────────────────────
   🌐 Fetch with timeout + retries + polite rate limiting (for Nominatim)
   ────────────────────────────────────────────────────────────────────────── */
const lastCall = new Map(); // host -> ts
async function politeWait(url) {
  try {
    const host = new URL(url).host;
    const minGap = /nominatim/i.test(host) ? 1100 : 0; // be nice: ~1.1s between calls
    const last = lastCall.get(host) || 0;
    const gap = Date.now() - last;
    if (gap < minGap) await new Promise(r => setTimeout(r, minGap - gap));
    lastCall.set(host, Date.now());
  } catch {}
}

async function fetchWithRetry(url, { method='GET', headers={}, timeout=8000, retries=2 } = {}) {
  await politeWait(url);
  let err = null;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { method, headers, signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return res;
      // 429/5xx are retryable
      if (![429, 500, 502, 503, 504].includes(res.status)) {
        err = new Error(`HTTP_${res.status}`);
        break;
      }
      err = new Error(`HTTP_${res.status}`);
    } catch (e) {
      err = e;
    } finally {
      clearTimeout(t);
    }
    await new Promise(r => setTimeout(r, 300 * (i + 1) + Math.random() * 250)); // backoff
  }
  throw err || new Error('fetch_failed');
}

/* ──────────────────────────────────────────────────────────────────────────
   🇮🇳 Heuristic: nearest known Indian city fallback
   (tiny list → keeps bundle small; extend as needed)
   ────────────────────────────────────────────────────────────────────────── */
const INDIA_CITIES = [
  { n:'Delhi', lat:28.6139, lng:77.2090 },
  { n:'Mumbai', lat:19.0760, lng:72.8777 },
  { n:'Bengaluru', lat:12.9716, lng:77.5946 },
  { n:'Hyderabad', lat:17.3850, lng:78.4867 },
  { n:'Chennai', lat:13.0827, lng:80.2707 },
  { n:'Kolkata', lat:22.5726, lng:88.3639 },
  { n:'Pune', lat:18.5204, lng:73.8567 },
  { n:'Jaipur', lat:26.9124, lng:75.7873 },
  { n:'Ahmedabad', lat:23.0225, lng:72.5714 },
  { n:'Goa', lat:15.2993, lng:74.1240 },
  { n:'Varanasi', lat:25.3176, lng:82.9739 },
  { n:'Amritsar', lat:31.6340, lng:74.8723 },
  { n:'Srinagar', lat:34.0837, lng:74.7973 }
];

function nearestIndianCity({ lat, lng }) {
  let best = null, bestD = Infinity;
  for (const c of INDIA_CITIES) {
    const d = haversineKm({ lat, lng }, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best ? `${best.n} (≈ ${prettyDistance(bestD)})` : null;
}

/* ──────────────────────────────────────────────────────────────────────────
   📍 Browser geolocation (single shot) + watcher
   ────────────────────────────────────────────────────────────────────────── */
export function getGeo(opts = { enableHighAccuracy:true, timeout:8000, maximumAge:10000 }) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve(null),
      opts
    );
  });
}

export function watchGeo(cb, opts = { enableHighAccuracy:false, maximumAge:15000, timeout:20000 }) {
  if (!navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    pos => cb?.({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => cb?.(null),
    opts
  );
  return () => { try { navigator.geolocation.clearWatch(id); } catch {} };
}

/* ──────────────────────────────────────────────────────────────────────────
   🔁 Reverse geocoding (coords → label)
   Order: Cache → Nominatim → Gemini → nearest city
   ────────────────────────────────────────────────────────────────────────── */
function normalizeLabel(s = '') {
  const t = String(s).replace(/\s+/g, ' ').trim();
  // Trim super long results but keep meaningful tail
  return t.length > 120 ? t.slice(0, 117) + '…' : t;
}

async function reverseViaNominatim({ lat, lng }) {
  const key = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lng),
    zoom: '14',
    addressdetails: '0'
  }).toString();

  try {
    const res = await fetchWithRetry(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TripPlanner/1.0 (educational; contact: example@example.com)'
      },
      timeout: 9000,
      retries: 2
    });
    const j = await res.json();
    const label = normalizeLabel(j?.display_name || '');
    if (label) {
      cacheSet(key, label, 10 * 60 * 1000); // 10 min
      return label;
    }
  } catch {}
  return null;
}

async function reverseViaGemini({ lat, lng }) {
  try {
    const prompt = `You are a geocoder for India.\nCoordinates: ${lat}, ${lng}\nReturn a short human-readable place label (city/area, state if helpful). Return PLAIN TEXT only.`;
    const text = await callGeminiLowLevel(prompt);
    const label = normalizeLabel(String(text || '').split('\n')[0]);
    return label || null;
  } catch { return null; }
}

/** Reverse-geocode coordinates → short place label (best effort). */
export async function coordsToPlace({ lat, lng }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // 1) cache / Nominatim
  const nomi = await reverseViaNominatim({ lat, lng });
  if (nomi) return nomi;

  // 2) Gemini hint (when enabled)
  const gen = await reverseViaGemini({ lat, lng });
  if (gen) return gen;

  // 3) nearest city heuristic
  return nearestIndianCity({ lat, lng });
}

/* ──────────────────────────────────────────────────────────────────────────
   🔎 Forward geocoding (place → lat/lng)
   Order: Cache → Gemini → nearest Indian city guess
   ────────────────────────────────────────────────────────────────────────── */
function parseLatLngLoose(s = '') {
  // Accept "lat,lng" or "lat lng" variants
  const m = String(s).match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

export async function geocodeViaGemini(place) {
  const key = `fwd:${place.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const prompt = [
    `Give latitude and longitude for "${place}" in India.`,
    `Return JSON only: {"lat": <number>, "lng": <number>, "confidence": 0..1}`,
    `If uncertain, still return best guess with lower confidence.`
  ].join('\n');

  try {
    const text = await callGeminiLowLevel(prompt);
    let lat = null, lng = null, conf = 0.6;

    // Prefer JSON if present
    const jsonRaw = text.match(/\{[\s\S]*\}/)?.[0];
    if (jsonRaw) {
      const j = JSON.parse(jsonRaw);
      if (typeof j.lat === 'number' && typeof j.lng === 'number') {
        lat = j.lat; lng = j.lng; conf = Math.max(0, Math.min(1, j.confidence ?? 0.6));
      }
    }
    // Fallback to a loose "lat,lng" parse
    if (lat === null || lng === null) {
      const m = parseLatLngLoose(text);
      if (m) { lat = m.lat; lng = m.lng; conf = Math.min(conf, 0.5); }
    }

    if (lat !== null && lng !== null) {
      const out = { lat, lng, conf };
      cacheSet(key, out, 60 * 60 * 1000); // 1 hour
      return out;
    }
  } catch {}

  // Last resort: snap to known city if it matches exactly
  const hit = INDIA_CITIES.find(c => c.n.toLowerCase() === String(place).trim().toLowerCase());
  if (hit) return { lat: hit.lat, lng: hit.lng, conf: 0.5 };

  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
   🔗 Handy link helpers (no SDK/billing required)
   ────────────────────────────────────────────────────────────────────────── */
export function gmapsSearchURL(q) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(q || ''))}`;
}
export function gmapsCoordsURL({ lat, lng }) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
export function gmapsRouteURL({ origin, destination, waypoints = [], mode = 'driving' }) {
  const base = 'https://www.google.com/maps/dir/?api=1';
  const wp = waypoints.filter(Boolean).map(w => encodeURIComponent(w)).join('|');
  const parts = [
    `origin=${encodeURIComponent(origin || '')}`,
    `destination=${encodeURIComponent(destination || '')}`,
    wp ? `waypoints=${wp}` : null,
    `travelmode=${encodeURIComponent(mode)}`
  ].filter(Boolean);
  return `${base}&${parts.join('&')}`;
}
