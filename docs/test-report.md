# Test report

Recorded during the resumed sandbox run on 2026-11-10. This is a development-container snapshot; it is not a production or telephony certification.

## Passed

- `pnpm lint` — pass (ESLint, zero warnings).
- `pnpm typecheck` — pass (strict TypeScript workspace configuration).
- `pnpm test` — pass, 2 files / 6 tests: μ-law/audio utilities and selected state-machine cases.
- `pnpm simulate:100` — pass, 100 deterministic replays of six scripted scenario state sequences; 466 accepted transitions; each run ended in `ENDED`; 0 calls placed. This harness validates only scripted state transitions, not external provider or full HTTP call flows.
- `pnpm --filter @vaani/web build` — pass; statically generated `/`, `/app`, `/demo`, `/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml`.
- `pnpm verify` — pass, including lint, typecheck, unit tests, deterministic simulator, and production build.
- Local HTTP smoke — `GET /health`, `/`, `/demo`, and `/manus-routes.json` returned 200; waitlist POST with valid email and `consent:true` returned 201.
- Local public WebSocket smoke — session ready/state and scripted IVR transcript arrived after `demo.start`; test confirmed mock mode and did not place a call.

## Not measured / not covered

No Lighthouse run, axe audit, Playwright browser suite, load test, production deployment test, live-provider test, latency distribution, speech-recognition WER, 100 live HTTP/WebSocket scenario sessions, telephony barge-in timing, consented recording, or warm-transfer reliability measurement was performed. Do not infer those results from the unit suite or deterministic state replay.
