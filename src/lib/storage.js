const KEY = 'tp:last';

export function saveState({ form, itinerary }) {
  try {
    const data = { form, itinerary, ts: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearState() {
  try { localStorage.removeItem(KEY); } catch {}
}
