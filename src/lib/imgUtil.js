// src/lib/imgUtil.js

export function buildUnsplashQueryURL({ w = 480, h = 320, q = "" } = {}) {
  // Unsplash "Source" endpoint returns a random-but-relevant image via redirect
  const base = `https://source.unsplash.com/${w}x${h}/?`;
  return base + encodeURIComponent(q);
}

export function buildPicsumURL({ w = 480, h = 320, seed = "" } = {}) {
  // Deterministic seeded image (no redirects, always works within CSP)
  const s = encodeURIComponent(seed || String(Math.random()).slice(2));
  return `https://picsum.photos/seed/${s}/${w}/${h}`;
}

export function fallbackPlaceholder({ w = 480, h = 320, label = "No image" } = {}) {
  return `https://placehold.co/${w}x${h}?text=${encodeURIComponent(label)}`;
}

/** Attach a chain of fallbacks to an <img>. */
export function withFallbackChain(imgEl, urls = []) {
  if (!imgEl || !urls?.length) return;
  let i = 0;
  function onerr() {
    if (i < urls.length) imgEl.src = urls[i++];
    else imgEl.removeEventListener('error', onerr);
  }
  imgEl.addEventListener('error', onerr);
}

/** Back-compat: single fallback */
export function withFallback(imgEl, fallbackURL) {
  withFallbackChain(imgEl, [fallbackURL]);
}
