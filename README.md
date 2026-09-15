# Chesscape

A daily escape-the-mate PWA with instant, local play. Find one of the one or two safe moves within 30 seconds, retry the same position until solved, and share a board-and-time card. React 19, TypeScript, chess.js, and the existing Vinext/Vite Sites scaffold power the frontend. A stateless Cloudflare Worker serves the shared daily puzzle from a bundled collection. No database or upstream puzzle API is required.

## Run locally

```sh
npm install
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

Solutions and reply maps remain in the active page's memory and are excluded from saved progress, browser HTTP caching (`Cache-Control: no-store`), and service-worker caches. The public daily response advertises a separate CDN TTL ending at midnight, while the Worker reads its bundled puzzle collection. A loaded puzzle works offline in the same tab. Reopening the app or loading another puzzle requires a connection. The share card uses the local elapsed time.

## Daily puzzle selection

The UTC day number selects one of 16 precomputed original positions from `server/puzzles-v1.json`. Each has one or two safe moves and an immediate mating reply for every other legal move. Selection does not access a database, fetch Lichess, or run chess search. Everyone on the same date receives the same position across requests, Worker instances, and deployments.

The rotation repeats every 16 days. Keep v1's contents, order and length fixed; introduce future collections with an explicit date-based cutover to preserve historical mappings. Dates from September 1, 2026 through today can be retrieved, so an unfinished puzzle stays available after midnight. Existing browser progress is retained. Previously database-selected Lichess puzzles cannot be reconstructed from the date alone; the bundled mapping preserves the original fallback rotation.

`server/chess.ts` provides the independent chess checks used by tests, not request handling. Tests verify every bundled position, all accepted escapes, and every wrong move's mating reply. Only the selected position and its answers are sent to the browser.

## Cloudflare Workers

Deploy the server-rendered app, daily API and static assets together on Cloudflare Workers. The root `wrangler.jsonc` configures Node compatibility, static assets and the custom domain. The [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/) generates `dist/server/wrangler.json` with the compiled entry point and `dist/client` asset directory. Deploy that generated configuration, not the source entry point or client files alone.

Use these Workers Builds settings:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `npm run build:workers` |
| Deploy command | `npx wrangler deploy --config dist/server/wrangler.json` |
| Build environment | `NODE_VERSION=22.16.0` |
| Production branch | Your release branch (currently `main`) |
| Worker name | `chesscape` |
| Custom domain | `chesscape.lowkey.tools` |

Workers uses the generated asset directory; there is no Pages output-directory setting. The custom-domain route is in the production config and is applied when you deploy. No base path or proxy rewrite is needed.

No database creation, bindings, IDs, migrations, or puzzle API keys are needed. Run `npm run deploy:workers` from an authenticated terminal, or use the Workers Builds settings above.

For a separate preview Worker, run `npm run deploy:workers:preview`. It selects `CLOUDFLARE_ENV=preview` at build time and deploys `chesscape-preview` without the production custom domain. Use `npm run build:workers:preview` for a preview CI build.

For a local Workers runtime check:

```sh
npm run build:workers
npm run preview:workers -- --port 3001
# In another terminal:
npm run check:http
node scripts/check-discovery.mjs
```

Static assets use the asset service and generated `_headers`; dynamic HTML, API and discovery routes use the Worker and framework headers. Missing paths reach the application instead of a static SPA fallback. Canonical metadata remains `https://chesscape.lowkey.tools/`.

## Security headers and caching

`config/http.mjs` is the shared policy used by `next.config.ts` and the generated Cloudflare static `_headers`. It sets CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict-origin referrers, same-origin opener isolation, and restricted camera/microphone/location/payment/USB permissions. Clipboard writing and native sharing remain available on the same origin. HTTPS responses include one-year HSTS without preloading or imposing a subdomain policy on the shared host. HSTS itself applies to the entire hostname, even when delivered at a subpath.

The production CSP limits resource and API origins to this site, permits local blob/data images for sharing, blocks plugins/frames/inline event attributes, and excludes `unsafe-eval`. The current streaming renderer needs inline hydration scripts and component styles, so these use `unsafe-inline`; this is a baseline CSP, not a strict nonce-based XSS policy. Only development allows eval and WebSocket connections for HMR.

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

