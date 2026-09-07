import type { NextConfig } from 'next';
import { routeHeaders } from './config/http.mjs';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
if (basePath !== '' && basePath !== '/chesscape') {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or /chesscape.');
}
const config: NextConfig = {
  basePath,
  // Keep the manifest's scoped start URL reachable without leaving its PWA scope.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  async headers() {
    return routeHeaders(process.env.NODE_ENV === 'development');
  },
};
export default config;
