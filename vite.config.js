// vite.config.js
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ''); // loads all .env* into `env`
  const tunnelHost = (env.VITE_TUNNEL_HOST || '').trim();        // e.g. 4f21394f6c49.ngrok-free.app
  const allowWildcard = env.VITE_ALLOW_TUNNEL_WILDCARD === '1';   // optional

  // Build the allowed hosts list:
  // - localhost & 127.0.0.1 are allowed by default, but we keep them explicit
  // - tunnelHost (one host) OR .ngrok-free.app (all subdomains) if you want a wildcard
  const allowedHosts = ['localhost', '127.0.0.1'];
  if (allowWildcard) {
    allowedHosts.push('.ngrok-free.app'); // allows ANY *.ngrok-free.app
  } else if (tunnelHost) {
    allowedHosts.push(tunnelHost);        // allow only your specific subdomain
  }

  const useTunnel = Boolean(tunnelHost);

  return {
    server: {
      host: true,           // 0.0.0.0
      port: 5173,
      strictPort: true,
      allowedHosts,         // <— critical: whitelist your tunnel host
      // HMR settings:
      // Tell the browser to connect its websocket to the public tunnel over TLS.
      // IMPORTANT: we set only client-side connection details so Vite DOESN'T bind to :443 locally.
      hmr: useTunnel
        ? {
            protocol: 'wss',
            host: tunnelHost,    // browser will connect to wss://<tunnelHost>/
            clientPort: 443,     // use TLS port on the client side
            // don't set `port: 443` here — that would try to LISTEN locally and cause EADDRNOTAVAIL
          }
        : true,
    },
  };
});
