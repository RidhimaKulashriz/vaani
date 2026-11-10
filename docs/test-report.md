# Test report

Recorded during the resumed sandbox run on 2026-11-10. This is a development-container snapshot; it is not production, real-audio, or telephony certification.

## Passed

- `pnpm lint` — pass with zero warnings.
- `pnpm typecheck` — pass for the strict TypeScript workspace.
- `pnpm test:unit` — pass, 4 files / 13 tests: μ-law/frame helpers, sequence jitter buffering, monotonic frame pacing and flush behavior, and selected call-state transitions.
- `pnpm simulate:100` — pass, 100 deterministic replays across six scripted call-state scenarios; 466 accepted transitions. This harness validates scripted state sequences only, not full HTTP calls or external providers.
- `pnpm build` — pass; the production build statically generated `/`, `/app`, `/demo`, `/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml`.
- `pnpm test:e2e` — pass, 7 Playwright browser tests covering language toggle, journey controls, consented waitlist submission, routine-task review and explicit confirmation, demo WebSocket/Whisper/patch-in/end, OTP-safe handoff, sensitive-task blocking in both UI and server, and mobile-width overflow.
- Playwright axe audit — pass on the home and demo routes with no critical or serious violations.
- Local HTTP smoke — `GET /health`, `/`, `/demo`, and `/manus-routes.json` returned 200; waitlist POST with valid email and `consent:true` returned 201.
- Local public WebSocket smoke — session-ready/state and scripted IVR transcript arrived after `demo.start`; this was mock mode and placed no call.

The public demo now requires a routine task to be reviewed and explicitly confirmed before the scripted scenario starts. The bounded, redacted task remains only in the in-memory mock session; personal, medical, verification, and payment-sensitive entries are rejected by both the UI and the server. Browser tests exercised the normal confirmation and a forged sensitive `demo.start` event. This does not enable arbitrary call execution or real telephony.

The audio pacer tests use an injected monotonic clock to verify 20 ms target deadlines and a simulated callback delay. They do not measure operating-system scheduling accuracy or real audio latency. `AudioFramePacer` is a reusable package primitive; a production/live carrier audio path is not connected.

## Not measured or not covered

No Lighthouse score, load test, production deployment, live STT/TTS/telephony integration, real call, physical-device microphone capture, speech-recognition WER, latency distribution, live barge-in timing, consented recording, or warm-transfer reliability measurement was performed. Docker Compose was not runtime-tested. The 100 deterministic simulator runs are not 100 full end-to-end call sessions. Treat performance targets as unmeasured, not achieved.
