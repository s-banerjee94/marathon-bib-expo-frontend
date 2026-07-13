// Production environment. Replaces environment.ts during production builds (see angular.json fileReplacements).
export const environment = {
  production: true,
  // SPA is hosted on Amplify at app.connectwithsandeepan.in; the API is at
  // api.connectwithsandeepan.in. Different ORIGIN but SAME SITE (both under
  // connectwithsandeepan.in), so the SameSite=Lax refresh + csrfToken cookies are
  // sent/readable (backend sets JWT_COOKIE_DOMAIN=.connectwithsandeepan.in). The
  // authInterceptor already adds withCredentials + the CSRF header; the backend
  // pins CORS to this exact origin. Must stay same-site — the raw *.amplifyapp.com
  // URL is cross-site and would break the cookie auth.
  apiBaseUrl: 'https://api.connectwithsandeepan.in/api',
  // Python AI agent service, mounted under /ai on the same host. Bearer auth, no
  // cookies → cross-origin is fine (needs CORS on the FastAPI side once it's up).
  aiBaseUrl: 'https://api.connectwithsandeepan.in/ai',
};
