import type { NextConfig } from 'next';
import { routeHeaders } from './config/http.mjs';
const config: NextConfig = {
  // Vinext otherwise strips the root slash from canonical and Open Graph URLs.
  trailingSlash: true,
  // Keep the manifest's scoped start URL reachable without leaving its PWA scope.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  async headers() {
    return routeHeaders(process.env.NODE_ENV === 'development');
  },
};
export default config;
