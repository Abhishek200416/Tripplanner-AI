// src/components/Recommendations.js
import React from 'react';
import '../styles/Recommendations.css';
import { aiSuggestSpots, getCityPricing } from '../lib/geminiClient.js';
import { addPoi, getDaysCount } from '../lib/planStore.js';

const BANK = {
  heritage:  ['City Palace','Old Fort','Stepwell','Museum of Art'],
  nightlife: ['Rooftop Bar','Live Music Club','Night Bazaar','Craft Beer Pub'],
  food:      ['Iconic Biryani','Street Food Lane','Traditional Thali','Dessert House'],
  nature:    ['Lakeside Walk','Botanical Garden','Urban Park','Sunrise Point'],
  shopping:  ['Old Market','Handicraft Hub','Fashion Street','Antique Alley'],
  adventure: ['Zipline Park','Rock Trail','Cycling Loop','Kayak Bay'],
  hidden:    ['Secret Courtyard','Indie Café','Mural Lane','Quiet Temple']
};

function mapsLink(place, city){ return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place+', '+city)}`; }
function tagFor(name, selected) {
  for (const k of Object.keys(BANK)) if (BANK[k].some(x => x.toLowerCase()===name.toLowerCase())) return k;
  return selected?.[0] || 'suggested';
}

export function Recommendations({ city, vibes }) {
  if (!city) return null;

  const [ai, setAi] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const selected = (vibes || '').split(',').map(s=>s.trim()).filter(Boolean);

  const fallback = (selected.length ? selected : ['heritage','food'])
    .flatMap(k => BANK[k] || []).slice(0, 8);

  const doAI = async () => {
    if (loading) return;
    setLoading(true); setAi(null);
    try {
      const res = await aiSuggestSpots({ city, themes: selected });
      const uniq = Array.from(new Set((Array.isArray(res)?res:[]).map(s=>String(s).trim()))).slice(0,8);
      setAi(uniq.length ? uniq : null);
    } catch { setAi(null); }
    setLoading(false);
  };

  const items = (ai || fallback).map(name => ({ name, tag: tagFor(name, selected) }));
  const P = getCityPricing(city, 'mid');

  function askDayAndAdd(name){
    const totalDays = getDaysCount();                // from planStore meta
    const input = window.prompt(`Add "${name}" to which day? Enter 1–${totalDays} (leave blank for auto)`, '');
    let dayIndex = null;
    if (input && /^\d+$/.test(input)) {
      const di = parseInt(input, 10) - 1;
      if (di >= 0 && di < totalDays) dayIndex = di;
      else alert(`Day must be between 1 and ${totalDays}. Adding automatically.`);
    }
    addPoi({
      name, city, dayIndex,
      time:'15:00-16:00',
      costPerPersonINR: Math.round(P.poiTicketAvgINR),
      notes: 'Added from suggestions'
    });
  }

  return React.createElement('div', { className:'recs' },
    React.createElement('div', { className:'recs-head' },
      React.createElement('div', { className:'title' }, 'Suggested spots'),
      React.createElement('div', { className:'sub' }, selected.length ? selected.join(' • ') : 'curated default'),
      React.createElement('div', { className:'spacer' }),
      React.createElement('button', { className:'btn ghost', type:'button', onClick: doAI, disabled: loading },
        loading ? 'AI Boosting…' : 'AI Boost'
      )
    ),
    React.createElement('div', { className:'recs-grid' },
      ...(items.map((it, i) =>
        React.createElement('div', { key:`rec-${i}-${it.name}`, className:'rec-card' },
          React.createElement('div', { className:'row-top' },
            React.createElement('div', { className:'rec-name' }, it.name),
            React.createElement('span', { className:'tag-sm' }, it.tag)
          ),
          React.createElement('div', { className:'rec-city' }, city),
          React.createElement('div', { className:'rec-actions' },
            React.createElement('button', { className:'btn fill', onClick: () => askDayAndAdd(it.name) }, 'Add to itinerary'),
            React.createElement('a', { className:'btn link', href: mapsLink(it.name, city), target:'_blank', rel:'noreferrer' }, 'Maps')
          )
        )
      ))
    )
  );
}

export default Recommendations;
