// src/components/MapViewLite.js
import React from 'react';
import '../styles/MapLite.css';
import { gmapsDirections, gmapsPlaceSearch } from '../lib/mapsLinks.js';

export function MapViewLite({ itinerary }) {
  if (!itinerary) {
    return React.createElement('div', { className: 'maplite cardish' },
      React.createElement('div', { className: 'maplite-head' }, 'Map & POIs'),
      React.createElement('div', { className: 'maplite-note muted' }, 'No itinerary yet.')
    );
  }

  const city = itinerary.city || 'Destination';
  const day0 = itinerary.days?.[0] || { slots: [] };
  const slotNames = (day0.slots || []).map(s => s.poiQuery).filter(Boolean);

  const origin      = slotNames[0] ? `${slotNames[0]} ${city}` : city;
  const destination = slotNames.length > 1 ? `${slotNames[slotNames.length - 1]} ${city}` : city;
  const waypoints   = slotNames.slice(1, -1).map(n => `${n} ${city}`);

  const routeUrl = gmapsDirections({ origin, destination, waypoints, mode: 'driving' });

  return React.createElement('div', { className: 'maplite cardish' },
    React.createElement('div', { className: 'maplite-head' }, 'Open Day 1 in Google Maps'),

    React.createElement('div', { className: 'maplite-actions' },
      React.createElement('a', {
        href: routeUrl, target: '_blank', rel: 'noreferrer', className: 'btn fill'
      }, 'Open Route')
    ),

    React.createElement('div', { className: 'maplite-grid' },
      ...(itinerary.days || []).flatMap((d, idx) => ([
        React.createElement('div', { key:`dhead-${idx}`, className:'ml-day' }, d.date || `Day ${idx+1}`),
        ...d.slots.map((s, j) => {
          const name = s.poiQuery || '(unspecified)';
          const url  = gmapsPlaceSearch(name, city);
          return React.createElement('a', {
            key:`poi-${idx}-${j}`, className:'ml-poi btn ghost', href:url, target:'_blank', rel:'noreferrer'
          }, name);
        })
      ]))
    ),

    React.createElement('div', { className: 'maplite-foot hint' },
      'No live map — using direct Google Maps links (no billing needed).'
    )
  );
}

export default MapViewLite;
