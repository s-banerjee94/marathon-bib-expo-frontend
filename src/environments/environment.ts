// Development environment. Replaced by environment.prod.ts during production builds (see angular.json fileReplacements).
export const environment = {
  production: false,
  // localhost keeps the frontend (localhost:4200) and backend same-SITE so the
  // HttpOnly refresh + CSRF cookies are sent (port is ignored for SameSite).
  // Requires the backend to be running on THIS machine at port 8080.
  apiBaseUrl: 'http://localhost:8080/api',
  // Network backend (different machine). NOTE: cross-site from localhost over HTTP
  // means auth cookies will NOT be sent — use the dev proxy instead if you need this.
  // apiBaseUrl: 'http://192.168.0.101:8080/api',
};
