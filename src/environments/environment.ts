// Development environment. Replaced by environment.prod.ts during production builds (see angular.json fileReplacements).
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
  // Alternate network backend — uncomment if connecting from a different machine:
  // apiBaseUrl: 'https://192.168.0.103:8080/api',
};
