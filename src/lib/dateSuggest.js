// src/lib/dateSuggest.js
// Zero-dep heuristics: recommend start/end dates & time presets for India.
const INR_SEASONS = {
  GOOD:    [10,11,12,1,2,3], // Oct–Mar (dry/cool) — broadly best
  SHOULDER:[4,5],            // Apr–May (hot)
  AVOID:   [6,7,8,9],        // Jun–Sep (SW monsoon)
};

const HILL_STATIONS = /shimla|manali|mussoorie|nainital|darjeeling|ooty|munnar|kodaikanal|coorg|sikkim|gulmarg|pahalgam/i;
const BEACHY       = /goa|gokarna|varkala|kovalam|puri|pondicherry|andaman|lakshadweep|daman|digha|alibaug|ganpatipule/i;
const WILDLIFE     = /ranthambhore|bandhavgarh|kanha|pench|tadoba|gir|kaziranga|corbett|sundarbans|bandipur|periyar/i;

function addDays(iso, n) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10);
}
function nextMonthStart(from, month) {
  const y = from.getMonth()+1 <= month ? from.getFullYear() : from.getFullYear()+1;
  return new Date(y, month-1, Math.min(15, 1)); // aim early/mid-month
}
function pickWindow(months, from=new Date()) {
  // Earliest good month ≥ today
  for (let k=0;k<24;k++){
    const d = new Date(from); d.setMonth(d.getMonth()+k); const m=d.getMonth()+1;
    if (months.includes(m)) return new Date(d.getFullYear(), d.getMonth(), 15);
  }
  return new Date(from);
}

export function suggestDateRange({ city='', days=3, themes='' }, today=new Date()) {
  const t = (themes||'').toLowerCase();
  const c = (city||'').toLowerCase();

  let good = INR_SEASONS.GOOD.slice();
  let note = 'Cool & dry months preferred.';
  // Special cases
  if (HILL_STATIONS.test(c) || /nature|adventure/.test(t)) {
    // Hills: Mar–Jun, Sep–Nov
    good = [3,4,5,6,9,10,11];
    note = 'Hill-station window (Mar–Jun, Sep–Nov).';
  } else if (BEACHY.test(c)) {
    // Beaches: Nov–Feb
    good = [11,12,1,2];
    note = 'Beach season (Nov–Feb).';
  } else if (WILDLIFE.test(c) || /wildlife|safari/.test(t)) {
    // Wildlife: Oct–Apr, peak sightings Feb–Apr
    good = [10,11,12,1,2,3,4];
    note = 'Wildlife season (Oct–Apr), peak Feb–Apr.';
  }

  const start = pickWindow(good, today);
  const startISO = start.toISOString().slice(0,10);
  const endISO = addDays(startISO, Math.max(1, days)-1);

  return { startISO, endISO, reason: note };
}

export function timePresetSlots(kind='balanced') {
  const base = {
    balanced: [{t:'09:00-12:00'},{t:'13:00-17:00'},{t:'19:00-22:00'}],
    early:    [{t:'07:00-10:00'},{t:'11:00-15:00'},{t:'17:00-20:00'}],
    nightlife:[{t:'10:00-12:00'},{t:'14:00-17:00'},{t:'20:00-23:59'}],
  };
  return base[kind] || base.balanced;
}

