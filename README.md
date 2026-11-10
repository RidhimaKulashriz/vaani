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

Useful commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @vaani/web build`, and `pnpm verify`. For current environment-specific results, see [`docs/test-report.md`](docs/test-report.md).

## Architecture

- `apps/web`: Next.js App Router public pages `/`, `/demo`, `/app`, `/privacy`, and `/terms`; custom HTTP/WebSocket proxy server.
- `apps/api`: Fastify REST, authentication routes, session WebSockets, mock orchestration, metrics, rate limiting.
- `packages/protocol`: Zod client/server WebSocket schemas and call states.
- `packages/audio`: G.711 μ-law conversion, 20 ms frame helpers, sequence jitter buffer, and a monotonic 20 ms frame pacer with an interruptible flush. The pacer is a tested primitive; no live provider audio path is connected.
- `packages/adapters`: STT, planner, TTS, and telephony interfaces plus mock implementations.
- `packages/orchestrator`: scripted scenarios, state machine, and PII redaction.
- `packages/storage`: SQLite/PostgreSQL storage interface and schema initialization.
- `infra`: SQL migrations and deployment support.

See [`docs/architecture.md`](docs/architecture.md) and [`design-spec.md`](design-spec.md). The reference site was observed for broad visual rhythm only; its brand, copy, assets and licensed fonts are not reused.

## Configuration and real providers

`.env.example` contains placeholders only. Local mode needs no vendor keys. External provider adapters are intentionally not enabled as production integrations: do not set `EXTERNAL_CALLS_ENABLED=true` or connect a real telephony provider from this prototype. The private `/app` dashboard is wired to authenticated task, simulated-call, WebSocket control, and history APIs, but it remains logged out until supported account OAuth is configured; this environment has not verified that provider flow. No synthetic login or production auth bypass is included. For a future coordinated test environment, configure storage, authentication, provider credentials and explicit operator controls first.

Provider endpoints, telecom onboarding, Indian numbering/DLT requirements, privacy disclosures, consent, retention/deletion and local legal requirements must be reviewed for the actual operating model. This project makes no compliance claim and the legal pages are prototype notices, not legal advice or production terms.

## Safety boundaries and known limitations

The public WebSocket demo emits scripted events and simulated bridge tokens only. User endpoints require account authentication; there is no synthetic logged-in account. Sensitive task details are rejected/redacted, destination numbers are hashed only when a secret is configured, and recordings are not made. Do not enter real OTPs, passwords, payment details, or medical details into the prototype.

The demo includes an opt-in browser microphone experiment: an AudioWorklet converts capture to 16 kHz mono PCM16 frames of 20 ms and a local RMS threshold gates which frames reach the mock API. The mock only acknowledges receipt; it does not transcribe, store, or forward audio. This is not Silero VAD, has not been tested on physical microphones, and does not provide spoken task input. The app is not yet a production voice service: there are no live vendor adapters, real call bridge, verified account OAuth, TTS playback, MinIO recording path, complete Docker observability stack, or measured Lighthouse/latency/WER results. Whisper echo behavior and warm-transfer reliability remain unmeasured risks. See the remaining items in `TODO.md`.
