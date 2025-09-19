import React from 'react';
import '../styles/Header.css';
import { onInstallAvailabilityChange, triggerInstall } from '../pwa-install.js';

export function Header(props) {
  const [canInstall, setCanInstall] = React.useState(false);

  React.useEffect(() => {
    const off = onInstallAvailabilityChange(setCanInstall);
    return off;
  }, []);

  const doInstall = async () => {
    const res = await triggerInstall();
    if (res.outcome === 'accepted') {
      // console.log('User accepted A2HS');
    } else if (res.outcome === 'dismissed') {
      // console.log('User dismissed A2HS');
    } else {
      alert('Install not available yet. Visit the site for a bit, then try again.');
    }
  };

  return React.createElement('header', { className: 'header container1' },
    React.createElement('div', { className: 'brand' },
      React.createElement('span', { className: 'logo-dot' }),
      React.createElement('span', { className: 'brand-name' }, props.title || 'TripPlanner')
    ),
    React.createElement('nav', { className: 'actions', 'aria-label': 'App actions' },
      React.createElement('button', {
        className: 'btn ghost',
        title: 'Toggle theme',
        onClick: props.onToggleTheme
      }, '🌓'),
      canInstall
        ? React.createElement('button', { className: 'btn fill', onClick: doInstall }, 'Install')
        : null
    )
  );
}
