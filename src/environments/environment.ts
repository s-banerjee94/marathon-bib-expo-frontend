// Development environment. Replaced by environment.prod.ts during production builds (see angular.json fileReplacements).
export const environment = {
  production: false,
  // Relative path → routed through the dev proxy (proxy.conf.json) to the backend
  // on THIS machine at :8080. This keeps the frontend and backend same-ORIGIN, so
  // the HttpOnly refresh + readable csrfToken cookies work — including over plain
  // HTTP from another device (e.g. your phone) at http://<laptop-ip>:4200.
  // Requires the backend running on this machine at port 8080.
  apiBaseUrl: '/api',
  // The Python AI agent service. Unlike apiBaseUrl it uses Bearer-token auth (no
  // cookies), so it CAN be an absolute cross-origin URL — and we point straight
  // at it (not through the dev proxy) so its SSE stream reaches the browser
  // unbuffered. Testing from a phone on the LAN: use 'http://<laptop-ip>:8000'.
  aiBaseUrl: 'http://localhost:8000',
};
