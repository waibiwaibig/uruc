// Core Auth — exports
export * from './interface.js';
export { AuthService } from './service.js';
export { registerAuthRoutes } from './auth-routes.js';
export { registerDashboardRoutes } from './dashboard-routes.js';
export { getRedirectUrl, exchangeCode, verifyState } from './oauth.js';
export { sendVerificationEmail } from './email.js';
