// src/components/TripForm.js
import React from 'react';
import '../styles/TripForm.css';
import { CustomSelect } from './CustomSelect.js';
import '../styles/CustomSelect.css';

import { generateItinerary } from '../lib/geminiClient.js';
import { CategoryChips } from './CategoryChips.js';
import { getGeo, coordsToPlace } from '../lib/geolocate.js';
import { suggestDateRange, timePresetSlots } from '../lib/dateSuggest.js';
import { TransportPanel } from './TransportPanel.js';

// Optional storage (lazy)
let saveState = null, loadState = null;
(async () => { try { ({ saveState, loadState } = await import('../lib/storage.js')); } catch {} })();

/** City index for autosuggest */
const CITY_INDEX = Array.from(new Set([
  "Hyderabad","Jaipur","Mumbai","Delhi","Bengaluru","Chennai","Kolkata","Pune","Ahmedabad","Goa",
  "Udaipur","Jodhpur","Jaisalmer","Agra","Varanasi","Amritsar","Shimla","Manali","Rishikesh","Haridwar",
  "Dehradun","Nainital","Mussoorie","Mysuru","Coorg","Ooty","Kodaikanal","Munnar","Kochi","Alleppey",
  "Trivandrum","Kanyakumari","Pondicherry","Hampi","Gokarna","Mahabaleshwar","Lonavala","Aurangabad",
  "Khajuraho","Bhopal","Indore","Nagpur","Visakhapatnam","Vijayawada","Tirupati","Madurai","Leh",
  "Srinagar","Gulmarg","Pahalgam","Darjeeling","Kalimpong","Gangtok","Shillong","Kaziranga","Andaman","Lakshadweep"
]));

/** Accessible combobox without JSX */
function CitySuggestInput({ id, label, value, onChange, placeholder }) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [q, setQ] = React.useState(value || "");
  const listboxId = `${id}-listbox`;
  const optionId = (i) => `${id}-opt-${i}`;
  const pendingClickRef = React.useRef(false);

  React.useEffect(() => { setQ(value || ""); }, [value]);

  const list = React.useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return [];
    return CITY_INDEX.filter(c => c.toLowerCase().includes(s)).slice(0, 8);
  }, [q]);

  const debounceRef = React.useRef(null);
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(q), 120);
    return () => clearTimeout(debounceRef.current);
  }, [q, onChange]);

  function choose(v) { onChange(v); setQ(v); setActive(-1); setOpen(false); }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); setActive(0); e.preventDefault(); return; }
    if (!list.length) return;
    if (e.key === 'ArrowDown') setActive(i => (i + 1) % list.length);
    else if (e.key === 'ArrowUp') setActive(i => (i - 1 + list.length) % list.length);
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(list.length - 1);
    else if (e.key === 'Enter') { e.preventDefault(); choose(list[active >= 0 ? active : 0]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setActive(-1); }
  }

  return React.createElement('div', { className: 'autosuggest' }, [
    React.createElement('label', { key: 'lbl', htmlFor: id }, label),
    React.createElement('input', {
      key: 'inp', id, value: q, placeholder, autoComplete: 'off',
      role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': open,
      'aria-controls': listboxId, 'aria-activedescendant': active >= 0 ? optionId(active) : undefined,
      onChange: e => { setQ(e.target.value); setOpen(true); setActive(-1); },
      onFocus: () => setOpen(true), onKeyDown,
      onBlur: () => {
        if (pendingClickRef.current) { setTimeout(() => { pendingClickRef.current = false; setOpen(false); }, 0); }
        else { setTimeout(() => setOpen(false), 100); }
      }
    }),
    (open && list.length)
      ? React.createElement('ul', { key: 'ul', id: listboxId, className: 'as-list', role: 'listbox', 'aria-label': 'City suggestions' },
          list.map((c, i) => React.createElement('li', {
            key: c, id: optionId(i), role: 'option', 'aria-selected': i === active,
            className: 'as-item' + (i === active ? ' active' : ''),
            onMouseDown: () => { pendingClickRef.current = true; choose(c); }
          }, c)))
      : null
  ]);
}

