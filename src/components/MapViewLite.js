// src/components/MapViewLite.js
import React from 'react';
import '../styles/MapLite.css';
import { gmapsDirections, gmapsPlaceSearch } from '../lib/mapsLinks.js';

function buildDayRouteUrl(day, city) {
  const slots = Array.isArray(day?.slots) ? day.slots : [];
  const names = slots.map(s => s?.poiQuery).filter(Boolean);

  // If fewer than 2 points, just open the city (or single POI) rather than a route.
  if (names.length < 2) {
    const q = (names[0] ? `${names[0]} ${city}` : city);
    // Use a directions URL with same origin/destination to keep a consistent UX.
    return gmapsDirections({ origin: q, destination: q, waypoints: [], mode: 'driving' });
  }

  const origin      = `${names[0]} ${city}`;
  const destination = `${names[names.length - 1]} ${city}`;
  const waypoints   = names.slice(1, -1).map(n => `${n} ${city}`);
  return gmapsDirections({ origin, destination, waypoints, mode: 'driving' });
}

export function MapViewLite({ itinerary }) {
  if (!itinerary || !Array.isArray(itinerary.days) || itinerary.days.length === 0) {
    return React.createElement('div', { className: 'maplite cardish2' },
      React.createElement('div', { className: 'maplite-head' }, 'Map & POIs'),
      React.createElement('div', { className: 'maplite-note muted' }, 'No itinerary yet.')
    );
  }

  const city = itinerary.city || 'Destination';
  const days = itinerary.days;

  // Build a section per day with its own "Open Route" button and POIs list.
  const daySections = days.map((d, idx) => {
    const label = d?.date || `Day ${idx + 1}`;
    const routeUrl = buildDayRouteUrl(d, city);
    const poiLinks = (Array.isArray(d?.slots) ? d.slots : []).map((s, j) => {
      const name = s?.poiQuery || '(unspecified)';
      const url  = gmapsPlaceSearch(name, city);
      return React.createElement('a', {
        key: `poi-${idx}-${j}`,
        className: 'ml-poi btn ghost',
        href: url,
        target: '_blank',
        rel: 'noreferrer'
      }, name);
    });

    return React.createElement('div', { key: `day-block-${idx}`, className: 'maplite-day cardish2' }, [
      React.createElement('div', { key: 'head', className: 'maplite-day-head' }, [
        React.createElement('div', { key: 'title', className: 'ml-day' }, label),
        React.createElement('div', { key: 'actions', className: 'maplite-actions' },
          React.createElement('a', { className: 'btn fill', href: routeUrl, target: '_blank', rel: 'noreferrer' }, 'Open Route')
        )
      ]),
      React.createElement('div', { key: 'grid', className: 'maplite-grid' }, poiLinks)
    ]);
  });

  return React.createElement('div', { className: 'maplite cardish2' },
    React.createElement('div', { className: 'maplite-head' }, 'Map & POIs'),
    ...daySections,
    React.createElement('div', { className: 'maplite-foot hint' },
      'No live map — using direct Google Maps links (no billing needed).'
    )
  );
}

export default MapViewLite;
