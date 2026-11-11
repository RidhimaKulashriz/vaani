# Vaani-Dalal

Vaani-Dalal is a voice-agent prototype for handling everyday calls in India. The current app includes an original marketing site, a scripted interactive demo, a Fastify API, TypeScript protocol/audio/orchestration packages, SQLite local storage, and provider interfaces. **All telephony is mock-only. No feature in this repository places real phone calls.**

## Quick start

Requirements: Node.js 22.23.4+ (or a supported later release), pnpm 11, and `ps` on Linux. From this directory:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The web server proxies `/api/*` and WebSocket upgrades to the Fastify API. API health is available at `http://localhost:4001/health`; local data is written under `apps/api/data` unless `DATA_DIR` is set. The waitlist accepts an email only when the privacy consent checkbox is selected. The demo is scripted and never calls the telephone network.

Local defaults require no environment file; `.env.example` documents optional configuration for deployment and external service scaffolding.

### Local container stack

With Docker Engine and Compose installed, copy `.env.example` to `.env` and run `docker compose up --build`. The web app is at `http://localhost:3000`; Grafana is at `http://localhost:3001`; Prometheus is at `http://localhost:9090`; MinIO API/console are at `http://localhost:9000` and `http://localhost:9001`. These host ports bind to loopback. Change the example passwords before any non-local use. Grafana is provisioned with API request/latency, mock-session and state-transition panels. MinIO is only a local service scaffold; recording and object-storage APIs are not connected. Docker is not installed in the current build sandbox, so this Compose stack is not runtime-verified here.

Useful commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @vaani/web build`, and `pnpm verify`. For current environment-specific results, see [`docs/test-report.md`](docs/test-report.md).

## Architecture

- `apps/web`: Next.js App Router public pages `/`, `/demo`, `/app`, `/privacy`, and `/terms`; custom HTTP/WebSocket proxy server.
- `apps/api`: Fastify REST, authentication routes, session WebSockets, mock orchestration, metrics, rate limiting.
- `packages/protocol`: Zod client/server WebSocket schemas and call states.
- `packages/audio`: G.711 μ-law conversion, 20 ms frame helpers, sequence jitter buffer, and a monotonic 20 ms frame pacer with an interruptible flush. The pacer is a tested primitive; no live provider audio path is connected.
- `packages/adapters`: STT, planner, TTS, and telephony interfaces plus mock implementations.
- `packages/orchestrator`: scripted scenarios, state machine, and PII redaction.
- `packages/storage`: SQLite/PostgreSQL storage interface and schema initialization.
- `infra`: SQL migrations, Docker Compose services (Postgres, Redis, MinIO, Prometheus and Grafana), and monitoring provisioning; MinIO recording integration and voice-stage/Sentry metrics remain open.

See [`docs/architecture.md`](docs/architecture.md) and [`design-spec.md`](design-spec.md). The reference site was observed for broad visual rhythm only; its brand, copy, assets and licensed fonts are not reused.

## Configuration and real providers

`.env.example` contains placeholders only. The account flow is specifically wired to Manus app OAuth and requires `MANUS_PROJECT_ID`, `MANUS_OAUTH_PORTAL_URL`, `MANUS_OAUTH_API_URL`, and a strong `MANUS_JWT_SECRET`; none are configured here. It is not a generic Google/OIDC login. The private `/app` dashboard remains logged out until that account/project integration is configured and verified. Local mock mode needs no vendor keys. External speech and telephony integrations are not enabled: do not set `EXTERNAL_CALLS_ENABLED=true` or connect a real telephony provider from this prototype. No synthetic login or production auth bypass is included. For a future coordinated test environment, configure storage, authentication, provider credentials and explicit operator controls first.

Official provider research is recorded under [`docs/research/`](docs/research/). Gnani Prisma documents signed 16-bit little-endian PCM input, not raw G.711 μ-law, so an 8 kHz Twilio μ-law stream requires decode/transcode before Prisma. Timbre documents a raw 8 kHz μ-law output option, while Gnani has not published a hosted Evon API contract in the sources reviewed. Exotel AgentStream documents PCM16LE audio; provider formats and webhook/security rules are not interchangeable. No live adapter is enabled.

## Legal & compliance

TRAI’s 2025 TCCCPR amendment describes commercial-communication categories, sender registration, use of registered headers or designated number resources, and advance written notice to the originating access provider when an auto-dialer or robocall will be used, including its intended objective. It also specifies conditions and time limits for some forms of consent. Applicability to this product and its exact call purpose must be determined with the access provider and qualified Indian telecom counsel; this summary is not legal advice. [1]

TRAI’s February 2025 press release describes 140-series numbers for promotional calls and 1600-series numbers for transactional/service calls. The TRAI directions listing also names an August 2026 direction concerning 1601-series allocation/operation, but the operative text and account-specific eligibility were not verified here. Confirm current series, DLT registration, consent and provider onboarding requirements before any controlled test. [2] [3]

The official sources reviewed do not settle whether a particular AI call to a business, switchboard or named employee falls into a given category. They also do not settle AI-disclosure or recording-consent rules for this exact operating model. Do not infer permission from a provider API, caller-ID field, business context or this prototype. No live calls are enabled; any future test must use an operator-controlled or explicitly consenting number, an allowlist, and prior provider/legal review. The legal pages are prototype notices, not production terms or a compliance claim. See the [research note and its source list](docs/research/07-india-regulatory.md) for unresolved questions.

[1]: https://www.trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf "TRAI TCCCPR Second Amendment Regulations 2025"
[2]: https://www.trai.gov.in/sites/default/files/2025-02/PR_No.11of2025.pdf "TRAI press release on TCCCPR amendments"
[3]: https://www.trai.gov.in/release-publication/directions "TRAI directions listing"

## Safety boundaries and known limitations

The public WebSocket demo emits scripted events and simulated bridge tokens only. User endpoints require account authentication; there is no synthetic logged-in account. Sensitive task details are rejected/redacted, destination numbers are hashed only when a secret is configured, and recordings are not made. Do not enter real OTPs, passwords, payment details, or medical details into the prototype.

Both the public demo and authenticated `/app` mock-call panel include opt-in browser microphone capture. A shared AudioWorklet converts capture to 16 kHz mono PCM16 frames of 20 ms and a local RMS threshold gates which frames reach the respective mock WebSocket. The mock acknowledges receipt; it does not transcribe, store, or forward audio to a third party. This is not Silero VAD, has not been tested on physical microphones, and does not provide spoken task input. The app is not yet a production voice service: there are no live vendor adapters, real call bridge, verified account OAuth, TTS playback, MinIO recording integration, stage-level voice latency metrics, Sentry hooks, or measured Lighthouse/voice latency/WER results. Whisper echo behavior and warm-transfer reliability remain unmeasured risks. See the remaining items in `TODO.md`.
