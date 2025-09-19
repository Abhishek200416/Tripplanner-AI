// src/components/CategoryChips.js
import React from 'react';
import '../styles/CategoryChips.css';

const PRESETS = [
  { id:'heritage',  label:'Heritage 🏛️' },
  { id:'nightlife', label:'Nightlife 🌃' },
  { id:'food',      label:'Foodie 🍽️' },
  { id:'nature',    label:'Nature 🌿' },
  { id:'shopping',  label:'Shopping 🛍️' },
  { id:'adventure', label:'Adventure 🧗' },
  { id:'hidden',    label:'Hidden Gems 🔎' }
];

export function CategoryChips({ value, onChange }) {
  const set = new Set((value || '').split(',').map(s => s.trim()).filter(Boolean));
  const toggle = (id) => {
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange?.(Array.from(set).join(', '));
  };
  return React.createElement(
    'div', { className:'chips', role:'group', 'aria-label':'Travel categories' },
    ...PRESETS.map(p =>
      React.createElement('button', {
        key:p.id, type:'button',
        className:`chip${set.has(p.id) ? ' active' : ''}`,
        onClick:() => toggle(p.id),
        'aria-pressed': set.has(p.id) ? 'true' : 'false',
        title:`Toggle ${p.label}`
      }, p.label)
    )
  );
}
