// Development environment. Replaced by environment.prod.ts during production builds (see angular.json fileReplacements).
export const environment = {
  production: false,
  // Relative path → routed through the dev proxy (proxy.conf.json) to the backend
  // on THIS machine at :8080. This keeps the frontend and backend same-ORIGIN, so
  // the HttpOnly refresh + readable csrfToken cookies work — including over plain
  // HTTP from another device (e.g. your phone) at http://<laptop-ip>:4200.
  // Requires the backend running on this machine at port 8080.
  apiBaseUrl: '/api',
};
