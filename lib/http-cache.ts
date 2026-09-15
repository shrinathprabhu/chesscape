export const noStore = {
  'Cache-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
};

export function puzzleCacheHeaders(expiresAt: number, now = Date.now()) {
  const ttl = Math.min(
    86400,
    Math.max(0, Math.floor((expiresAt - now) / 1000)),
  );
  if (!Number.isFinite(ttl) || ttl === 0) return noStore;
  const cdn = `public, max-age=${ttl}, must-revalidate`;
  return {
    // CDN-specific headers intentionally permit only shared edge storage.
    'Cache-Control': 'no-store',
    'CDN-Cache-Control': cdn,
  };
}
