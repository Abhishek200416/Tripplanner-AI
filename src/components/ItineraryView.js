// src/components/ItineraryView.js
import React from 'react';
import '../styles/ItineraryView.css';
import { gmapsPlaceSearch } from '../lib/mapsLinks.js';
import { subscribe, getMods, removeHotel } from '../lib/planStore.js';
import { getCityPricing } from '../lib/geminiClient.js';

const inrFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
});

function shallowEqualMap(a, b) {
  const ak = Object.keys(a || {}), bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  for (let k of ak) if (a[k] !== b[k]) return false;
  return true;
}

export function ItineraryView({ itinerary }) {
  const hasDays = Array.isArray(itinerary?.days) && itinerary.days.length > 0;
  if (!hasDays) {
    return React.createElement('div', {
      className: 'itinerary empty',
      role: 'status',
      'aria-live': 'polite'
    }, 'No itinerary yet.');
  }

  const city = itinerary.city || 'Destination';
  const travellers = Math.max(1, +itinerary.travellers || 1);

  // subscribe to store modifications (hotels/POIs added from the UI)
  const [mods, setMods] = React.useState(getMods());
  React.useEffect(() => {
    const off = subscribe(next => setMods(next));
    return () => { if (typeof off === 'function') off(); };
  }, []);

  // normalize base days
  const baseDays = React.useMemo(() => {
    const arr = Array.isArray(itinerary?.days) ? itinerary.days : [];
    return arr.map((d, i) => ({
      date: d?.date || `Day ${i + 1}`,
      slots: Array.isArray(d?.slots) ? d.slots : []
    }));
  }, [itinerary?.days]);

  // merge hotel & poi modifications
  const mergedDays = React.useMemo(() => {
    const days = baseDays.map(d => ({ date: d.date, slots: d.slots.slice() }));
    const n = days.length;

    // Hotels
    for (const h of mods.hotels) {
      const rooms = h.roomsPerNight ?? Math.max(1, Math.ceil((h.travellers || travellers) / 2));
      const perPersonPerNight = Math.round((h.pricePerNightINR * rooms) / Math.max(1, (h.travellers || travellers)));
      const nights = Math.min(Math.max(1, +h.nights || 1), n);
      for (let i = 0; i < nights; i++) {
        days[i].slots.push({
          _hid: h._id,
          time: '21:00-21:15',
          theme: 'hotel',
          poiQuery: `Hotel • ${h.name}`,
          estCostINR: perPersonPerNight,
          notes: h.notes || `Room ×${rooms} • est. ₹${h.pricePerNightINR}/night`
        });
      }
    }

    // POIs
    let rr = 0;
    for (const p of mods.pois) {
      const di = Number.isInteger(p.dayIndex) ? Math.max(0, Math.min(n - 1, p.dayIndex)) : (rr++ % Math.max(1, n));
      days[di].slots.push({
        time: p.time || '15:00-16:00',
        theme: 'added',
        poiQuery: p.name,
        estCostINR: Math.max(0, +p.costPerPersonINR || 0),
        notes: p.notes || 'Added'
      });
    }

    // Sort by time within each day
    for (const d of days) d.slots.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return days;
  }, [baseDays, mods, travellers]);

  // budget
  const daySub = React.useMemo(
    () => mergedDays.map(d => (Array.isArray(d.slots) ? d.slots : [])
      .reduce((s, x) => s + (+x?.estCostINR || 0), 0)),
    [mergedDays]
  );
  const perPerson  = React.useMemo(() => daySub.reduce((a, b) => a + b, 0), [daySub]);
  const groupTotal = perPerson * travellers;
  const budgetTotal = Math.max(0, +itinerary.budgetINR || 0);
  const over = Math.max(0, groupTotal - budgetTotal);

  // pricing hint
  const P = React.useMemo(
    () => getCityPricing(city, itinerary.hotelTier || 'mid'),
    [city, itinerary?.hotelTier]
  );

  // collapsible panels
  const [collapsed, setCollapsed] = React.useState(() => new Set());
  const panelsRef = React.useRef([]);
  const [heights, setHeights] = React.useState({});

  React.useEffect(() => { panelsRef.current.length = mergedDays.length; }, [mergedDays.length]);

  const measureKey = React.useMemo(
    () => mergedDays.map(d => (d.slots?.length || 0)).join('|') + `:${mergedDays.length}`,
    [mergedDays]
  );

  React.useLayoutEffect(() => {
    const map = {};
    for (let i = 0; i < mergedDays.length; i++) {
      const el = panelsRef.current[i];
      if (el) map[i] = el.scrollHeight;
    }
    setHeights(prev => (shallowEqualMap(prev, map) ? prev : map));
  }, [measureKey]);

  const toggleDay   = React.useCallback((i) => setCollapsed(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; }), []);
  const collapseAll = React.useCallback(() => setCollapsed(new Set(mergedDays.map((_, i) => i))), [mergedDays]);
  const expandAll   = React.useCallback(() => setCollapsed(new Set()), []);

  // latest hotel chip (top-right)
  const latestHotel = mods.hotels.length ? mods.hotels[mods.hotels.length - 1] : null;
  const onCancelLatestHotel = React.useCallback(() => {
    if (latestHotel?._id) removeHotel(latestHotel._id);
  }, [latestHotel?._id]);

  // header
  const head = React.createElement('div', { className: 'itinerary-head' },
    React.createElement('div', { key: 'title', className: 'title' }, `Itinerary • ${city}`),
    React.createElement('div', { key: 'subrow', className: 'sub-row' },
      React.createElement('div',  { key: 'days', className: 'sub' }, `${mergedDays.length} day(s)`),
      React.createElement('div',  { key: 'dot1', className: 'dot', 'aria-hidden': 'true' }, '•'),
      React.createElement('div',  { key: 'pp',   className: 'sub' }, `Per person: ${inrFmt.format(perPerson)}`),
      travellers > 1
        ? React.createElement(React.Fragment, { key: 'grp' },
            React.createElement('div', { key: 'dot2', className: 'dot', 'aria-hidden': 'true' }, '•'),
            React.createElement('div', { key: 'gt', className: 'sub strong' }, `Group (${travellers}): ${inrFmt.format(groupTotal)}`)
          )
        : null
    ),
    over > 0
      ? React.createElement('div', { key: 'bgalert', className: 'budget-alert' }, `Over budget by ${inrFmt.format(over)} — trim activities/hotel or increase budget.`)
      : React.createElement('div', { key: 'bgok', className: 'budget-ok' }, `Within budget. Daily meals ~${inrFmt.format(P.mealPerPersonPerDayINR)} p.p. are included.`),
    React.createElement('div', { key: 'actions', className: 'head-actions' },
      latestHotel
        ? React.createElement('div', { key: 'latest', className: 'recent-add', title: 'Latest added hotel' },
            React.createElement('span',   { key: 'nm', className: 'ra-name' }, `Hotel • ${latestHotel.name}`),
            React.createElement('button', { key: 'rm', className: 'btn tiny ghost', type: 'button', onClick: onCancelLatestHotel, 'aria-label': 'Remove latest hotel' }, 'Cancel')
          )
        : null,
      React.createElement('button', { key: 'xa', className: 'btn ghost', type: 'button', onClick: expandAll },   'Expand all'),
      React.createElement('button', { key: 'xc', className: 'btn ghost', type: 'button', onClick: collapseAll }, 'Collapse all'),
    )
  );

  // day sections
  const sections = mergedDays.map((d, i) => {
    const label = d?.date || `Day ${i + 1}`;
    const slots = Array.isArray(d.slots) ? d.slots : [];
    const subtotal = daySub[i];
    const isCollapsed = collapsed.has(i);
    const maxH = isCollapsed ? 0 : heights[i];

    const header = React.createElement('div', { className: 'day-header' },
      React.createElement('div', { key: 'ttl', className: 'day-title' }, label),
      React.createElement('div', { key: 'sp',  className: 'spacer' }),
      React.createElement('div', { key: 'st',  className: 'day-subtotal tag' }, `Subtotal: ${inrFmt.format(subtotal)}`),
      React.createElement('button', {
        key: 'tg', className: 'btn ghost sm', type: 'button',
        onClick: () => toggleDay(i),
        'aria-expanded': (!isCollapsed).toString(),
        'aria-controls': `day-panel-${i}`
      }, isCollapsed ? 'Expand' : 'Collapse')
    );

    const items = slots.map((s, j) => {
      const poi = s?.poiQuery || 'Point of Interest';
      const isHotel = /^Hotel •/i.test(poi) || s.theme === 'hotel';
      const url  = gmapsPlaceSearch(isHotel ? poi.replace(/^Hotel •\s*/, '') : poi, city);
      const cost = Number.isFinite(+s?.estCostINR) ? inrFmt.format(+s.estCostINR) : '—';
      const time = s?.time || '—';
      const notes = s?.notes ? String(s.notes) : '';

      const key = s._hid ? `slot-${i}-${j}-${s._hid}-${poi}` : `slot-${i}-${j}-${poi}`;

      return React.createElement('li',
        { key, className: 'slot', role: 'group', 'aria-label': `${poi} at ${time}` },
        React.createElement('span', { className: 'time pill' }, time),
        React.createElement('a', { className: 'poi', href: url, target: '_blank', rel: 'noreferrer' }, poi),
        React.createElement('span', { className: 'cost tag' }, cost),
        notes ? React.createElement('div', { className: 'notes' }, notes) : null
      );
    });

    return React.createElement('section',
      { key: `day-${i}`, className: `day card-subtle ${isCollapsed ? 'collapsed' : ''}`, 'aria-label': `Plan for ${label}` },
      header,
      React.createElement('div', {
        id: `day-panel-${i}`, className: 'day-panel',
        ref: (el) => { panelsRef.current[i] = el; },
        style: (typeof maxH === 'number') ? { maxHeight: `${maxH}px` } : undefined
      },
        React.createElement('ul', { className: 'slots' }, items)
      )
    );
  });

  return React.createElement('div', { className: 'itinerary' }, head, ...sections);
}

export default ItineraryView;
