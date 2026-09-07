# Chesscape

A daily escape-the-mate PWA. One shared position, one committed legal move, 30 seconds, and a downloadable board-and-time reward. The frontend uses React 19, TypeScript, chess.js, and the existing Vinext/Vite Sites scaffold. A small API and SQLite/D1 storage enforce attempts and timing.

## Run locally

```sh
npm install
npx wrangler d1 execute DB --local --config wrangler.local.json --file .openai/drizzle/0000_spotty_junta.sql
npm run dev
```

```sh
npm test
npm run typecheck
npm run build
```

`npm run icons` regenerates the install icons from the attributed Cburnett knight. Artwork license and attribution are in `public/pieces/`.

## Daily puzzle

The server pins one puzzle under a unique UTC date. The first request claims the date atomically, checks `https://lichess.org/api/puzzle/daily` once (2.5-second timeout), and stores the result privately for that date. Other requests reuse the durable record; they never cause repeated upstream calls. If the upstream request fails or the puzzle is unsuitable, the already-validated original remains available. An upstream result cannot replace a puzzle after anyone starts it.

A Lichess daily puzzle must have the `defensiveMove` theme, at least five legal moves, exactly one or two moves that avoid immediate checkmate, and the first Lichess solution move among those escapes. The PGN is replayed through `initialPly + 1` to include the opponent's setup move. Every rejected legal move must permit an immediate mating reply. These checks enforce **escape from mate on the next move**; they do not prove the survivor is winning or free of a longer forced mate.

The fallback is a small launch pack of original compositions with file/color transforms. It is clearly attributed as “Chesscape original,” never misrepresented as a Lichess puzzle. This finite pack repeats after 16 days. Before a broad public launch, replace it with a larger private collection imported from the [CC0 Lichess puzzle database](https://database.lichess.org/#puzzles), filtered by defensive themes and verified with Stockfish MultiPV at a fixed depth. Keep that work offline or scheduled; never run Stockfish in a visitor-triggered function. The tagged database is a candidate source; themes alone do not prove an escape.

## The anti-inspect boundary

| Endpoint                   | Response                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/daily`           | Day, display number, escape count, source label, UTC reset, this browser's aggregate history, and its existing attempt if already started. A fresh visitor receives no FEN and no solution. |
| `POST /api/attempt/start`  | An opaque attempt ID, FEN, server timestamps, and state. Never a solution, PGN, original puzzle ID, or evaluation.                                                                          |
| `POST /api/attempt/submit` | The committed correct/incorrect/timeout result, server elapsed time, resulting board, and a mating reply only after a wrong move. Never the accepted move array.                            |

`server/chess.ts` and `server/service.ts` must remain server-only. The UI imports only the contracts, API client, and chess.js for legal-move highlighting. The build validation scans browser JavaScript for original position strings and server-only evaluation identifiers.

- Start time and deadline are generated on the server. Client-supplied times are not accepted. The deadline is checked against the server's receipt time, so network transit is part of the attempt.
- Attempts belong to an opaque `HttpOnly; SameSite=Strict; Secure` cookie (Secure on HTTPS). `(client, day)` is unique in SQLite, including concurrent starts.
- Submission uses an atomic `UPDATE … WHERE status='playing'`. Replays and competing requests see the single committed result.
- An illegal move can be corrected; one legal wrong move ends the attempt.
- Mutations enforce exact same-origin requests. Responses use `private, no-store`, and the service worker skips `/api/` entirely.
- Durable rate limits permit 15 new attempts per UTC day per network and 20 submissions per minute per identity. IP keys are date-scoped hashes and are removed after expiry. Shared networks share the start budget. Cloudflare supplies the trusted connecting-IP header; a Vercel or Netlify adapter must use that provider's trusted client-IP mechanism.
- History is durable and scoped to the browser cookie. No account or cross-device identity is implied.

A public position can be searched on Lichess or solved by an external engine. Anonymous cookies can be cleared; proxies can evade IP limits. This implementation prevents accidental answer disclosure, client clock spoofing, replay, and concurrent guesses within an attempt. It does **not** promise complete anti-cheat. Add provider-level rate limits/WAF, budget alerts and stronger identity before offering valuable rewards or a competitive leaderboard. The current reward is a personal share card.

## Hosting and Vercel / Netlify plan

The included working deployment uses the generated Sites Cloudflare Worker with D1 (`DB`). Migrations live in `.openai/drizzle/` and are packaged with the Site. There is no unconfigured production-memory fallback.

For Vercel or Netlify, keep the frontend and HTTP contracts, port the three small route wrappers, and implement the same prepared-statement storage calls against a durable SQL service available over HTTP (for example Turso/libSQL). Keep the schema uniqueness and conditional updates unchanged. Do not replace storage with process memory or a signed token alone: neither consumes a guess atomically across function instances. Keep database credentials server-side and use runtime secret configuration. A scheduled UTC job can warm `getDaily`; the unique day lock already prevents multiple upstream requests.

Configure provider-level flood protection in addition to the application rate limit. Only cache public daily metadata at the CDN if it is separated from cookie-scoped attempt/history data; the current combined endpoint intentionally is not CDN cached. The upstream puzzle is cached privately in D1.

## Domain and PWA

The configured canonical is `https://lowkey.tools/chesscape`. The app currently runs at the origin root, suitable for `chesscape.lowkey.tools`. Domain/DNS ownership is not configured automatically. Connect the subdomain to the chosen host. If the full app is also served below `/chesscape`, set the framework base path and adjust API, asset, manifest scope/start URL and service-worker paths together; a canonical link alone is not a reverse proxy.

The manifest has real 192/512px PNG icons, standalone display, install handling, and iOS instructions. The service worker caches only the app shell and static assets; online connectivity is required for timed attempts and verification. Share cards are rendered locally from the resulting board and server-returned time, with native file sharing, PNG download, and text-copy fallbacks.

## Validation

Unit/integration tests exercise all original puzzles and transforms, correct/incorrect/illegal moves, exact-deadline expiry, ownership, repeated/concurrent submissions, the once-per-day upstream cache, and durable rate limiting using real SQLite statements. Browser UI and install prompts require device testing; they have not been claimed as browser-tested. Optional WebMCP tools are feature-detected and use the same actions; no supported WebMCP validation context was available in this run.

The starter's React server runtime, Vinext, and Vite were updated to patched releases before publication. The remaining production-install audit findings are transitive `undici` and `esbuild` advisories in local CLI/dev-server tooling; neither library is present in the deployed Worker JavaScript. Development-only migration tooling has additional audit findings. Keep the toolchain updated and do not expose the development server publicly.
