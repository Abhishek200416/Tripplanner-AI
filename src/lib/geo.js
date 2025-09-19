// Tiny geo utilities + a Gemini fallback geocoder (no billing maps needed).
import { callGeminiLowLevel } from './geminiClient.js';

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat/2) ** 2;
  const s2 = Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

export async function geocodeViaGemini(place) {
  const prompt = [
    `Give latitude and longitude for "${place}" in India.`,
    `Return JSON only: {"lat": <number>, "lng": <number>, "confidence": 0..1}`,
  ].join('\n');
  try {
    const text = await callGeminiLowLevel(prompt);
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    if (typeof json.lat === 'number' && typeof json.lng === 'number') {
      return { lat: json.lat, lng: json.lng, conf: Math.max(0, Math.min(1, json.confidence ?? 0.6)) };
    }
  } catch {}
  return null;
}
