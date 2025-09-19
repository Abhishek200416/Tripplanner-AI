import React from 'react';
import '../styles/TopActions.css';
import { encodePlan, setQueryParam } from '../lib/share.js';
import { clearState } from '../lib/storage.js';

export function TopActions({ itinerary, onReset, onShareUrl, onPrint }) {
  const canAct = !!itinerary;

  const doShare = async () => {
    if (!itinerary) return;
    const payload = encodePlan(itinerary);
    const url = new URL(window.location.href);
    url.searchParams.set('plan', payload);
    const shareUrl = url.toString();
    onShareUrl && onShareUrl(shareUrl);

    if (navigator.share) {
      try {
        await navigator.share({ title:'Trip plan', text:'Check my plan', url:shareUrl });
        return;
      } catch {}
    }
    // Fallback: copy
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied!');
    } catch { alert(shareUrl); }
  };

  const doPrint = () => onPrint && onPrint();

  const doReset = () => {
    setQueryParam('plan','');
    clearState();
    onReset && onReset();
  };

  return React.createElement('div', { className:'top-actions' },
    React.createElement('button', { className:'btn ghost', onClick: doShare, disabled: !canAct }, 'Share Link'),
    React.createElement('button', { className:'btn', onClick: doReset }, 'Reset')
  );
}
