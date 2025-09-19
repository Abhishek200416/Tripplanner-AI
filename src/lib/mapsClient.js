// src/lib/mapsClient.js
const MAPS_KEY = (() => {
  try { return import.meta.env.VITE_MAPS_API_KEY || ''; } catch { return ''; }
})();

/**
 * Inject the Google Maps JS with loading=async (best practice).
 * Returns true when window.google.maps is available.
 */
export async function ensureMapsScript() {
  if (!MAPS_KEY) return false;
  if (typeof window === 'undefined') return false;
  if (window.google && window.google.maps) return true;

  return new Promise((resolve) => {
    const id = 'gmaps-sdk';
    const existing = document.getElementById(id);
    if (existing) {
      // Script tag already present; wait briefly for maps object.
      const check = () => resolve(!!(window.google && window.google.maps));
      setTimeout(check, 50);
      return;
    }

    const s = document.createElement('script');
    s.id = id;
    // Note: add loading=async so the API self-optimizes; no callback needed here.
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&libraries=places&loading=async`;
    s.async = true;
    s.onerror = () => resolve(false);
    s.onload  = () => resolve(!!(window.google && window.google.maps));
    document.head.appendChild(s);
  });
}

/**
 * Ensure specific libraries are available (maps, places, etc.)
 * Uses the new promise-based importLibrary API.
 * Safe to call multiple times.
 */
export async function loadMapsLibraries(list = []) {
  if (!MAPS_KEY) return false;
  if (!(window.google && window.google.maps && window.google.maps.importLibrary)) return false;

  try {
    // The 'maps' library is required before most others.
    if (list.includes('maps')) {
      await window.google.maps.importLibrary('maps');
    }
    // Load 'places' if requested.
    if (list.includes('places')) {
      await window.google.maps.importLibrary('places');
    }
    // Extend with more libraries if you add them later.
    return true;
  } catch {
    return false;
  }
}

/** Places Text Search for every POI in the itinerary (best effort). */
export async function searchPlacesForItinerary({ itinerary }) {
  if (!itinerary) return [];
  if (!MAPS_KEY) return [];

  // Make sure libraries exist (important with loading=async)
  if (!(window.google && window.google.maps && window.google.maps.importLibrary)) return [];
  await loadMapsLibraries(['maps', 'places']);

  if (!(window.google && window.google.maps && window.google.maps.places)) return [];

  const city = itinerary.city || '';
  const allSlots = (itinerary.days || []).flatMap(d => d.slots || []);
  const names = allSlots.map(s => s.poiQuery).filter(Boolean);
  if (!names.length) return [];

  const service = new window.google.maps.places.PlacesService(document.createElement('div'));

  const searchOne = (q) => {
    const query = [q, city, 'India'].filter(Boolean).join(' ');
    return new Promise((resolve) => {
      service.textSearch({ query }, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
          const r = results[0];
          const loc = r.geometry && r.geometry.location
            ? { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() }
            : null;
          resolve(loc ? [{ name: r.name || q, location: loc, placeId: r.place_id || null }] : []);
        } else {
          resolve([]);
        }
      });
    });
  };

  const out = [];
  for (let i = 0; i < names.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const r = await searchOne(names[i]);
    out.push(...r);
  }
  return out;
}

/** Draw a directions overlay for Day 1 only (visual). */
export async function drawFirstDayRoute({ itinerary, map }) {
  if (!itinerary || !map) return;
  if (!MAPS_KEY) return;

  if (!(window.google && window.google.maps && window.google.maps.importLibrary)) return;
  await loadMapsLibraries(['maps']); // DirectionsService is in 'maps'

  const day0 = itinerary.days?.[0] || { slots: [] };
  const names = (day0.slots || []).map(s => s.poiQuery).filter(Boolean);
  if (!names.length) return;

  const city = itinerary.city || '';
  const origin = [names[0], city, 'India'].filter(Boolean).join(' ');
  const destination = [names[names.length - 1], city, 'India'].filter(Boolean).join(' ');
  const waypoints = names.slice(1, -1).map(n => ({ location: [n, city, 'India'].filter(Boolean).join(' '), stopover: true }));

  const directionsService = new window.google.maps.DirectionsService();
  const directionsRenderer = new window.google.maps.DirectionsRenderer({ suppressMarkers: false, map });

  const req = { origin, destination, travelMode: window.google.maps.TravelMode.DRIVING };
  if (waypoints.length) req.waypoints = waypoints;

  return new Promise((resolve) => {
    directionsService.route(req, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK && result) {
        directionsRenderer.setDirections(result);
      }
      resolve();
    });
  });
}

/** Sum travel time & distance across all day segments. */
export async function computeTotalTravel({ itinerary }) {
  if (!itinerary) return null;
  if (!MAPS_KEY) return null;

  if (!(window.google && window.google.maps && window.google.maps.importLibrary)) return null;
  await loadMapsLibraries(['maps']); // Directions API

  const days = itinerary.days || [];
  if (!days.length) return null;
  const city = itinerary.city || '';

  const directionsService = new window.google.maps.DirectionsService();

  const pairReq = (a, b) => ({
    origin: [a, city, 'India'].filter(Boolean).join(' '),
    destination: [b, city, 'India'].filter(Boolean).join(' '),
    travelMode: window.google.maps.TravelMode.DRIVING
  });

  let totalMinutes = 0;
  let totalMeters = 0;

  const call = (req) => new Promise((resolve) => {
    directionsService.route(req, (res, status) => {
      if (status === window.google.maps.DirectionsStatus.OK && res && res.routes && res.routes[0]) {
        const legs = res.routes[0].legs || [];
        for (const leg of legs) {
          totalMinutes += (leg.duration && leg.duration.value ? leg.duration.value : 0) / 60;
          totalMeters  += (leg.distance && leg.distance.value ? leg.distance.value : 0);
        }
      }
      resolve();
    });
  });

  for (const d of days) {
    const slots = (d.slots || []).map(s => s.poiQuery).filter(Boolean);
    for (let i = 0; i < slots.length - 1; i++) {
      // eslint-disable-next-line no-await-in-loop
      await call(pairReq(slots[i], slots[i + 1]));
    }
  }
  return { totalMinutes, totalKm: totalMeters / 1000 };
}
