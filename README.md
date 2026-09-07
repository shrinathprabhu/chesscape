# Chesscape

A daily escape-the-mate PWA with instant, local play. Find one of the one or two safe moves within 30 seconds, retry the same position until solved, and share a board-and-time card. React 19, TypeScript, chess.js, and the existing Vinext/Vite Sites scaffold power the frontend. A small Worker and SQLite/D1 database publish the shared daily puzzle.

## Run locally

```sh
npm install
npx wrangler d1 execute DB --local --config wrangler.local.json --file drizzle/0000_spotty_junta.sql
npm run dev
```

```sh
npm test
npm run typecheck
npm run lint
npm run build
node scripts/check-client-boundary.mjs
```

`npm run icons` regenerates install icons from the attributed Cburnett knight. Artwork attribution and license are in `public/pieces/`.

## Local play and progress

`GET /api/daily` returns the date, display number, initial FEN, accepted UCI moves (`solutions`), a mating reply for every wrong legal move (`refutations`), attribution, escape count, and next UTC reset. These answers are deliberately included for immediate on-device validation. There is no competitive leaderboard or server-certified timing.

Once loaded, starting, moving, timing out, and retrying perform no network requests. The client uses chess.js for legality, looks up the accepted move, and applies a precomputed mating reply after a wrong move. Each retry starts at the same initial position with a fresh 30 seconds. An illegal move keeps the attempt active. A legal wrong move or an expired timer ends that try.

Progress and personal history are saved under `chesscape-progress-v2` in this browser's localStorage. An unfinished puzzle stays pinned across visits, even across midnight. Reloading fetches `GET /api/daily?day=YYYY-MM-DD` for that saved puzzle and restores the active deadline or result. After a solve, the next puzzle unlocks at the following midnight UTC, based on the completion date. Reloading or reopening the page does not reset that cooldown. Clearing site data or switching browsers starts fresh.

Solutions and reply maps remain in the active page's memory and are excluded from saved progress, browser HTTP caching (`Cache-Control: no-store`), and service-worker caches. The public daily response advertises a separate CDN TTL ending at midnight, and each Worker instance retains a bounded in-memory puzzle cache. A loaded puzzle works offline in the same tab. Reopening the app or loading another puzzle requires a connection. The share card uses the local elapsed time.

The former start and submit endpoints have been removed. Existing database migrations and historical `attempts` records are retained for compatibility; the app no longer reads or writes player attempts or cookies. Local history begins with this release. The old `rate_limits` table now provides only a unique, expiring daily upstream-fetch lock.

## Daily puzzle selection

The server publishes one immutable puzzle under a unique UTC date. A database lock limits the Lichess daily check to once per date, with a 2.5-second timeout. A suitable Lichess puzzle is used when available; otherwise a verified original is published. Concurrent cold requests may publish the original while the upstream check is pending; all visitors then receive that same original. An already-published position is never replaced. Existing historical puzzle requests only read saved rows, so arbitrary date requests do not trigger upstream work.

A Lichess daily puzzle must have the `defensiveMove` theme, at least five legal moves, exactly one or two moves that avoid immediate checkmate, and its first solution move among those escapes. The PGN is replayed through `initialPly + 1` to include the opponent's setup move. Every rejected legal move permits an immediate mating reply. This verifies escape from mate on the next move, rather than a guarantee against a longer forced mate.

The launch fallback pack contains original compositions with file/color transforms and repeats after 16 days. It is attributed as “Chesscape original.” A larger collection can later be imported from the CC0 Lichess puzzle database and verified offline. Full puzzle-generation and search code stays out of the browser bundle; only the selected puzzle and its answers are sent.

## Hosting

The working Sites deployment uses a Cloudflare Worker with D1 (`DB`). Source migrations live in `drizzle/`; the Sites packager copies them to `dist/.openai/drizzle/`. `npm run verify:archive -- /path/to/release.tar.gz` checks that every migration and metadata file is included unchanged before publishing.

A Vercel or Netlify port needs only the daily GET route and durable daily puzzle storage. Keep the unique date and atomic publish behavior; process memory alone cannot keep all function instances on one puzzle. CDN caching and the daily upstream lock limit repeated work. Provider-level flood protection can cover requests to the public daily endpoint.