The daily response uses `CDN-Cache-Control` separately from browser `Cache-Control`. No stale-while-revalidate window is added to the daily puzzle. CDN providers must support the targeted headers to use that edge cache; the deterministic bundled selection remains available without edge caching. Duplicate/unknown query parameters and invalid or future dates fail before puzzle selection. The service worker ignores APIs, checks mutable assets against the network with an offline fallback, and uses cache-first only for hashed assets. Cache cleanup is restricted to Chesscape’s root cache.


The former private Sites preview was observed to ignore static `_headers` and force asset revalidation. Keep `npm run check:http` strict when checking the eventual public host; it verifies the actual served policy rather than only configuration files.

## Discoverability, mobile, and PWA

The canonical identity is `https://chesscape.lowkey.tools/` across HTML metadata, Open Graph, Twitter, JSON-LD, sitemap, and machine-readable guides. The game is a client island with server-rendered rules, FAQs, and creator content, so this information does not require JavaScript execution. FAQ JSON-LD and Markdown are generated from the same answers as the visible FAQ. Person, Lowkey organization, website, game, and OwlEye product entities are linked explicitly. No ratings, reviews, awards, or usage claims are fabricated.

Discovery endpoints are `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/index.md`, with appropriate content types. Crawlers can access render assets, while game APIs are excluded from indexing and snippets. `llms.txt` is supplementary context, not a promise of AI citation or ranking. The page uses visible creator links in its introduction, FAQ, creator section, and footer, with normal followable links to `shrinath.me` and `owleye.dev`.

Mobile support includes touch-friendly controls, safe-area padding, flexible layouts, keyboard navigation and a skip link, reduced-motion support, scalable viewport settings, and portrait or landscape use. The install manifest has separate 192/512px regular icons, a full-bleed maskable icon, and a 180px Apple touch icon. Play is self-hosted with @fontsource/play, using only Latin regular (400) and bold (700) weights with font-display: swap. The interface and exported share cards use the same family. No tracking scripts or third-party font requests are added.

The 64-square board is memoized independently of the 100ms timer ticks. Chess check detection is reused while a position is unchanged, and the next-day clock runs only on the solved screen. Moves and retries remain entirely local; these changes do not add network round trips to play. Browser field metrics and Lighthouse scores have not been measured or claimed.

## Hosting at chesscape.lowkey.tools

Run `npm run build` without a base-path environment variable. All routes, assets, API calls, manifest URLs, service-worker registration, metadata and share cards use the dedicated origin root. Remove any obsolete base-path environment setting from your hosting dashboard; the app no longer reads it. DNS/domain attachment is managed in your hosting provider; no DNS or public access changes are made by this repository.

The PWA starts at `/` and its service worker is `/sw.js` with `/` scope. The sitemap is `https://chesscape.lowkey.tools/sitemap.xml`; robots.txt and llms.txt are served from this same host. Once it is publicly reachable, submit this sitemap in the corresponding Search Console/Bing Webmaster property. Browser-local progress belongs to its origin and will not automatically move from the private preview to this new domain.

Credits link to Shrinath Prabhu’s portfolio and X profile, OwlEye Analytics, and lowkey.tools. The “Good moves, off the board” section recommends one sibling app: SuperBrain, for saving ideas, using its destination linked by the Lowkey directory.

The Open Graph and X large-image preview uses `https://chesscape.lowkey.tools/og.png`, a 1730 × 909 PNG in `public/og.png`. It is only fetched for social previews, not rendered as a gameplay image. Generation mode and the final prompt are recorded in `docs/og-image.md`.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
node scripts/check-client-boundary.mjs
# Against a running production build:
npm run check:http
# Against a running origin-root development server:
node scripts/check-discovery.mjs
```

Tests cover chess correctness, local retries and deadlines, saved progress, deterministic daily selection, FAQ/schema consistency, canonical URLs, crawler rules, manifest scope and declared icon dimensions. The HTTP smoke check verifies server-rendered metadata and JSON-LD, native FAQ markup, creator links, discovery response types, root-relative assets, and API index exclusion. Browser-driven visual, assistive-technology, install-prompt, and field-performance checks still require device testing.
