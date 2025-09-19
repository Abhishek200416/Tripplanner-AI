// src/lib/mapsLinks.js
function enc(s) { return encodeURIComponent(String(s || '').trim()); }

export function gmapsPlaceSearch(place, city) {
  const q = [place, city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
}

export function gmapsSearch(q) {
  return `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
}

export function gmapsDirections({ origin, destination, waypoints = [], mode = 'driving' }) {
  const base = 'https://www.google.com/maps/dir/?api=1';
  const wp = waypoints.filter(Boolean).map(enc).join('|');
  const parts = [
    `origin=${enc(origin || '')}`,
    `destination=${enc(destination || '')}`,
    wp ? `waypoints=${wp}` : null,
    `travelmode=${enc(mode)}`
  ].filter(Boolean);
  return `${base}&${parts.join('&')}`;
}
