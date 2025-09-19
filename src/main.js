import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { registerSW } from './sw-register.js';
import { initPWAInstallListener } from './pwa-install.js';
initPWAInstallListener();

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));

registerSW();
