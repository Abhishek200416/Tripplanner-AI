// src/App.js
import React from 'react';
import { Header } from './components/Header.js';
import { TripForm } from './components/TripForm.js';
import { ItineraryView } from './components/ItineraryView.js';
import { MapView } from './components/MapView.js';
import { HotelsPanel } from './components/HotelsPanel.js';
import { Recommendations } from './components/Recommendations.js';

import './styles/theme.css';
import './styles/utilities.css';
import './styles/App.css';
import './styles/HotelsPanel.css';
import './styles/MapLite.css';
import './styles/ItineraryView.css';
import './styles/TripForm.css';
import './styles/Header.css';
import './styles/CategoryChips.css';
import './styles/TransportPanel.css';
export function App() {
  const [itinerary, setItinerary] = React.useState(null);
  const [loading, setLoading]     = React.useState(false);
  const [error, setError]         = React.useState('');
  const [theme, setTheme]         = React.useState('light');

  const [travellers, setTravellers] = React.useState(2);
  const [hotelTier, setHotelTier]   = React.useState('mid');

  // Apply theme to <html>
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Listen for cross-panel signals (headcount, tier)
  React.useEffect(() => {
    const onHead = (e) => setTravellers(e.detail || 1);
    const onTier = (e) => setHotelTier(e.detail || 'mid');
    window.addEventListener('tp:headcount', onHead);
    window.addEventListener('tp:hotel-tier', onTier);
    return () => {
      window.removeEventListener('tp:headcount', onHead);
      window.removeEventListener('tp:hotel-tier', onTier);
    };
  }, []);

  // Fancy loading backdrop toggle
  React.useEffect(() => {
    document.body.classList.toggle('is-loading-magic', loading);
    return () => document.body.classList.remove('is-loading-magic');
  }, [loading]);

  // Helpers
  const onPlanGenerated = (data) => {
    setItinerary(data);
    setError('');
  };

  return React.createElement(
    'div',
    { className: 'app-root' },

    // Header
    React.createElement(Header, {
      title: import.meta.env.VITE_APP_NAME || 'TripPlanner',
      theme,
      onToggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
    }),

    // Main content
    React.createElement(
      'main',
      { className: 'stack container' },

      // Planner card (always on top)
      React.createElement(
        'section',
        { className: 'card glass' },
        React.createElement('h2', { className: 'card-title' }, 'Plan your trip'),
        React.createElement(TripForm, {
          onGenerated: onPlanGenerated,
          setLoading,
          setError,
        })
      ),

      // Side-by-side area on wide screens: itinerary (left) + map (right)
      React.createElement(
        'div',
        { className: 'two-col' },
        React.createElement(
          'section',
          { className: 'card glass' },
          React.createElement(ItineraryView, { itinerary })
        ),
        React.createElement(
          'section',
          { className: 'card glass sticky-side' },
          React.createElement(MapView, { itinerary })
        )
      ),

      // Hotels (visible after itinerary exists)
      itinerary
        ? React.createElement(
            'section',
            { className: 'card glass' },
            React.createElement(HotelsPanel, {
              city: itinerary.city,
              tier: hotelTier,
            })
          )
        : null,

      // Extra recs (visible after itinerary exists)
      itinerary
        ? React.createElement(
            'section',
            { className: 'card glass' },
            React.createElement(Recommendations, {
              city: itinerary.city,
              vibes: itinerary.themes || '',
            })
          )
        : null
    ),

    // Toast error (non-blocking)
    error
      ? React.createElement(
          'div',
          { role: 'alert', className: 'toast danger' },
          error
        )
      : null,

    // Global loader overlay
    loading
      ? React.createElement(
          'div',
          { className: 'loader-backdrop', 'aria-live': 'polite' },
          React.createElement('div', { className: 'magic-orb' }),
          React.createElement(
            'div',
            { className: 'magic-rings' },
            React.createElement('span', null),
            React.createElement('span', null),
            React.createElement('span', null)
          ),
          React.createElement(
            'div',
            { className: 'loader-text' },
            'Weaving your itinerary…'
          )
        )
      : null
  );
}

export default App;
