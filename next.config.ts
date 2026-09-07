import type { NextConfig } from 'next';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
if (basePath !== '' && basePath !== '/chesscape') {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or /chesscape.');
}
const config: NextConfig = {
  basePath,
  // Keep the manifest's scoped start URL reachable without leaving its PWA scope.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nosnippet' }],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};
export default config;
