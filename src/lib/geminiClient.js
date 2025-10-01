// src/lib/geminiClient.js
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const delay = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * City/tier pricing with simple seasonal/weekend/festival adjustments and local/live overrides
 */
export function getCityPricing(city = '', tier = 'mid', ctx = {}) {
  const c = String(city || '').toLowerCase();
  const TIER_FACT = tier === 'budget' ? 0.72 : tier === 'luxe' ? 1.95 : 1.0;
  const now = new Date();
  const range = ctx.travelWindow && ctx.travelWindow.startDate && ctx.travelWindow.endDate
    ? { start: new Date(ctx.travelWindow.startDate), end: new Date(ctx.travelWindow.endDate) }
    : null;

  let pb = {
    hotelPerNightINR: 3200,
    mealPerPersonPerDayINR: 800,
    localTransitPerPersonPerDayINR: 250,
    poiTicketAvgINR: 150
  };

  if (/(mumbai|goa|delhi|bengaluru|bangalore)/.test(c)) {
    pb.hotelPerNightINR = 4200; pb.mealPerPersonPerDayINR = 950; pb.localTransitPerPersonPerDayINR = 320;
  }
  if (/(jaipur|agra|varanasi|amritsar)/.test(c)) {
    pb.hotelPerNightINR = 3000; pb.mealPerPersonPerDayINR = 700; pb.localTransitPerPersonPerDayINR = 220;
  }
  if (/ayodhya/.test(c)) {
    pb.hotelPerNightINR = 3800; pb.mealPerPersonPerDayINR = 750; pb.localTransitPerPersonPerDayINR = 260; pb.poiTicketAvgINR = 120;
  }

  pb.hotelPerNightINR = Math.round(pb.hotelPerNightINR * TIER_FACT);

  const m = (range?.start || now).getMonth();
  let seasonFactor = 1.0;
  if (m >= 3 && m <= 5) {
    if (/(goa|andaman|ooty|manali|mussoorie|nainital|munnar)/.test(c)) seasonFactor = 1.12;
    if (/(jaipur|agra|varanasi|hyderabad|delhi)/.test(c)) seasonFactor = 0.95;
  }
  if (m >= 9 || m <= 0) seasonFactor = 1.10;

  let weekendFactor = 1.0;
  if (range) {
    let days = 0, weekends = 0, d = new Date(range.start);
    while (d <= range.end) {
      const wd = d.getDay(); if (wd === 0 || wd === 6) weekends++; days++; d.setDate(d.getDate() + 1);
    }
    const share = days ? weekends / days : 0;
    weekendFactor = 1 + Math.min(0.06, share * 0.08);
  }

  const festivalFactor = (/ayodhya|varanasi|haridwar|amritsar/.test(c)) ? 1.06 : 1.0;

  pb.hotelPerNightINR = Math.round(pb.hotelPerNightINR * seasonFactor * weekendFactor * festivalFactor);
  pb.poiTicketAvgINR   = Math.round(pb.poiTicketAvgINR * (festivalFactor > 1 ? 1.05 : 1.0));
  pb.mealPerPersonPerDayINR = Math.round(pb.mealPerPersonPerDayINR * (seasonFactor > 1 ? 1.03 : 1.0));
  pb.localTransitPerPersonPerDayINR = Math.round(pb.localTransitPerPersonPerDayINR * (weekendFactor > 1 ? 1.03 : 1.0));

  try {
    if (typeof window !== 'undefined' && typeof window.__TP_PRICING__ === 'function') {
      const live = window.__TP_PRICING__({ city, tier, ctx });
      if (live && typeof live === 'object') pb = { ...pb, ...live };
    }
  } catch {}

  try {
    const raw = localStorage.getItem('tpPricingOverrides');
    if (raw) {
      const map = JSON.parse(raw);
      const key = `${c}|${tier}`;
      if (map && map[key] && typeof map[key] === 'object') pb = { ...pb, ...map[key] };
    }
  } catch {}

  return pb;
}

/* ---------------- Gemini gate & cooldown ---------------- */

let active = 0;
const queue = [];
const MAX_CONCURRENT = 1;       // avoid API bursts

let cooldownUntil = 0;          // ms epoch
function inCooldown() { return Date.now() < cooldownUntil; }
function setCooldown(ms) { cooldownUntil = Date.now() + ms; }

