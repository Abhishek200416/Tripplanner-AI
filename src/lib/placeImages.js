// src/lib/placeImages.js
import { buildUnsplashQueryURL, buildPicsumURL, fallbackPlaceholder } from './imgUtil.js';

/* -------------------------- utils: cleaning -------------------------- */

const STOPWORDS = /\b(breakfast|lunch|dinner|restaurant|pubs?|bars?|caf[eé]s?|markets?|shopping|your|a|the|or|similar|optional|adjust|time|needed|near|nearby|at|in|for|route|open|map|google)\b/gi;

function cleanPOIName(s = "") {
  return String(s)
    .replace(/^Hotel •\s*/i, "")
    .replace(/[+()]/g, " ")       // drop symbols that confuse search
    .replace(/&/g, " and ")
    .replace(STOPWORDS, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Split composite labels like “Charminar & Laad Bazaar, Hyderabad”
function splitCandidates(raw = "") {
  const base = cleanPOIName(raw);
  if (!base) return [];
  const parts = base.split(/[,/&]| and /i).map(s => s.trim()).filter(Boolean);
  // prefer the longest, then others
  const unique = Array.from(new Set([base, ...parts])).sort((a,b)=>b.length-a.length);
  return unique.slice(0, 4);
}

// Some frequent aliases -> exact titles (extend freely)
const TITLE_HINTS = new Map(Object.entries({
  "charminar": "Charminar",
  "laad bazaar": "Laad Bazaar",
  "golconda fort": "Golconda Fort",
  "qutb shahi tombs": "Qutb Shahi Tombs",
  "salar jung museum": "Salar Jung Museum",
  "nehru zoological park": "Nehru Zoological Park",
  "inorbit mall": "Inorbit Mall, Hyderabad"
}));

// Skip Wikipedia if the phrase is clearly generic
function looksGeneric(s = "") {
  return /optional|similar|nearby|breakfast|lunch|dinner|restaurant|market|mall|route|museum|park|palace/i.test(s) && s.split(/\s+/).length > 3;
}

/* -------- Wikipedia: search → pageimages thumbnail (CORS-safe) ------- */
/*
  We use the standard MediaWiki API, not the REST "summary" endpoint.
  - Search: generator=search (gsrsearch=...)
  - Thumbnails: prop=pageimages&piprop=thumbnail&pithumbsize=...
  - CORS: origin=* (per MediaWiki API examples)
*/

async function wikipediaSearchThumb({ title, city, size = 480 }) {
  const q = [title, city, "India"].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: String(size),
    generator: "search",
    gsrlimit: "1",
    gsrsearch: q
  });
  const url = `https://en.wikipedia.org/w/api.php?${params.toString()}`;

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return null;

  const j = await res.json();
  const pages = j?.query?.pages;
  if (!pages) return null;

  const first = Object.values(pages)[0];
  const src = first?.thumbnail?.source;
  return typeof src === "string" ? src : null;
}

/* --------------------------- tiny local cache ------------------------ */

const mem = new Map();
const getCache = (k) => mem.get(k) || JSON.parse(localStorage.getItem(k) || "null");
const setCache = (k, v) => {
  mem.set(k, v);
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
};

/* -------------------------- main resolver --------------------------- */

export async function resolveImageURL({
  poi = "",
  hotelName = "",
  city = "",
  type = "poi",
  w = 480,
  h = 320
}) {
  const isHotel   = type === "hotel" || /^Hotel •/i.test(poi);
  const labelRaw  = isHotel ? (hotelName || poi) : poi;
  const cityLabel = String(city || "").trim();

  const seeds = splitCandidates(labelRaw).map(s => TITLE_HINTS.get(s.toLowerCase()) || s);
  const best   = seeds[0] || cleanPOIName(labelRaw) || cityLabel || "Image";
  const cacheKey = `img2:${isHotel ? "hotel" : "poi"}:${cityLabel}:${best}:${w}x${h}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  // 1) Wikipedia search -> thumbnail (POIs only; skip noisy, too-generic labels)
  if (!isHotel && best && !looksGeneric(best)) {
    // try progressively: “full composite”, then split parts
    for (const candidate of seeds.length ? seeds : [best]) {
      const wiki = await wikipediaSearchThumb({ title: candidate, city: cityLabel, size: Math.max(w,h) });
      if (wiki) {
        const out = { src: wiki, fallbacks: [], alt: `${candidate} photo` };
        setCache(cacheKey, out);
        return out;
      }
    }
  }

  // 2) Unsplash Source (keyword-based, but constrained)
  const query = isHotel
    ? `${best} hotel ${cityLabel} India exterior`
    : `${best} ${cityLabel} India landmark`;
  const unsplash = buildUnsplashQueryURL({ w, h, q: query });

  // 3) Deterministic fallbacks
  const seed = `${cityLabel}-${best}`.toLowerCase();
  const picsum = buildPicsumURL({ w, h, seed });
  const ph     = fallbackPlaceholder({ w, h, label: best });

  const out = { src: unsplash, fallbacks: [picsum, ph], alt: `${best} photo` };
  setCache(cacheKey, out);
  return out;
}

/* --------------------- attach fallbacks to an <img> ------------------ */

export function attachFallbacks(imgEl, urls = []) {
  if (!imgEl || !urls.length) return;
  let i = 0;
  function onerr() {
    if (i < urls.length) imgEl.src = urls[i++];
    else imgEl.removeEventListener("error", onerr);
  }
  imgEl.addEventListener("error", onerr);
}
