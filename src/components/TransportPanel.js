import React from 'react';
import '../styles/TransportPanel.css';
import { estimateIntercity, compareModes, aiSuggestTransport } from '../lib/transport.js';

const MODES = [
  { id:'flight', label:'Flight',  emoji:'✈️' },
  { id:'train',  label:'Train',   emoji:'🚆' },
  { id:'bus',    label:'Bus',     emoji:'🚌' },
  { id:'car',    label:'Car',     emoji:'🚗' },
  { id:'bike',   label:'Bike',    emoji:'🏍️' },
];

export function TransportPanel({
  origin, originCoords, destination,
  startDate, endDate, travellers=1, budget=0,
  onApplied
}) {
  const [mode, setMode] = React.useState('flight');
  const [roundTrip, setRoundTrip] = React.useState(true);

  const [est, setEst] = React.useState(null);
  const [estimating, setEstimating] = React.useState(false);

  const [cmp, setCmp] = React.useState(null);
  const [comparing, setComparing] = React.useState(false);

  const [ai, setAi] = React.useState([]);
  const inr = new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 });
  const isBusy = estimating || comparing;

  async function doEstimate(){
    try{
      setEstimating(true);
      const r = await estimateIntercity({ origin, originCoords, destination, travellers, mode, roundTrip });
      setEst(r.ok ? r : { ok:false, reason:r.reason || 'Failed' });
    } finally { setEstimating(false); }
  }

  async function doCompare(){
    try{
      setComparing(true);
      const r = await compareModes({ origin, originCoords, destination, travellers, roundTrip, modes: MODES.map(m=>m.id) });
      setCmp(r);
    } finally { setComparing(false); }
  }

  function pickBestByBudget(){
    if (!cmp?.items?.length) return;
    const within = cmp.items.filter(x=>x.total <= Math.max(0,budget));
    const pick = (within.length ? within : cmp.items).reduce((a,b)=> a.total<=b.total ? a : b);
    setMode(pick.mode); setEst(pick); onApplied?.(pick);
  }

  async function boostAI(){
    const list = await aiSuggestTransport({ origin, destination, startDate, endDate, travellers, modeHint:mode });
    setAi(list);
  }

  return (
    React.createElement('div', { className:'transport cardish1' },

      /* Header */
      React.createElement('div', { className:'t-head' },
        React.createElement('div', { className:'sub' }, 'Pick a mode, estimate, or compare across all')
      ),

      /* Mode chips + round-trip toggle */
      React.createElement('div', { className:'modes' },
        ...MODES.map(m =>
          React.createElement('button', {
            key:m.id, type:'button',
            className:'chip ' + (mode===m.id?'active':''), disabled:isBusy,
            onClick:()=> setMode(m.id)
          }, `${m.emoji} ${m.label}`)
        ),
        React.createElement('label', { className:'rtoggle' },
          React.createElement('input', { type:'checkbox', checked:roundTrip, onChange:e=>setRoundTrip(e.target.checked), disabled:isBusy }),
          React.createElement('span', null, 'Round trip')
        )
      ),

      /* Actions */
      React.createElement('div', { className:'t-actions' },
        React.createElement('button', { className:'btn ghost', type:'button', onClick:doEstimate, disabled:isBusy },
          [
            estimating ? React.createElement('span', { key:'s', className:'spinner inline', 'aria-hidden':true }) : null,
            estimating ? 'Estimating…' : `Estimate ${MODES.find(m=>m.id===mode)?.label||''}`
          ]
        ),
        React.createElement('button', { className:'btn ghost', type:'button', onClick:doCompare, disabled:isBusy },
          [
            comparing ? React.createElement('span', { key:'s', className:'spinner inline', 'aria-hidden':true }) : null,
            comparing ? 'Comparing…' : 'Quick compare (all modes)'
          ]
        ),
        React.createElement('button', { className:'btn ghost', type:'button', onClick:boostAI, disabled:isBusy }, 'AI suggestions')
      ),

      /* Estimate result */
      est && est.ok && React.createElement('div', { className:'t-est' },
        React.createElement('div', { className:'row' }, React.createElement('div', null, 'Mode'),
          React.createElement('div', { className:'v' }, `${est.mode}${est.roundTrip?' • RT':''}`)),
        React.createElement('div', { className:'row' }, React.createElement('div', null, 'Distance'),
          React.createElement('div', { className:'v' }, `${est.km} km`)),
        React.createElement('div', { className:'row' }, React.createElement('div', null, 'Travel time'),
          React.createElement('div', { className:'v' }, `${est.hours} hr`)),
        React.createElement('div', { className:'row' }, React.createElement('div', null, 'Per person'),
          React.createElement('div', { className:'v' }, inr.format(est.perPerson))),
        React.createElement('div', { className:'row' }, React.createElement('div', null, `Total (${travellers})`),
          React.createElement('div', { className:'v strong' }, inr.format(est.total))),
        React.createElement('div', { className:'note' }, est.notes || 'Indicative; actual fares vary.'),
        React.createElement('div', { className:'t-apply' },
          React.createElement('button', { className:'btn fill', type:'button', onClick:()=>onApplied?.(est) }, 'Apply to itinerary hints')
        )
      ),
      est && !est.ok && React.createElement('div', { className:'field-error' }, est.reason),

      /* Quick compare (2-column grid) */
      cmp?.items?.length && React.createElement('div', { className:'t-compare' },
        React.createElement('div', { className:'head' }, 'Quick compare'),
        React.createElement('div', { className:'grid' },
          ...cmp.items.map((x,i)=>
            React.createElement('div', { key:i, className:'cmp-card '+(cmp.best?.mode===x.mode?'best':'') },
              React.createElement('div', { className:'row' },
                React.createElement('div', null, x.mode),
                React.createElement('div', { className:'v' }, `${x.km} km • ${x.hours} hr`)
              ),
              React.createElement('div', { className:'row' },
                React.createElement('div', null, 'Per person'),
                React.createElement('div', { className:'v' }, inr.format(x.perPerson))
              ),
              React.createElement('div', { className:'row' },
                React.createElement('div', null, 'Total'),
                React.createElement('div', { className:'v strong' }, inr.format(x.total))
              ),
              React.createElement('div', { className:'cmp-actions' },
                React.createElement('button', { className:'btn ghost tiny', type:'button', onClick:()=>{ setMode(x.mode); setEst(x); } }, 'Preview'),
                React.createElement('button', { className:'btn fill tiny',  type:'button', onClick:()=>onApplied?.(x) }, 'Use')
              )
            )
          )
        ),
        React.createElement('div', { className:'cmp-foot' },
          React.createElement('button', { className:'btn ghost', type:'button', onClick:pickBestByBudget },
            `Pick best by budget (${inr.format(Math.max(0,budget))})`)
        )
      ),

      /* AI operator suggestions */
      ai?.length && React.createElement('div', { className:'ai-suggest' },
        React.createElement('div', { className:'ais-head' }, 'Operator ideas & ranges'),
        React.createElement('ul', null,
          ...ai.map((o,i)=>React.createElement('li',{key:i},
            React.createElement('div',{className:'ais-name'},`${o.mode==='flight'?'✈️':o.mode==='train'?'🚆':o.mode==='bus'?'🚌':o.mode==='car'?'🚗':'🏍️'} ${o.mode} • ${o.name}`),
            React.createElement('div',{className:'ais-meta'},`~${o.durationHours} hr • ${inr.format(o.oneWayFareRangeINR?.[0]||0)}–${inr.format(o.oneWayFareRangeINR?.[1]||0)} one way`),
            o.notes ? React.createElement('div',{className:'ais-notes'}, o.notes) : null
          ))
        )
      ),

      /* Busy overlay */
      React.createElement('div', { className:'panel-loading ' + (isBusy ? 'show' : '') },
        React.createElement('div', { className:'spinner lg', 'aria-hidden':true }),
        React.createElement('div', null, estimating ? 'Estimating…' : 'Comparing…')
      )
    )
  );
}
