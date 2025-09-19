# Trip Planner PWA (No JSX, React + Firebase Functions + Maps + Gemini)

This is a **one-day MVP scaffold** for the Personalized Trip Planner:
- **React (no JSX)** using `React.createElement`
- **PWA**: installable, offline shell via service worker
- **Maps**: Google Maps JS + Places (lazy loaded in code)
- **AI**: Gemini Developer API (optional; mock fallback when no key)
- **Mock booking**: Firebase Function `/api/book` returns a fake PNR
- **Each component has its own CSS** for clarity

## Quick Start

### 1) Install dependencies
```bash
npm i
```

### 2) Configure environment
Copy `.env.example` → `.env.local` and fill keys:
```
VITE_GEMINI_API_KEY=your_gemini_key_or_empty_for_mock
VITE_MAPS_API_KEY=your_maps_key_or_leave_empty_to_hide_map
VITE_APP_NAME=TripPlanner
```

### 3) Run dev server
```bash
npm run dev
```

### 4) Build
```bash
npm run build
```

### 5) Firebase (optional for deploy + functions)
Install tools, init and deploy:
```bash
npm i -g firebase-tools
firebase login
firebase init  # (Hosting + Functions) - or use provided config
firebase deploy
```

**Local Functions emulation**:
```bash
cd functions
npm i
npm run serve
```

## Notes
- Maps script is **lazy-loaded** from `VITE_MAPS_API_KEY`; if empty, a placeholder message is shown.
- Gemini calls are made via the **Developer API**; if `VITE_GEMINI_API_KEY` is empty, the app generates a **mock itinerary**.
- No Next.js, no JSX. Plain React elements only.
- Styling is lightweight, each component has its own CSS file under `src/styles/`.
- This is a starter; you can swap mock EMT with real partner APIs later.
# Tripplanner-AI
