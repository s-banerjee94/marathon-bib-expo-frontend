// Production environment. Replaces environment.ts during production builds (see angular.json fileReplacements).
export const environment = {
  production: true,
  // Relative path → served same-ORIGIN as the backend. On the EC2 box, nginx serves
  // this built app and proxies /api (and /s) to the Spring Boot backend on
  // localhost:8080. Same-origin means no CORS, no cross-site cookies, and the
  // HttpOnly refresh + readable csrfToken cookies work — even over plain HTTP.
  apiBaseUrl: '/api',
  // AI agent service at the host root in prod — nginx proxies /chat* to the Python
  // service (with response buffering OFF so SSE streams). Bearer auth, no cookies.
  aiBaseUrl: '',
};
