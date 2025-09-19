// src/lib/planStore.js
// Simple in-memory store with subscribe/emit + stable IDs + remove helpers

let state = {
  hotels: [],             // [{ _id, name, city, pricePerNightINR, nights, travellers, roomsPerNight, notes }]
  pois:   [],             // [{ _id, name, city, dayIndex|null, time, costPerPersonINR, notes }]
  meta:   { days: 0, travellers: 1, hotelTier: 'mid', city: '' }
};

const subs = new Set();
const clone = (o) => JSON.parse(JSON.stringify(o)); // safe snapshot for external use
const mkid  = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function emit() {
  const snap = getMods(); // take one snapshot & reuse for all subscribers
  for (const fn of subs) {
    try { fn(snap); } catch {}
  }
}

/* ---------------- Subscriptions ---------------- */
export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  subs.add(fn);
  try { fn(getMods()); } catch {}
  return () => subs.delete(fn);
}

export function getMods() {
  return {
    hotels: clone(state.hotels),
    pois:   clone(state.pois),
    meta:   clone(state.meta)
  };
}

export function clearMods() {
  state.hotels = [];
  state.pois   = [];
  emit();
}

/* ---------------- Add / Remove ---------------- */
export function addHotel(h) {
  const rec = { _id: mkid(), ...h };
  state.hotels.push(rec);
  emit();
  return rec._id;
}

export function addPoi(p) {
  const rec = { _id: mkid(), ...p };
  state.pois.push(rec);
  emit();
  return rec._id;
}

export function removeHotel(id) {
  const i = state.hotels.findIndex(h => h._id === id);
  if (i >= 0) {
    state.hotels.splice(i, 1);
    emit();
    return true;
  }
  return false;
}

export function removePoi(id) {
  const i = state.pois.findIndex(p => p._id === id);
  if (i >= 0) {
    state.pois.splice(i, 1);
    emit();
    return true;
  }
  return false;
}

/* Convenience: latest records (for UI chips, etc.) */
export function getLatestHotel() { return clone(state.hotels[state.hotels.length - 1] || null); }
export function getLatestPoi()   { return clone(state.pois[state.pois.length - 1] || null); }

/* ---------------- Meta setters ---------------- */
export function setDays(n) {
  const v = Math.max(1, (n|0) || 1);
  if (state.meta.days !== v) { state.meta.days = v; emit(); }
}
export function setCity(c) {
  const v = String(c || '');
  if (state.meta.city !== v) { state.meta.city = v; emit(); }
}
export function setTravellers(t) {
  const v = Math.max(1, (t|0) || 1);
  if (state.meta.travellers !== v) { state.meta.travellers = v; emit(); }
}
export function setHotelTier(t) {
  const v = t || 'mid';
  if (state.meta.hotelTier !== v) { state.meta.hotelTier = v; emit(); }
}

/* ---------------- Convenience getters ---------------- */
export function getDaysCount()  { return Math.max(1, state.meta.days || 1); }
export function getCity()       { return state.meta.city || ''; }
export function getTravellers() { return Math.max(1, state.meta.travellers || 1); }
export function getTier()       { return state.meta.hotelTier || 'mid'; }

/* ---------------- Event bridge (optional) ----------------
 * Add simple global events so non-importing code can interact:
 *  - tp:add-hotel (detail: string | hotelObject)
 *  - tp:add-poi   (detail: string | poiObject)
 *  - tp:remove-hotel (detail: { _id })
 *  - tp:remove-poi   (detail: { _id })
 *  - tp:days / tp:city / tp:headcount / tp:hotel-tier (detail: value)
 */
if (typeof window !== 'undefined') {
  window.addEventListener('tp:add-hotel', (e) => {
    const d = e?.detail;
    if (!d) return;
    addHotel(typeof d === 'string' ? { name: d, city: state.meta.city } : d);
  });
  window.addEventListener('tp:add-poi', (e) => {
    const d = e?.detail;
    if (!d) return;
    addPoi(typeof d === 'string' ? { name: d, city: state.meta.city } : d);
  });
  window.addEventListener('tp:remove-hotel', (e) => {
    const id = e?.detail?._id || e?.detail;
    if (id) removeHotel(id);
  });
  window.addEventListener('tp:remove-poi', (e) => {
    const id = e?.detail?._id || e?.detail;
    if (id) removePoi(id);
  });

  window.addEventListener('tp:days',       (e) => setDays(e?.detail));
  window.addEventListener('tp:city',       (e) => setCity(e?.detail));
  window.addEventListener('tp:headcount',  (e) => setTravellers(e?.detail));
  window.addEventListener('tp:hotel-tier', (e) => setHotelTier(e?.detail));
}