async function runInGate(fn) {
  if (active >= MAX_CONCURRENT) await new Promise(res => queue.push(res));
  active++;
  try { return await fn(); }
  finally {
    active--;
    const next = queue.shift();
    if (next) next();
  }
}

async function callGemini(prompt) {
  // If no key OR in cooldown, gracefully short-circuit to mock
  if (!GEMINI_KEY || inCooldown()) return { text: "", source: "mock", error: GEMINI_KEY ? "COOLDOWN" : "NO_API_KEY" };

  return runInGate(async () => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
    const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 1400 } };

    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json",
     "x-goog-api-key": GEMINI_KEY }, body: JSON.stringify(body), signal: controller.signal });
        if (res.status === 503) throw new Error("UNAVAILABLE_503");
        if (res.status === 429) throw new Error("RATE_LIMIT_429");
        if (!res.ok) throw new Error("HTTP_" + res.status);
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return { text, source: "live" };
      } catch (err) {
        lastErr = err;
        clearTimeout(timeoutId);
        const msg = String(err?.message || err);
        const retriable = msg === "AbortError" || /UNAVAILABLE_503|RATE_LIMIT_429|HTTP_5\d\d/.test(msg) || /Failed to fetch|NetworkError/i.test(msg);

        // If rate-limited, set a short cooldown so UI doesn’t spam
        if (/RATE_LIMIT_429/.test(msg)) setCooldown(20000 + Math.floor(Math.random()*10000)); // 20–30s
        if (retriable && attempt < 3) {
          const backoff = 500 * Math.pow(2, attempt) + Math.random() * 300;
          await delay(backoff);
          continue;
        }
        break;
      } finally { clearTimeout(timeoutId); }
    }
    return { text: "", source: "mock", error: lastErr?.message || "UNKNOWN_ERROR" };
  });
}

/* ---------------- Prompt builder + mocks ---------------- */

function buildPrompt({
  city, days, budget, themes,
  travellers = 1, hotelTier = "mid",
  travelWindow = null, timeSlotsHint = [],
  transportBudgetINR = 0, travelMode = null,
  partyType = "general",
  ageBands = null,
  mobility = null
}) {
  const perDay = Math.max(1, Math.round((budget || 0) / Math.max(1, days || 1)));
  const windowText = travelWindow ? `Dates: ${travelWindow.startDate} to ${travelWindow.endDate}.` : "Dates: flexible.";
  const slots = (Array.isArray(timeSlotsHint) && timeSlotsHint.length)
    ? `Daily time windows: ${timeSlotsHint.map(x => x.t).join(", ")}.`
    : "Daily time windows: morning, afternoon, evening.";

  const partyHint = [
    `Party type: ${partyType}.`,
    ageBands ? `Age bands: kids ${ageBands.kids||0}, teens ${ageBands.teens||0}, adults ${ageBands.adults||0}, seniors ${ageBands.seniors||0}.` : '',
    mobility ? `Mobility: stroller ${!!mobility.stroller}, step-free ${!!mobility.stepFree}, slow-pace ${!!mobility.slowPace}.` : ''
  ].filter(Boolean).join(' ');

  return [
    "You are a meticulous Indian travel planner. Output JSON ONLY in this schema:",
    '{ "city": "<city>", "budgetINR": <int>, "transportBudgetINR": <int>, "travellers": <int>, "hotelTier": "<budget|mid|luxe>", "days": [ { "date": "", "slots":[ { "time":"", "theme":"", "poiQuery":"", "estCostINR":0, "notes":"" } ] } ], "packingHints": [ "<short item>" ] }',
    `City: ${city}. Days: ${days}. Experiences budget (INR): ${budget}. Per-day target per person: ${Math.round(perDay/Math.max(1,travellers))}.`,
    `Transport budget reserved (INR): ${transportBudgetINR}. Preferred mode: ${travelMode || "any"}.`,
    `Travellers: ${travellers}. Hotel tier: ${hotelTier}.`, partyHint,
    `Themes: ${themes}. ${windowText} ${slots}`,
    "Rules: 2–4 slots/day; keep hops ≤ 30 min when possible; include one offbeat spot/day with useful notes.",
    "Adapt pace to party type/ages/mobility (e.g., stroller friendly, step-free access, shaded breaks).",
    'Costs: "estCostINR" is PER PERSON for that slot (tickets/food/activity).',
    "Packing: return 5–8 concise items based on season/themes/party type.",
    "Return JSON only, no Markdown."
  ].join("\n");
}

