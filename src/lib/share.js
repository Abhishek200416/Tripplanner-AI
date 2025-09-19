// Compact-ish (no 3rd-party): base64 of URI-encoded JSON
export function encodePlan(obj) {
  try {
    const s = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(s)));
  } catch { return ''; }
}
export function decodePlan(s) {
  try {
    const j = decodeURIComponent(escape(atob(s)));
    return JSON.parse(j);
  } catch { return null; }
}
export function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}
export function setQueryParam(name, val) {
  const u = new URL(window.location.href);
  if (val) u.searchParams.set(name, val); else u.searchParams.delete(name);
  history.replaceState(null, '', u.toString());
}
