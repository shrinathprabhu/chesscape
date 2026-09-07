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

Solutions and reply maps remain in the active page's memory and are excluded from saved progress, browser HTTP caching, and service-worker caches. The public daily response can be cached by the CDN until midnight, and by each Worker instance. A loaded puzzle works offline in the same tab. Reopening the app or loading another puzzle requires a connection. The share card uses the local elapsed time.

The former start and submit endpoints have been removed. Existing database migrations and historical `attempts` records are retained for compatibility; the app no longer reads or writes player attempts or cookies. Local history begins with this release. The old `rate_limits` table now provides only a unique, expiring daily upstream-fetch lock.

## Daily puzzle selection

The server publishes one immutable puzzle under a unique UTC date. A database lock limits the Lichess daily check to once per date, with a 2.5-second timeout. A suitable Lichess puzzle is used when available; otherwise a verified original is published. Concurrent cold requests may publish the original while the upstream check is pending; all visitors then receive that same original. An already-published position is never replaced. Existing historical puzzle requests only read saved rows, so arbitrary date requests do not trigger upstream work.

A Lichess daily puzzle must have the `defensiveMove` theme, at least five legal moves, exactly one or two moves that avoid immediate checkmate, and its first solution move among those escapes. The PGN is replayed through `initialPly + 1` to include the opponent's setup move. Every rejected legal move permits an immediate mating reply. This verifies escape from mate on the next move, rather than a guarantee against a longer forced mate.

The launch fallback pack contains original compositions with file/color transforms and repeats after 16 days. It is attributed as “Chesscape original.” A larger collection can later be imported from the CC0 Lichess puzzle database and verified offline. Full puzzle-generation and search code stays out of the browser bundle; only the selected puzzle and its answers are sent.

## Hosting

The working Sites deployment uses a Cloudflare Worker with D1 (`DB`). Source migrations live in `drizzle/`; the Sites packager copies them to `dist/.openai/drizzle/`. `npm run verify:archive -- /path/to/release.tar.gz` checks that every migration and metadata file is included unchanged before publishing.

A Vercel or Netlify port needs only the daily GET route and durable daily puzzle storage. Keep the unique date and atomic publish behavior; process memory alone cannot keep all function instances on one puzzle. CDN caching and the daily upstream lock limit repeated work. Provider-level flood protection can cover requests to the public daily endpoint.

## Domain and PWA

The canonical is `https://lowkey.tools/chesscape`. The app runs at the origin root, suitable for `chesscape.lowkey.tools`. Domain/DNS ownership is configured separately. Serving the full app below `/chesscape` also requires a framework base path and corresponding API, asset, manifest, and service-worker path changes.

The manifest includes 192/512px PNG icons, standalone display, install handling, and iOS instructions. The service worker caches the shell and static assets. Share cards support native file sharing, PNG download, and text copying.

## Validation

Tests verify all 16 original transforms, every safe move and mating reply, synchronous offline play, illegal moves, exact-deadline timeout, retry timing, saved progress without solutions, puzzle pinning across dates, the post-solve cooldown, local statistics, and concurrent daily publication using real SQLite. The release check scans browser JavaScript for obsolete per-move endpoints and server puzzle-generation code. UI and install prompts still require device testing; no browser-driven visual test is claimed.