// Mock POIs
const BANK = {
  heritage:["Fort","City Palace","Stepwell","Old Town Walk","Museum of Art"],
  food:["Famous Biryani","Street Food Lane","Traditional Thali","Dessert House"],
  nature:["Lakeside Walk","Botanical Garden","Urban Park","Sunrise Point"],
  shopping:["Old Market","Handicraft Hub","Fashion Street","Antique Alley"],
  nightlife:["Rooftop Bar","Live Music Club","Night Bazaar","Craft Beer Pub"],
  adventure:["Zipline Park","Rock Trail","Cycling Loop","Kayak Bay"],
  hidden:["Secret Courtyard","Indie Café","Mural Lane","Quiet Temple"]
};
const pick = (list, i) => list[i % list.length];

function mockItinerary({ city, days=3, budget=15000, travellers=1, hotelTier="mid", themes="heritage, food", travelWindow=null }) {
  const P = getCityPricing(city, hotelTier, { travelWindow });
  const themeList = (themes||"").split(",").map(s=>s.trim()).filter(Boolean);
  const outDays = [];
  for (let i=0;i<days;i++){
    const t1 = themeList[i % Math.max(1, themeList.length)] || "heritage";
    outDays.push({
      date:`Day ${i+1}`,
      slots:[
        { time:"09:00-11:00", theme:t1, poiQuery:`${city} ${pick(BANK[t1]||BANK.heritage,i)}`, estCostINR:Math.round(P.poiTicketAvgINR),  notes:`Signature ${t1}` },
        { time:"12:30-13:30", theme:"meals", poiQuery:`${city} Lunch`, estCostINR:Math.round(P.mealPerPersonPerDayINR/2), notes:"Local meal" },
        { time:"16:00-18:00", theme:"hidden", poiQuery:`${pick(BANK.hidden,i)} ${city}`, estCostINR:Math.round(P.poiTicketAvgINR*0.6), notes:"Offbeat stop" },
        { time:"19:30-20:30", theme:"meals", poiQuery:`${city} Dinner`, estCostINR:Math.round(P.mealPerPersonPerDayINR/2), notes:"Simple dinner" }
      ]
    });
  }
  return { city, budgetINR:budget, transportBudgetINR:0, travellers, hotelTier, days:outDays,
           packingHints:["Sunscreen","Power bank","Light jacket","Reusable bottle"], themes };
}

/* ---------------- Public API ---------------- */

export async function generateItinerary(params) {
  try {
    const { text, source, error } = await callGemini(buildPrompt(params));
    if (!text) {
      const mock = mockItinerary(params);
      mock._meta = { source:"mock", reason:error||"no_text" };
      return mock;
    }
    const first = text.indexOf("{");
    const last  = text.lastIndexOf("}");
    const json  = JSON.parse(first>=0 ? text.slice(first,last+1) : text);
    json._meta  = { source: source||"live" };
    return json;
  } catch (e) {
    const mock = mockItinerary(params);
    mock._meta = { source:"mock", reason:String(e?.message||e) };
    return mock;
  }
}

export async function aiSuggestSpots({ city, themes=[] }) {
  const prompt = `List 10 concise POI names for ${city} in India for themes: ${themes.join(", ")}.
Return a JSON array of strings only.`;
  try {
    const { text } = await callGemini(prompt);
    const arr = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]");
    return arr.filter(x=>typeof x==="string");
  } catch { return []; }
}

export async function aiSuggestHotels({ city, tier="mid", limit=8 }) {
  const tierPhrase = tier==="budget" ? "budget-friendly" : tier==="luxe" ? "luxury" : "mid-range";
  const prompt = `List ${limit} ${tierPhrase} hotels in ${city}, India.
Return ONLY a JSON array of hotel names (strings).`;
  try {
    const { text } = await callGemini(prompt);
    const arr = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]");
    return arr.filter(x=>typeof x==="string").slice(0,limit);
  } catch {
    return ["Grand Residency","City Park Inn","Lake View Hotel","Heritage Plaza","Market Square Suites","Garden Court","Sunset Residency","Riverside Hotel"].slice(0,limit);
  }
}

export async function callGeminiLowLevel(prompt) {
  try { const { text } = await callGemini(prompt); return text; } catch { return ""; }
}
