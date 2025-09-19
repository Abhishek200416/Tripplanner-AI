// src/components/MapView.js
import React from 'react';
import '../styles/MapView.css';
import { MapViewLite } from './MapViewLite.js';
import {
  ensureMapsScript,
  loadMapsLibraries,
  searchPlacesForItinerary,
  drawFirstDayRoute,
  computeTotalTravel
} from '../lib/mapsClient.js';

// Utility: does an API key exist?
function hasMapsKey() {
  try { return !!import.meta.env.VITE_MAPS_API_KEY; } catch { return false; }
}

/* ---------------- Live (paid) map – used only when a key exists ---------------- */
function MapViewLive({ itinerary, onTravelComputed }) {
  const mapRef = React.useRef(null);
  const mapInstance = React.useRef(null);
  const [mapReady, setMapReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const ok = await ensureMapsScript();
      if (!ok) { setMapReady(false); return; }
      const libsOk = await loadMapsLibraries(['maps', 'places']);
      if (!libsOk) { setMapReady(false); return; }

      if (!mapInstance.current && mapRef.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: 20.5937, lng: 78.9629 }, // India fallback
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });
      }
      setMapReady(!!mapInstance.current);
    })();
  }, []);

  React.useEffect(() => {
    if (!mapReady || !itinerary || !mapInstance.current) return;
    (async () => {
      try {
        const found = await searchPlacesForItinerary({ itinerary });
        if (found.length) {
          const bounds = new window.google.maps.LatLngBounds();
          found.forEach(p => {
            new window.google.maps.Marker({
              position: p.location,
              map: mapInstance.current,
              title: p.name
            });
            bounds.extend(p.location);
          });
          mapInstance.current.fitBounds(bounds);
        }
      } catch {}

      try { await drawFirstDayRoute({ itinerary, map: mapInstance.current }); } catch {}

      try {
        const t = await computeTotalTravel({ itinerary });
        onTravelComputed && onTravelComputed(t);
      } catch { onTravelComputed && onTravelComputed(null); }
    })();
  }, [mapReady, itinerary]);

  return React.createElement(
    'div',
    { className: 'map-live-wrap' },
    React.createElement(
      'div',
      { className: 'map-live-canvas', ref: mapRef },
      !hasMapsKey() && 'Add VITE_MAPS_API_KEY to enable the live map.'
    )
  );
}

/* ---------------- Search bar (LIVE TAB ONLY) ---------------- */
function LiveSearchBar() {
  const [q, setQ] = React.useState('');
  const open = () => {
    if (!q.trim()) return;
    const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q.trim());
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  function demoAlert() {
    alert(
      'This Maps panel is for prototyping.\n\n' +
      'Billing is NOT enabled for the live Google Maps SDK on this build. ' +
      'Use “Maps Lite” to open routes/search in Google Maps directly, or add your own API key to test the live map.'
    );
  }

  return React.createElement(
    'div',
    { className: 'map-search' },
    React.createElement('input', {
      className: 'map-search-input',
      type: 'text',
      placeholder: 'Search places (opens Google Maps in a new tab)…',
      value: q,
      onChange: e => setQ(e.target.value),
      onKeyDown: e => { if (e.key === 'Enter') open(); }
    }),
    React.createElement('button', { className: 'btn', type: 'button', onClick: open }, 'Search'),
    React.createElement('button', { className: 'btn ghost', type: 'button', onClick: demoAlert }, 'Demo')
  );
}

/* ---------------- Composite panel with tabs ---------------- */
export function MapView({ itinerary }) {
  const defaultTab = hasMapsKey() ? 'live' : 'lite';
  const [tab, setTab] = React.useState(defaultTab);
  const [travel, setTravel] = React.useState(null);

  const tabsEl = React.createElement(
    'div',
    { className: 'map-tabs' },
    React.createElement(
      'button',
      {
        className: 'tab' + (tab === 'lite' ? ' active' : ''),
        type: 'button',
        onClick: () => setTab('lite')
      },
      'Maps Lite'
    ),
    React.createElement(
      'button',
      {
        className: 'tab' + (tab === 'live' ? ' active' : ''),
        type: 'button',
        onClick: () => setTab('live'),
        disabled: !hasMapsKey(),
        title: hasMapsKey() ? '' : 'Add a Google Maps API key to enable'
      },
      'Live Map'
    )
  );

  const viewEl = tab === 'live'
    ? React.createElement(MapViewLive, { itinerary, onTravelComputed: (t) => setTravel(t) })
    : React.createElement(MapViewLite, { itinerary });

  const summary = (tab === 'live' && travel)
    ? `Travel (all segments): ~${Math.round(travel.totalMinutes)} min • ~${(travel.totalKm).toFixed(1)} km`
    : (tab === 'lite'
        ? 'Opens routes in Google Maps with the correct order; no API billing needed.'
        : '');

  const protoBanner = (tab === 'live')
    ? 'Prototype: billing is NOT enabled for the live Google Maps SDK here.'
    : 'Prototype: billing is NOT enabled; this uses direct Google Maps links.';

  return React.createElement(
    'div',
    { className: 'map-panel cardish' },

    tabsEl,

    // IMPORTANT: Search bar appears ONLY for the LIVE tab (not in Maps Lite)
    (tab === 'live') ? React.createElement(LiveSearchBar) : null,

    React.createElement('div', { className: 'map-proto-note' }, protoBanner),

    viewEl,

    summary ? React.createElement('div', { className: 'map-summary' }, summary) : null,

    React.createElement(
      'div',
      { className: 'map-help' },
      'If you see “For development purposes only” on the map, it means billing/restrictions are in effect on the key.'
    )
  );
}

export default MapView;
