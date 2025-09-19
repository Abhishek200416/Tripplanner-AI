// src/components/HotelsPanel.js
import React from 'react';
import '../styles/HotelsPanel.css';
import { aiSuggestHotels, getCityPricing } from '../lib/geminiClient.js';
import { gmapsPlaceSearch } from '../lib/mapsLinks.js';
import { addHotel } from '../lib/planStore.js';

// NOTE: images removed → no placeImages import

export function HotelsPanel({
  city,
  tier = 'mid',
  compact = false,
  limit = 8,
  onAdd,
  nights = 1,
  travellers = 2
}) {
  const [hotels, setHotels] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    (async () => {
      setErr(''); setHotels([]);
      if (!city) return;
      setLoading(true);
      try {
        const list = await aiSuggestHotels({ city, tier, limit });
        setHotels(Array.isArray(list) ? list : []);
      } catch (e) {
        setErr(e?.message || 'Failed to fetch hotel suggestions.');
      } finally { setLoading(false); }
    })();
  }, [city, tier, limit]);

  if (!city) return null;

  const tierLabel = tier === 'budget' ? 'Budget' : tier === 'luxe' ? 'Luxury' : 'Mid-range';
  const klass = 'hotels ' + (compact ? 'compact card-subtle' : 'card');

  function add(name) {
    const P = getCityPricing(city, tier);
    const rooms = Math.max(1, Math.ceil(travellers / 2)); // assume 2 per room
    addHotel({
      name, city,
      pricePerNightINR: P.hotelPerNightINR,
      nights, travellers,
      roomsPerNight: rooms,
      notes: `${tierLabel} estimate for ${city}`
    });
    if (typeof onAdd === 'function') onAdd(name);
  }

  return React.createElement('div', { className: klass, role: 'region', 'aria-label': 'Hotel suggestions' },
    React.createElement('div', { className: 'hotels-head' },
      React.createElement('div', { className: 'title' }, compact ? 'Step 6 · Hotels' : 'Hotels'),
      React.createElement('div', { className: 'sub' }, `${tierLabel} · ${city}`)
    ),

    loading ? React.createElement('div', { className:'skeleton-grid', role:'status', 'aria-label':'Loading hotels' },
      ...Array.from({ length: compact ? 4 : 6 }).map((_, i) =>
        React.createElement('div', { key:`sk-${i}`, className:'skeleton' })
      )
    ) : null,

    err ? React.createElement('div', { className:'field-error' }, err) : null,

    (!loading && !err && hotels.length === 0)
      ? React.createElement('div', { className:'empty-hint' }, 'No quick picks. Try a different tier or city.')
      : null,

    React.createElement('div', { className:'hotels-grid' },
      ...(hotels.map((name, i) =>
        React.createElement('div', { key:`h-${i}-${name}`, className:'hotel-card' },
          // ⤵️ image removed — we show a compact text block instead
          React.createElement('div', { className:'hotel-row' },
            React.createElement('div', { className:'hotel-name' }, name),
            React.createElement('span', { className:'badge' }, tierLabel)
          ),
          React.createElement('div', { className:'hotel-meta' },
            `Near ${city} · Est. ₹${getCityPricing(city, tier).hotelPerNightINR}/night`
          ),
          React.createElement('div', { className:'hotel-actions' },
            React.createElement('button', { className:'btn fill', onClick: () => add(name) }, 'Add to itinerary'),
            React.createElement('a', { className:'btn link', target:'_blank', rel:'noreferrer', href: gmapsPlaceSearch(name, city) }, 'Open in Maps')
          )
        )
      ))
    )
  );
}

export default HotelsPanel;
