# Architecture

## Runtime topology

```text
Browser (Next.js :3000)
   ├─ REST /api/* ── custom proxy ── Fastify (:4001)
   ├─ WS /api/demo-call ───────── Fastify / scripted mock session
   └─ WS /api/session ─────────── Fastify / authenticated mock session
                                     ├─ Zod protocol validation
                                     ├─ mock planner + mock telephony adapters
                                     ├─ SessionHub / in-memory live session
                                     ├─ RuntimeStore (memory; optional Redis)
                                     ├─ SQLite by default; PostgreSQL supported
Local Compose: PostgreSQL · Redis · MinIO scaffold · Prometheus · Grafana
```

A public session is created only for a scripted demo. A session subscriber receives `session.ready`, initial state, transcripts, state transitions and summary events. Public calls do not persist transcript text or connect to a carrier. Private session endpoints verify the application session and call ownership; the `/app` dashboard is wired to those routes but remains logged out here because account OAuth has not been configured and verified.

## Protocol

WebSocket client payloads are parsed with `ClientEventSchema`; server events are typed by the shared protocol package. Task creation and confirmation use the REST API. Socket event families include whisper text/audio, patch-in, end, demo start/advance, transcript, state, agent speech, mock patch readiness, summary, errors and ping/pong. Do not treat demo join tokens as telephony credentials.

## State machine

Call state names: `INITIATED`, `IVR_NAVIGATING`, `ON_HOLD`, `CALLEE_SPEAKING`, `AGENT_SPEAKING`, `USER_WHISPERING`, `PATCHING_IN`, `PATCHED_IN`, `ENDING`, and `ENDED`. Transitions are constrained in `packages/orchestrator/src/state-machine.ts`; invalid transitions throw. The test suite currently verifies selected transitions and μ-law/audio helpers, not exhaustive call behavior.

## Persistence and privacy

SQLite is the zero-configuration store; PostgreSQL is selected by a PostgreSQL `APP_DATABASE_URL`. Runtime rate limits and transient state fall back to process memory if Redis is absent. Waitlist email is accepted with explicit consent and deduplicated by storage. Sensitive objective text is rejected or redacted; destination numbers are hashed with `PII_HASH_SECRET` when enabled. No audio recording feature is enabled.

## Real-provider boundary

Adapter interfaces make future provider work swappable. The implementations available here are mocks. A live STT, planning, TTS or telephony provider requires separate implementation, current vendor-document verification, explicit configuration, credentials, operator-controlled test numbers, and safety/legal review. Real calling is out of scope and disabled.

## Local monitoring and storage boundary

The local Compose configuration provisions Prometheus against the API's current request/transition/session metrics and Grafana dashboard files. These are not callee-silence→VAD, STT, planner, TTS or playback stage-latency series; no Sentry SDK is wired. MinIO is a local service scaffold, not the active transcript/audio store; recording remains disabled and no consented-recording pipeline is integrated. Compose and provisioning files have static syntax checks, but Docker Engine/Compose were unavailable for runtime validation in this environment.