## Security headers, caches and Vercel rules

`config/http.mjs` is the shared policy used by `next.config.ts`, the generated Cloudflare static `_headers`, and `vercel.json`. It sets CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict-origin referrers, same-origin opener isolation, and restricted camera/microphone/location/payment/USB permissions. Clipboard writing and native sharing remain available on the same origin. HTTPS responses include one-year HSTS without preloading or imposing a subdomain policy on the shared host. HSTS itself applies to the entire hostname, even when delivered at a subpath.

The production CSP limits resource and API origins to this site, permits local blob/data images for sharing, blocks plugins/frames/inline event attributes, and excludes `unsafe-eval`. The current streaming renderer needs inline hydration scripts and component styles, so these use `unsafe-inline`; this is a baseline CSP, not a strict nonce-based XSS policy. Only development allows eval and WebSocket connections for HMR. See [Vercel's CSP guidance](https://vercel.com/docs/cdn-security/security-headers).

| Resource | Cache policy |
| --- | --- |
| Content-hashed JS, CSS and Play fonts | One year, immutable |
| Game HTML | HTTP no-store; service-worker app shell retained explicitly for offline use |
| Piece images and install icons | One hour, then revalidate |
| Service worker | Revalidate every time; no CDN storage |
| Install manifest | Revalidate every time |
| Crawl guides and sitemap | One hour |
| Successful daily puzzle | Browser no-store; CDN-only TTL capped at next UTC midnight (one day for saved historical dates) |
| Invalid, missing or failed API responses | No storage in browser or CDN |

The daily response uses `CDN-Cache-Control` and `Vercel-CDN-Cache-Control` separately from browser `Cache-Control`, following [Vercel's header precedence](https://vercel.com/docs/caching/cache-control-headers). No stale-while-revalidate window is added to the daily puzzle. CDN providers must support the targeted headers to use that edge cache; the bounded Worker cache and durable daily publication remain the fallback. Duplicate/unknown query parameters and invalid or future dates fail before database access. The service worker ignores APIs, checks mutable assets against the network with an offline fallback, and uses cache-first only for hashed assets. Cache cleanup is restricted to its own mount.

`vercel.json` contains **host rules for the intended `/chesscape` mount**, including a host-conditional permanent redirect from `chesscape.lowkey.tools` to `https://lowkey.tools/chesscape`. Other lowkey.tools routes are outside these header rules. Regenerate with `npm run config:vercel` after changing the shared policy. Merge its headers and redirects into the lowkey.tools Vercel project when connecting the public app; preserve its other tools' settings and the `/chesscape/` PWA start URL. The schema and routing syntax follow [Vercel's configuration reference](https://vercel.com/docs/project-configuration/vercel-json).

These rules do not convert the current Worker/D1 build into a Vercel Function. There is intentionally no rewrite to the private Sites preview, no invented public origin, and no framework/build override for an unimplemented port. Supply the public Worker origin and route the mounted requests there, or port the daily route and its atomic storage before deploying natively to Vercel. Vercel firewall, rate limits and spend controls are account/project settings; they have not been enabled from this repository. The application already limits upstream puzzle fetching to once per UTC date, but that is not a network flood limit.

**Current Sites edge limitation (verified after publishing):** the game HTML and API return the configured security headers, and the daily API preserves its separate CDN TTL. The managed Sites static-asset edge ignores the packaged `_headers` security rules and serves CSS, icons and `sw.js` with `public, max-age=0, must-revalidate`. Both ordinary and cache-busted requests showed this behavior. The exact same artifact passes the strict asset-header/cache checks under local Wrangler at both `/` and `/chesscape`. The full static-asset policy therefore requires a host that honors `_headers`, or the supplied Vercel header rules on lowkey.tools. `npm run check:http` deliberately remains strict and reports this gap on the current Sites URL; it must pass against the eventual public host. No claim is made that all static security/cache headers are active on the private preview.

## Discoverability, mobile, and PWA

The canonical identity is `https://lowkey.tools/chesscape` across HTML metadata, Open Graph, Twitter, JSON-LD, sitemap, and machine-readable guides. The game is a client island with server-rendered rules, FAQs, and creator content, so this information does not require JavaScript execution. FAQ JSON-LD and Markdown are generated from the same answers as the visible FAQ. Person, Lowkey organization, website, game, and OwlEye product entities are linked explicitly. No ratings, reviews, awards, or usage claims are fabricated.

Discovery endpoints are `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/index.md`, with appropriate content types. Crawlers can access render assets, while game APIs are excluded from indexing and snippets. `llms.txt` is supplementary context, not a promise of AI citation or ranking. The page uses visible creator links in its introduction, FAQ, creator section, and footer, with normal followable links to `shrinath.me` and `owleye.dev`.

Mobile support includes touch-friendly controls, safe-area padding, flexible layouts, keyboard navigation and a skip link, reduced-motion support, scalable viewport settings, and portrait or landscape use. The install manifest has separate 192/512px regular icons, a full-bleed maskable icon, and a 180px Apple touch icon. Play is self-hosted with @fontsource/play, using only Latin regular (400) and bold (700) weights with font-display: swap. The interface and exported share cards use the same family. No tracking scripts or third-party font requests are added.

The 64-square board is memoized independently of the 100ms timer ticks. Chess check detection is reused while a position is unchanged, and the next-day clock runs only on the solved screen. Moves and retries remain entirely local; these changes do not add network round trips to play. Browser field metrics and Lighthouse scores have not been measured or claimed.

## Hosting at lowkey.tools/chesscape

The current Sites preview remains at its origin root. For the intended public subpath, build with:

```sh
NEXT_PUBLIC_BASE_PATH=/chesscape npm run build
```

This configures framework routes, client API requests, piece and share-image assets, metadata resource links, manifest identity/start URL/scope, and service-worker registration. The scoped `/chesscape/` start URL remains reachable without a redirect outside its PWA scope. Deploy that build with `/chesscape` and `/chesscape/*` routed to this app, including `/_next` assets under the prefix; do not merely set a canonical link or forward HTML alone. The logical D1 binding is still required. The build script mirrors public assets into the mount, alongside the framework’s prefixed chunks, and sets a non-stale service-worker response header. The origin-root build also works on `chesscape.lowkey.tools` and points to the same canonical.

On the shared lowkey.tools host, merge these rules into its **root** robots.txt without replacing rules for other tools:

```text
User-agent: *
Disallow: /chesscape/api/
Disallow: /chesscape/__
Sitemap: https://lowkey.tools/chesscape/sitemap.xml
```

Keep `/chesscape/_next/` and other static assets crawlable. Include the canonical page in lowkey.tools navigation and the app sitemap in the host sitemap index. Add `https://lowkey.tools/chesscape/llms.txt` to the host's root LLM guide. Once the canonical route returns public HTTP 200, submit its sitemap in the owner's Search Console/Bing Webmaster property. Verification tokens, indexing submissions, DNS changes, and cross-site edits are not invented or performed from this repository.

At the time of this update the canonical path returned 404, and the owner confirmed they will host it there. The Sites preview is owner-private. Search engines cannot index that gated preview; the public route must be connected before these signals can be discovered. No public-access change was made.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
node scripts/check-client-boundary.mjs
node scripts/generate-vercel-config.mjs --check
# Against a running production build (root or with NEXT_PUBLIC_BASE_PATH=/chesscape):
npm run check:http
# Against a running origin-root development server:
node scripts/check-discovery.mjs
# Against a development server started with the same mount configuration:
NEXT_PUBLIC_BASE_PATH=/chesscape node scripts/check-discovery.mjs
```

Tests cover chess correctness, local retries and deadlines, saved progress, daily publication, FAQ/schema consistency, canonical URLs, crawler rules, manifest scope and declared icon dimensions. The HTTP smoke check verifies server-rendered metadata and JSON-LD, native FAQ markup, creator links, discovery response types, mounted assets, and API index exclusion. Browser-driven visual, assistive-technology, install-prompt, and field-performance checks still require device testing.
