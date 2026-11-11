# Test report

Recorded during the resumed sandbox run on 2026-11-11. This is a development-container snapshot; it is not production, real-audio, or telephony certification.

## Passed

- `pnpm lint` — pass with zero warnings.
- `pnpm typecheck` — pass for the strict TypeScript workspace.
- `pnpm test:unit` — pass, 4 files / 13 tests: μ-law/frame helpers, sequence jitter buffering, monotonic frame pacing and flush behavior, and selected call-state transitions.
- `pnpm simulate:100` — pass, 100 deterministic replays across six scripted call-state scenarios; 466 accepted transitions. This harness validates scripted state sequences only, not full HTTP calls or external providers.
- `pnpm build` — pass; the production build statically generated `/`, `/app`, `/demo`, `/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml`.
- `pnpm test:e2e` — pass, 10 Playwright browser tests covering language toggle, journey controls, consented waitlist submission, routine-task review and explicit confirmation, demo WebSocket/Whisper/patch-in/end, OTP-safe handoff, sensitive-task blocking in both UI and server, fake-microphone PCM frame transfer on demo and private mock call, private-app OAuth gate, a fully stubbed private-dashboard task/call UI contract, and mobile-width overflow.
- Playwright axe audit — pass on the home, public demo, and logged-out `/app` routes with no critical or serious violations.
- Local HTTP smoke — `GET /health`, `/`, `/demo`, and `/manus-routes.json` returned 200; waitlist POST with valid email and `consent:true` returned 201.
- Local public WebSocket smoke — session-ready/state and scripted IVR transcript arrived after `demo.start`; this was mock mode and placed no call.

The public demo now requires a routine task to be reviewed and explicitly confirmed before the scripted scenario starts. The bounded, redacted task remains only in the in-memory mock session; personal, medical, verification, and payment-sensitive entries are rejected by both the UI and the server. Browser tests exercised the normal confirmation and a forged sensitive `demo.start` event. This does not enable arbitrary call execution or real telephony.

The audio pacer tests use an injected monotonic clock to verify 20 ms target deadlines and a simulated callback delay. They do not measure operating-system scheduling accuracy or real audio latency. `AudioFramePacer` is a reusable package primitive; a production/live carrier audio path is not connected.

The browser mic tests use Chromium's synthetic input device. They confirm opt-in capture, 20 ms/640-byte PCM16 frame transport, explicit no-transcription acknowledgement, and stop/cleanup copy in public-demo and authenticated-mock contexts. The RMS threshold is a lightweight gate, not Silero VAD; frames are neither transcribed nor stored. The authenticated-app test stubs account, REST and WebSocket responses and does not verify backend authentication.

The private app dashboard is wired to `/api/auth/me`, `/api/auth/start`, authenticated task/call REST routes, and `/api/session`, including call history/detail. The current account flow is Manus-project-specific. The automated test covers the logged-out state and OAuth-unavailable response with stubbed HTTP only. Its required environment variables are unset, so the authenticated UI journey and signed-in API/WebSocket end-to-end path remain unverified.

The private-dashboard UI contract test stubs identity, REST and WebSocket traffic entirely in Playwright; it verifies task review/confirmation, elapsed-time display, microphone frame acknowledgement, state chips, private whisper acknowledgement, mock patch-in and ending. It does not create an account or validate backend authorization/provider credentials.

## Not measured or not covered

Compose and provisioning YAML plus the Grafana dashboard JSON pass static parsing. Docker Engine/Compose is absent from this environment, so services, health checks, and the Grafana datasource/dashboard were not runtime-tested. No Lighthouse score, load test, production deployment, live STT/TTS/telephony integration, real call, physical-device microphone capture, speech-recognition WER, voice-stage latency distribution, live barge-in timing, consented recording, or warm-transfer reliability measurement was performed. The 100 deterministic simulator runs are not 100 full end-to-end call sessions. Treat performance targets as unmeasured, not achieved.

`docs/research/` contains official-source summaries for Gnani speech APIs, Twilio, Exotel, Plivo, and India telecom materials. They document technical surfaces and unresolved items, but do not establish account entitlements, provider contract terms, legal compliance, a permitted use case, or live credentials.
