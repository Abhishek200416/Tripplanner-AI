# TripPlanner-AI — PWA (No JSX, React + Maps + Gemini)

A lightweight, installable trip-planning web app for India that creates **budget-aware, day-by-day itineraries** from your inputs (city, days, themes, party type). Built with **plain React (no JSX)** and **modern CSS**, it runs great even **without paid API keys** thanks to smart fallbacks.

**Live demo:** [https://strong-lily-7b13c2.netlify.app/](https://strong-lily-7b13c2.netlify.app/)
**Tech:** React (no JSX) · Vite · PWA · Google Gemini (optional) · Google Maps (optional)
**Repo:** *this project*

---

## ✨ Features

* **AI Itinerary Generation**

  * Uses **Gemini 1.5** via Google Generative Language API when `VITE_GEMINI_API_KEY` is set.
  * If no key or rate-limited, returns a **high-quality mock itinerary** so the app always works in demos.
* **Budget Intelligence**

  * Per-person + group totals, day subtotals, “over budget” alerts, and adjustable budget split.
* **Transport Planner**

  * Estimate or **compare across modes** (✈️/🚆/🚌/🚗/🏍️), round-trip toggle, group-aware costs.
* **Hotels & POIs**

  * AI hotel/spot suggestions; add to itinerary; open places in Google Maps instantly.
* **Maps, Two Modes**

  * **Maps Lite (default):** opens ordered routes in Google Maps URLs — **no billing required**.
  * **Live Map (optional):** when `VITE_MAPS_API_KEY` is present, show markers + day-1 route + totals.
* **Personalization**

  * Vibes (Heritage, Nightlife, Food, Nature, Shopping, Adventure, Hidden Gems), party types, age bands, pace presets.
* **PWA & Share**

  * Install to home screen, persistent state, **shareable URL** encoding the plan.
* **Accessibility & Performance**

  * Keyboardable custom select/autosuggest, ARIA states, focus-on-first-error validation, fast Vite build.

> **Note:** This MVP **does not use Firebase**. It uses only the **Gemini API** (optional) and Google Maps JS/URLs (optional).

---

## 🧭 Table of Contents

* [Quick Start](#-quick-start)
* [Environment Variables](#-environment-variables)
* [Scripts](#-scripts)
* [Project Structure](#-project-structure)
* [How It Works](#-how-it-works)
* [Deployment (Netlify)](#-deployment-netlify)
* [Privacy & Data](#-privacy--data)
* [Accessibility Notes](#-accessibility-notes)
* [Roadmap](#-roadmap)
* [Credits](#-credits)
* [License](#-license)

---

## 🚀 Quick Start

1. **Install**

```bash
npm i
```

2. **Configure environment** (create `.env.local`)

```bash
VITE_GEMINI_API_KEY=           # leave empty to use mock AI
VITE_MAPS_API_KEY=             # leave empty to use Maps Lite only
VITE_APP_NAME=TripPlanner
```

3. **Run dev server**

```bash
npm run dev
```

4. **Build**

```bash
npm run build
```

Open the live demo here: **[https://strong-lily-7b13c2.netlify.app/](https://strong-lily-7b13c2.netlify.app/)**

---

## 🔐 Environment Variables

| Variable              | Purpose                                                              | Required? | Notes                                                                              |
| --------------------- | -------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| `VITE_GEMINI_API_KEY` | Enables live itinerary & suggestion generation via Gemini 1.5        | No        | Without it, the app returns a **deterministic mock** itinerary for reliable demos. |
| `VITE_MAPS_API_KEY`   | Enables Google Maps JS (markers, day-1 route overlay, travel totals) | No        | Without it, the app uses **Maps Lite** (URL links) which requires **no billing**.  |
| `VITE_APP_NAME`       | Branding in header                                                   | No        | Defaults to `TripPlanner`.                                                         |

---

## 🧰 Scripts

```bash
npm run dev        # start Vite dev server
npm run build      # production build to /dist
npm run preview    # preview the production build locally
```

*No Firebase scripts are included in this project.*

---

## 🗂 Project Structure (high level)

```
src/
  App.js                    # App shell (no JSX)
  main.js                   # Boot + SW + PWA install hooks
  components/               # React components (no JSX)
  lib/                      # AI, geo, maps, transport, storage, sharing
  styles/                   # Per-component CSS + theme
public/
  manifest.webmanifest      # PWA manifest
  icon-192.png, icon-512.png
```

Key components:

* `TripForm.js` — 5-step planner (route, dates, budget, vibes/people, transport)
* `ItineraryView.js` — day sections, subtotals, budget status
* `MapView.js` + `MapViewLite.js` — live SDK vs. URL routes
* `HotelsPanel.js`, `Recommendations.js` — AI suggestions + add to plan
* `TransportPanel.js` — estimate/compare modes + AI operator hints

Key libs:

* `lib/geminiClient.js` — Gemini gate, cooldowns, deterministic mock fallback
* `lib/mapsClient.js` / `lib/mapsLinks.js` — SDK helpers + URL builders
* `lib/geolocate.js` — polite OSM reverse-geocode + caching (no billing)
* `lib/planStore.js` — in-memory store + events (hotels/POIs/meta)
* `lib/dateSuggest.js` — season-aware India date heuristics
* `lib/share.js`, `lib/storage.js` — URL encode/decode + localStorage

---

## ⚙️ How It Works

* **AI:** If `VITE_GEMINI_API_KEY` exists, prompts Gemini 1.5 for a JSON itinerary and suggestions. Otherwise, a **deterministic mock generator** produces realistic data so every demo works without keys.
* **Maps:**

  * **Lite** — Uses Google Maps **URL** scheme to open POIs and daily routes in the correct order (no billing).
  * **Live** — If `VITE_MAPS_API_KEY` is present, lazy-loads Maps JS + Places, drops markers, draws the Day-1 polyline, and sums travel time/distance across days.
* **Costs:** Pricing heuristics per city & hotel tier compute meal/POI/local-transit baselines; UI shows per-person/day subtotals and group totals.
* **PWA:** Installable via A2HS; offline shell (app chrome) with state in `localStorage`. Share link encodes the plan in the URL.

---

## ☁️ Deployment (Netlify)

Netlify is already configured for the live demo.

1. **Build locally**

```bash
npm run build
```

2. **Netlify settings**

* **Build command:** `npm run build`
* **Publish directory:** `dist`
* **Environment variables:** add `VITE_GEMINI_API_KEY` and/or `VITE_MAPS_API_KEY` if you want Live AI/Map.

> The app gracefully falls back to **mock AI** and **Maps Lite** when keys are absent, so you can deploy without any billing.

---

## 🔒 Privacy & Data

* No server database.
* No personal data is sent to our servers.
* Plans are stored **locally** in the browser (`localStorage`) and optionally encoded in the share URL.
* If you provide API keys, calls go to Google’s services (Gemini / Maps) per their terms.

---

## ♿ Accessibility Notes

* Keyboardable custom select & autosuggest (`role="listbox"/"combobox"`).
* Category chips with `aria-pressed`.
* Step validation with **focus to first error** and line-level hints.
* Status/alert regions for loading and budget banners.

---

## 🛣 Roadmap

* Multi-city trips & smart packing (distance-aware day ordering)
* Weather/events nudges and real-time adjustments
* PDF export & calendar sync
* Collaboration (share + edit)
* Hindi and regional languages

---

## 🙏 Credits

* **Google Gemini 1.5** (Generative Language API) — itinerary & suggestions
* **Google Maps JavaScript API** (optional) and **Google Maps URL scheme**
* **OpenStreetMap Nominatim** — reverse geocoding in no-billing mode
* React + Vite

---

## 📄 License

MIT — see `LICENSE` in this repo.

---

## 🧪 Try It Now

* **Live demo:** [https://strong-lily-7b13c2.netlify.app/](https://strong-lily-7b13c2.netlify.app/)
* Tip: If you don’t add any keys, the app still works (mock AI + Maps Lite).
* Optional: Add your keys in `.env.local` to unlock live Gemini + Live Map.

---

### Badges (optional for your README)

```md
![PWA](https://img.shields.io/badge/PWA-ready-blue)
![React](https://img.shields.io/badge/React-no%20JSX-61DAFB)
![AI](https://img.shields.io/badge/AI-Gemini%201.5-8A2BE2)
![Build](https://img.shields.io/badge/Build-Vite-646CFF)
![Deploy](https://img.shields.io/badge/Deploy-Netlify-00C7B7)
```

---