export function TripForm(props) {
  // Core
  const [origin, setOrigin] = React.useState('');
  const [originCoords, setOriginCoords] = React.useState(null);
  const [destination, setDestination] = React.useState('Hyderabad');

  // Trip basics
  const [days, setDays] = React.useState(3);
  const [budget, setBudget] = React.useState(15000);
  const [themes, setThemes] = React.useState('heritage, food');

  // People & stay
  const [travellers, setTravellers] = React.useState(2);
  const [hotelTier, setHotelTier] = React.useState('mid');
  const [partyType, setPartyType] = React.useState('family');

  // Age bands
  const [ageKids, setAgeKids] = React.useState(0);
  const [ageTeens, setAgeTeens] = React.useState(0);
  const [ageAdults, setAgeAdults] = React.useState(2);
  const [ageSeniors, setAgeSeniors] = React.useState(0);

  // Dates / UX
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [dateNote, setDateNote] = React.useState('');
  const [timePreset, setTimePreset] = React.useState('balanced');

  // Budget split
  const [bTransport, setBTransport] = React.useState(30);
  const [bStay, setBStay] = React.useState(40);
  const [bExperiences, setBExperiences] = React.useState(30);

  // UX bits
  const [usingGeo, setUsingGeo] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [stepErrors, setStepErrors] = React.useState({}); // {s1: '', s2:'', ...}
  const [transportHint, setTransportHint] = React.useState(null);

  // Helpers / bounds
  const clampDays = n => Math.max(1, Math.min(30, parseInt(String(n ?? '1'), 10) || 1));
  const clampNonNeg = n => Math.max(0, Math.min(50, parseInt(String(n ?? '0'), 10) || 0));
  const clampTrav = n => Math.max(1, Math.min(50, parseInt(String(n ?? '1'), 10) || 1));
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const minStart = todayISO();
  const maxStart = (() => { const d = new Date(); d.setMonth(d.getMonth() + 18); return d.toISOString().slice(0, 10); })();

  // Bands math
  const bandTotal = () => (ageKids|0) + (ageTeens|0) + (ageAdults|0) + (ageSeniors|0);
  const bandsRemain = () => Math.max(0, clampTrav(travellers) - bandTotal());

  // Quick actions
  const syncTravellersToBands = () => setTravellers(bandTotal());
  const autoFillAdults = () => {
    const t = clampTrav(travellers);
    const rest = (ageKids|0) + (ageTeens|0) + (ageSeniors|0);
    setAgeAdults(Math.max(0, t - rest));
  };

  // Input utils
  function normalizeDateInput(v) {
    const m = String(v).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!m) return v;
    const d=m[1], mo=m[2], y=m[3];
    return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function isoDiffDays(a,b) {
    const da=new Date(a), db=new Date(b);
    return Math.max(1, Math.round((db-da)/86400000)+1);
  }

  // Auto endDate from start+days
  React.useEffect(()=>{ if (!startDate||!days) return;
    const d=new Date(startDate); d.setDate(d.getDate()+clampDays(days)-1);
    setEndDate(d.toISOString().slice(0,10));
  },[startDate,days]);

  // Load/save
  React.useEffect(()=>{ if (!loadState) return;
    try{
      const saved = loadState(); const f = saved?.form || {};
      setOrigin(f.origin || ''); setDestination(f.destination || 'Hyderabad');
      setDays(clampDays(f.days ?? 3)); setBudget(parseInt(f.budget ?? 15000, 10));
      setThemes(f.themes || 'heritage, food'); setTravellers(clampTrav(f.travellers ?? 2));
      setHotelTier(f.hotelTier || 'mid'); setStartDate(f.startDate || ''); setEndDate(f.endDate || '');
      setTimePreset(f.timePreset || 'balanced'); setPartyType(f.partyType || 'family');

      setAgeKids(clampNonNeg(f.ageKids ?? 0)); setAgeTeens(clampNonNeg(f.ageTeens ?? 0));
      setAgeAdults(clampNonNeg(f.ageAdults ?? 2)); setAgeSeniors(clampNonNeg(f.ageSeniors ?? 0));

      setBTransport(f.bTransport ?? 30); setBStay(f.bStay ?? 40); setBExperiences(f.bExperiences ?? 30);
    } catch {}
  },[]);
  React.useEffect(()=>{ if (!saveState) return;
    const id = setTimeout(() => saveState({ form:{
      origin, destination, days, budget, themes, travellers, hotelTier, startDate, endDate, timePreset, partyType,
      ageKids, ageTeens, ageAdults, ageSeniors, bTransport, bStay, bExperiences
    } }), 250);
    return () => clearTimeout(id);
  },[
    origin, destination, days, budget, themes, travellers, hotelTier, startDate, endDate, timePreset, partyType,
    ageKids, ageTeens, ageAdults, ageSeniors, bTransport, bStay, bExperiences
  ]);

  // Smart dates
  const useSmartDates = ()=>{
    const s = suggestDateRange({ city:destination, days, themes });
    setStartDate(s.startISO); setEndDate(s.endISO); setDateNote(s.reason||''); setFormError('');
  };

  const onChangeEndDate = (val)=>{
    const v = normalizeDateInput(val);
    if (!startDate){ setEndDate(v); return; }
    setEndDate(v); setDays(clampDays(isoDiffDays(startDate, v)));
  };

  // Geolocate origin
// In TripForm.js
const useMyLocation = async () => {
  setUsingGeo(true);
  const loc = await getGeo();
  if (!loc) { setUsingGeo(false); alert('Location not available.'); return; }

  setOriginCoords(loc);
  window.dispatchEvent(new CustomEvent('tp:geo', { detail: loc }));

  // Always use our SDK-free reverse geocoder
  const label = await coordsToPlace(loc);
  setOrigin(label || 'Near Me');
  setUsingGeo(false);
};


  // Swap origin/destination
  const swapOD = ()=>{
    setOrigin(prevOrigin => {
      const prevO = prevOrigin;
      setDestination(currDest => {
        const prevD = currDest;
        setOriginCoords(null);
        setTimeout(() => setOrigin(prevD || ''), 0);
        return prevO || '';
      });
      return prevO;
    });
  };

  // Detailed validation with per-step messages + focus
  const firstInvalidRef = React.useRef(null);
  function validateDetailed() {
    const errs = { s1: '', s2: '', s3: '', s4: '' };
    const focusMap = {};

    // Step 1: Route
    if (!destination.trim()) { errs.s1 = 'Fill destination.'; focusMap.s1 = '#destination'; }

    // Step 2: Dates
    if (!startDate || !endDate) { errs.s2 = 'Select start and end dates.'; focusMap.s2 = !startDate ? '#start' : '#end'; }
    else if (new Date(endDate) < new Date(startDate)) { errs.s2 = 'End date must be after start date.'; focusMap.s2 = '#end'; }
    else if (days < 1) { errs.s2 = 'Days must be at least 1.'; focusMap.s2 = '#days'; }

    // Step 3: Budget & Pace
    if (!budget || Number.isNaN(Number(budget)) || Number(budget) <= 0) { errs.s3 = 'Enter a positive budget.'; focusMap.s3 = '#budget'; }
    if ((bTransport + bStay + bExperiences) !== 100) { errs.s3 = 'Budget split must total 100%.'; focusMap.s3 = '#budget'; }

    // Step 4: People & Stay
    if (!partyType) { errs.s4 = 'Choose a party type.'; focusMap.s4 = '#partyType'; }
    if (travellers < 1) { errs.s4 = 'Travellers must be at least 1.'; focusMap.s4 = '#travellers'; }
    const totalBands = bandTotal();
    if (totalBands < 1) { errs.s4 = 'Add people using age bands.'; focusMap.s4 = '#travellers'; }
    else if (totalBands !== travellers) { errs.s4 = `Travellers (${travellers}) must match age bands total (${totalBands}).`; focusMap.s4 = '#travellers'; }

    // focus first invalid
    const firstKey = ['s1','s2','s3','s4'].find(k => errs[k]);
    if (firstKey && focusMap[firstKey]) firstInvalidRef.current = focusMap[firstKey];
    else firstInvalidRef.current = null;

    return errs;
  }

  function focusFirstInvalid() {
    if (!firstInvalidRef.current) return;
    const el = document.querySelector(firstInvalidRef.current);
    if (el && typeof el.focus === 'function') el.focus();
  }

  const handleSubmit = async (e)=>{
    e.preventDefault();
    const errs = validateDetailed();
    setStepErrors(errs);
    const hasErr = Object.values(errs).some(Boolean);
    if (hasErr) { setFormError('Please complete the highlighted fields.'); focusFirstInvalid(); return; }

    props.setError?.(''); props.setLoading?.(true); setSubmitting(true);
    try {
      const ageBands = { kids:ageKids, teens:ageTeens, adults:ageAdults, seniors:ageSeniors };
      const pplSummary = [
        ageAdults>0?`${ageAdults} adult${ageAdults>1?'s':''}`:null,
        ageTeens>0?`${ageTeens} teen${ageTeens>1?'s':''}`:null,
        ageKids>0?`${ageKids} kid${ageKids>1?'s':''}`:null,
        ageSeniors>0?`${ageSeniors} senior${ageSeniors>1?'s':''}`:null
      ].filter(Boolean).join(', ');

      const payload = {
        city: destination,
        days: clampDays(days),
        budget: Math.max(0, parseInt(budget||0, 10)),
        themes,
        travellers: clampTrav(travellers),
        hotelTier,
        origin, originCoords, destination,
        travelWindow: (startDate&&endDate) ? { startDate, endDate } : null,
        timeSlotsHint: timePresetSlots(timePreset),
        transportBudgetINR: Math.max(0, transportHint?.total || Math.round((Number(budget)||0)*bTransport/100) || 0),
        travelMode: transportHint?.mode || 'any',
        partyType,
        ageBands,
        strictAgeBands: true,
        profileNote: `Party: ${partyType}. Composition: ${pplSummary}.`
      };

      const itinerary = await generateItinerary(payload);
      if (itinerary?._meta?.source==='mock' && itinerary?._meta?.reason){
        props.setError?.('Live AI temporarily unavailable ('+itinerary._meta.reason+'). Showing a smart offline itinerary.');
      }
      props.onGenerated?.(itinerary);

      // Broadcast to store
      const daysCount = Array.isArray(itinerary?.days) ? itinerary.days.length : payload.days;
      window.dispatchEvent(new CustomEvent('tp:days',       { detail: daysCount }));
      window.dispatchEvent(new CustomEvent('tp:city',       { detail: payload.city }));
      window.dispatchEvent(new CustomEvent('tp:headcount',  { detail: payload.travellers }));
      window.dispatchEvent(new CustomEvent('tp:hotel-tier', { detail: payload.hotelTier }));
    } catch (e2) {
      props.setError?.(e2?.message || 'Failed to generate');
      setFormError(e2?.message || 'Failed to generate');
    } finally {
      props.setLoading?.(false); setSubmitting(false);
    }
  };

  // Derived UI flags
  const budgetInvalid = !budget || Number(budget)<=0 || Number.isNaN(Number(budget));
  const bandsMismatch = bandTotal() !== travellers;

  // UI
  return React.createElement('form',{ className:'trip-form dense', onSubmit:handleSubmit, noValidate:true }, [
    React.createElement('div', { key:'grid', className:'step-grid' }, [

      // STEP 1 — Route
      React.createElement('section', { key:'s1', className:'step cardish' }, [
        React.createElement('h3', { key:'t', className:'step-title' }, 'Step 1 · Route'),
        stepErrors.s1 ? React.createElement('div', { key:'e', className:'field-error' }, stepErrors.s1) : null,
        React.createElement('div', { key:'r1', className:'row two' }, [
          React.createElement('div', { key:'c1', className:'cell' },
            React.createElement(CitySuggestInput,{ id:'origin', label:'From (origin)', value:origin, onChange:setOrigin, placeholder:'City/area or “Near Me”' })
          ),
          React.createElement('div', { key:'c2', className:'cell btn-stack' }, [
            React.createElement('label',{ key:'lbl', htmlFor:'usegeo' }, 'Auto-detect'),
            React.createElement('button',{
              key:'btn', id:'usegeo', className:'btn ghost', type:'button',
              onClick:useMyLocation, disabled:usingGeo, 'aria-live':'polite'
            }, usingGeo ? 'Locating…' : 'Use my location')
          ])
        ]),
        React.createElement('div', { key:'r2', className:'row two align-end' }, [
          React.createElement('div', { key:'c1', className:'cell' },
            React.createElement(CitySuggestInput,{ id:'destination', label:'To (destination)', value:destination, onChange:setDestination, placeholder:'e.g., Jaipur' })
          ),
          React.createElement('div', { key:'c2', className:'cell btn-stack' }, [
            React.createElement('label',{ key:'lbl', htmlFor:'swap' }, 'Quick action'),
            React.createElement('button',{ key:'btn', id:'swap', className:'btn ghost', type:'button', onClick:swapOD }, 'Swap')
          ])
        ])
      ]),

      // STEP 2 — Dates
      React.createElement('section', { key:'s2', className:'step cardish' }, [
        React.createElement('h3', { key:'t', className:'step-title' }, 'Step 2 · Dates'),
        stepErrors.s2 ? React.createElement('div', { key:'e', className:'field-error' }, stepErrors.s2) : null,
        React.createElement('div', { key:'r1', className:'row three' }, [
          React.createElement('div', { key:'c1', className:'cell' }, [
            React.createElement('label',{ key:'l', htmlFor:'start' }, 'Start date'),
            React.createElement('input',{
              key:'i', id:'start', type:'date', value:startDate, min:minStart, max:maxStart,
              onChange:e=>setStartDate(normalizeDateInput(e.target.value)),
              onBlur:e=>setStartDate(normalizeDateInput(e.target.value))
            })
          ]),
          React.createElement('div', { key:'c2', className:'cell' }, [
            React.createElement('label',{ key:'l', htmlFor:'days' }, 'Days'),
            React.createElement('input',{ key:'i', id:'days', type:'number', min:1, max:30,
              value:days, onChange:e=>setDays(clampDays(e.target.value)) })
          ]),
          React.createElement('div', { key:'c3', className:'cell' }, [
            React.createElement('label',{ key:'l', htmlFor:'end' }, 'End date'),
            React.createElement('input',{
              key:'i', id:'end', type:'date', value:endDate, min:startDate||minStart, max:maxStart,
              onChange:e=>onChangeEndDate(e.target.value), onBlur:e=>onChangeEndDate(e.target.value)
            })
          ])
        ]),
        React.createElement('div', { key:'r2', className:'row actions compact' }, [
          React.createElement('button',{ key:'b', type:'button', className:'btn ghost', onClick:useSmartDates }, 'Recommend dates'),
          dateNote ? React.createElement('span',{ key:'n', className:'note' }, dateNote) : null
        ])
      ]),

      // STEP 3 — Budget & Pace
      React.createElement('section', { key:'s3', className:'step cardish' }, [
        React.createElement('h3', { key:'t', className:'step-title' }, 'Step 3 · Budget & Pace'),
        stepErrors.s3 ? React.createElement('div', { key:'e', className:'field-error' }, stepErrors.s3) : null,
        React.createElement('div', { key:'r', className:'row two' }, [
          React.createElement('div', { key:'c1', className:'cell' }, [
            React.createElement('label',{ key:'l', htmlFor:'budget' }, 'Total budget (₹)'),
            React.createElement('input',{ key:'i', id:'budget', type:'number', min:0, step:500,
              value:budget, onChange:e=>setBudget(parseInt(e.target.value||'0',10)) }),
            (!budget || Number(budget)<=0 || Number.isNaN(Number(budget)))
              ? React.createElement('small',{ key:'w', className:'warn' }, 'Enter a positive budget.')
              : null
          ]),
          React.createElement('div', { key:'c2', className:'cell' }, [
            React.createElement('label',{ key:'l', htmlFor:'times' }, 'Time style'),
            React.createElement(CustomSelect, {
              key:'s', id:'times', value:timePreset, onChange:setTimePreset,
              options:[ {value:'balanced',label:'Balanced'}, {value:'early',label:'Early bird'}, {value:'nightlife',label:'Nightlife'} ]
            }),
            React.createElement('div',{ key:'tp', className:'time-preview','aria-live':'polite' },
              timePresetSlots(timePreset).map((s,i)=>React.createElement('span',{ key:`tchip-${i}`, className:'chip-time' }, s.t))
            )
          ])
        ]),
        ((bTransport + bStay + bExperiences) !== 100)
          ? React.createElement('small', { key:'bs-w', className:'warn' }, 'Budget split must total 100%.')
          : null
      ]),

      // STEP 4 — Vibes & People
      React.createElement('section', { key:'s4', className:'step cardish' }, [
        React.createElement('h3', { key:'t', className:'step-title' }, 'Step 4 · Vibes & People'),
        stepErrors.s4 ? React.createElement('div', { key:'e', className:'field-error' }, stepErrors.s4) : null,
        React.createElement('div', { key:'rowv', className:'row' }, [
          React.createElement('label', { key:'vl' }, 'Vibes'),
          React.createElement(CategoryChips, { key:'vc', value:themes, onChange:setThemes })
        ]),
        React.createElement('div', { key:'r2', className:'row two' }, [
          React.createElement('div', { key:'c1', className:'cell' }, [
            React.createElement('label', { key:'l', htmlFor:'travellers' }, 'Travellers (total)'),
            React.createElement('input', { key:'i', id:'travellers', type:'number', min:1, max:50, value:travellers,
              onChange:e=>setTravellers(clampTrav(e.target.value)) })
          ]),
          React.createElement('div', { key:'c2', className:'cell' }, [
            React.createElement('label', { key:'l', htmlFor:'hotelTier' }, 'Hotel tier'),
            React.createElement(CustomSelect, {
              key:'s', id:'hotelTier', value:hotelTier, onChange:setHotelTier,
              options:[ {value:'budget',label:'Budget'}, {value:'mid',label:'Mid'}, {value:'luxe',label:'Luxe'} ]
            })
          ])
        ]),
        React.createElement('div', { key:'r3', className:'row two' }, [
          React.createElement('div', { key:'c1', className:'cell' }, [
            React.createElement('label', { key:'l' }, 'Party type'),
            React.createElement(CustomSelect, {
              key:'s', id:'partyType', value:partyType, onChange:setPartyType,
              options:[ {value:'family',label:'Family'}, {value:'couple',label:'Couple'}, {value:'friends',label:'Friends'}, {value:'solo',label:'Solo'}, {value:'elderly',label:'Elderly'} ]
            })
          ]),
          React.createElement('div', { key:'c2', className:'cell' },
            React.createElement('div', { className:'mini-badges' }, [
              React.createElement('button', { key:'pb1', type:'button', className:'pill', onClick:syncTravellersToBands }, 'Set Travellers = Bands total'),
              React.createElement('button', { key:'pb2', type:'button', className:'pill', onClick:autoFillAdults }, 'Auto-fill Adults')
            ])
          )
        ]),
        React.createElement('div', { key:'bands', className:'row four band-row' }, [
          React.createElement('div', { key:'k', className:'cell' }, [
            React.createElement('label', { key:'l' }, 'Kids (0–9)'),
            React.createElement('input', { key:'i', type:'number', min:0, max:50, value:ageKids, onChange:e=>setAgeKids(clampNonNeg(e.target.value)) })
          ]),
          React.createElement('div', { key:'t', className:'cell' }, [
            React.createElement('label', { key:'l' }, 'Teens (10–17)'),
            React.createElement('input', { key:'i', type:'number', min:0, max:50, value:ageTeens, onChange:e=>setAgeTeens(clampNonNeg(e.target.value)) })
          ]),
          React.createElement('div', { key:'a', className:'cell' }, [
            React.createElement('label', { key:'l' }, 'Adults (18–59)'),
            React.createElement('input', { key:'i', type:'number', min:0, max:50, value:ageAdults, onChange:e=>setAgeAdults(clampNonNeg(e.target.value)) })
          ]),
          React.createElement('div', { key:'s', className:'cell' }, [
            React.createElement('label', { key:'l' }, 'Seniors (60+)'),
            React.createElement('input', { key:'i', type:'number', min:0, max:50, value:ageSeniors, onChange:e=>setAgeSeniors(clampNonNeg(e.target.value)) })
          ])
        ]),
        React.createElement('div', { key:'sum', className:'bands-summary', 'aria-live':'polite' }, [
          React.createElement('span', { key:'pn', className:'pill-note' }, `Bands total: ${bandTotal()} • Remaining: ${bandsRemain()} • Travellers: ${travellers}`)
        ])
      ]),

      // STEP 5 — Transport
      React.createElement('section', { key:'s5', className:'step cardish step-scroll' }, [
        React.createElement('h3', { key:'t', className:'step-title' }, 'Step 5 · Transport'),
        React.createElement(TransportPanel, {
          key:'tp', origin, originCoords, destination, startDate, endDate, travellers, budget,
          onApplied:(est)=>{ setTransportHint(est); }
        })
      ])
    ]),

    formError ? React.createElement('div', { key:'err', className:'field-error', role:'alert' }, formError) : null,
    React.createElement('div', { key:'actions', className:'row actions' },
      React.createElement('button', { type:'submit', className:'btn fill wide',
        disabled:submitting || budgetInvalid || (bandTotal()!==travellers) },
        submitting ? 'Weaving magic…' : 'Generate')
    )
  ]);
}

export default TripForm;
