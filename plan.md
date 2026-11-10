# Vaani-Dalal — Implementation Plan

## Scope and operating constraints

Build the mock-first Vaani-Dalal product described in the supplied brief: an original marketing site, a scripted call demo, an app console, a REST/WebSocket backend, shared protocol and orchestration packages, telephony/audio adapter interfaces, local persistence, infrastructure, tests and operating documentation. The public site and demo must never originate a real call. Every provider adapter defaults to a deterministic mock; no API keys are required for local use. Real telephony remains unavailable until explicitly configured later for controlled, consenting test numbers with server-side allow/block lists and rate limits. Never handle or repeat OTPs, passwords or payment details; route KYC, consent and other sensitive steps to the user. Disclose AI identity to any callee through real adapters, never claim to be the user, do not speak over hold music, redact PII in logs/storage, and record only with explicit consent.

Use official vendor/regulator documentation for provider and India telecom notes; document unsupported or uncertain claims and make no legal-compliance claim. Do not invent customer stories, testimonials, usage claims or measured performance. Keep all secrets out of source control. Reference-site assets, text, name/branding and font files are not product assets; only general visual principles may inform the original design.

The requested repository is `RidhimaKulashriz/vaani`. Initial inspection found no remote refs or existing repository files. Use the repository's existing owner identity for new commit authorship, do not add a second author identity or attribution trailer, and push a clean source snapshot to the empty target without copying workspace bootstrap history. Leave the web project's own checkpoint remote separate. Use normal pushes only; if target history appears before delivery, inspect and integrate rather than force-push.

## Implementation approach

Use a pinned pnpm TypeScript workspace. `apps/web` is a Next.js App Router app with server-rendered public pages and accessible client components; a small custom Node server proxies `/api/*` HTTP and WebSocket traffic to `apps/api`. The Next listener uses configured port 3000; the Fastify API runs on 4000. `pnpm dev` starts both. Public routes are `/`, `/demo`, `/app`, `/privacy` and `/terms`; `/app` uses the platform-provided account OAuth flow, validates the signed session and never invents or silently substitutes a user.

`apps/api` provides Zod-validated REST and WebSocket endpoints, rate limits, waitlist deduplication, task/call history, health and metrics. Shared packages provide the typed protocol, deterministic call state machine and scenario runner, swappable STT/LLM/TTS/telephony interfaces with mocks, and pure audio-frame/μ-law/jitter/pacing helpers. Browser microphone use is explicit, local to the demo pipeline, transient and never recorded; typed controls remain available when permission or audio is unavailable. No external STT/TTS/planner request occurs in mock mode.

Use SQLite for zero-setup development and PostgreSQL in optional local Docker Compose; keep schema/migrations committed. Redis is an optional Compose service for reconstructible live state, rate-limit storage and pub/sub, not a separately enabled managed service. MinIO is present only for consented recordings in an explicitly configured future path; mock mode stores none. Add Prometheus/Grafana examples and optional error-reporting hooks. Publish/release is not part of this request; the requested delivery is a runnable project and a normal push to the named repository.

## Design direction

- **Design Movement:** warm editorial service design with neo-brutalist structure and measured signal-inspired motion.
- **Core Principles:** direct and human; visible control; state changes are legible; useful without sound or motion.
- **Color Philosophy:** a soft parchment field and deep ink make the product feel calm; a distinctive signal-vermilion marks active voice moments; muted sage differentiates safe/complete states without making color the only cue.
- **Layout Paradigm:** long-form, left-aligned editorial scroll with numbered section rails, staggered proof points, asymmetric product scenes and a tactile call timeline; avoid centered card grids as the primary structure.
- **Signature Elements:** a concentric voice-orbit mark; numbered call steps; line-drawn waveform/bridge paths that visualize who can hear whom.
- **Interaction Philosophy:** controls expose state and retain human override; touch, keyboard and reduced-motion paths have equivalent outcomes; no interaction implies a real call in the public demo.
- **Animation:** short split-line entrances, restrained counter reveals, SVG path drawing, scrubbed state scenes and a gentle waveform; no layout-shifting loader; `prefers-reduced-motion` disables pinning/parallax and leaves clear static states; avoid continuous heavy work and preserve 60 fps as a target, not a claim.
- **Typography System:** Georgia/Times-style editorial serif for large headlines, platform system sans for UI/body, and system monospace for labels/timing; use system fonts only and do not bundle reference font files. Keep body copy compact and headings oversized with responsive `clamp()` scaling.
- **Brand Essence:** a transparent voice agent for everyday calls on behalf of people who want to stay in control; candid, capable, considerate.
- **Brand Voice:** concise and human, never pretending a mock is live. Example lines: “Routine calls, handled with you in control.” “The demo is simulated. The decisions stay yours.”
- **Wordmark & Logo:** original Vaani-Dalal wordmark with a compact concentric voice-orbit glyph and a small interruption notch; no third-party marks.
- **Signature Brand Color:** signal vermilion `#D9583B`.

### Reference observations (measured)

REA inspected the public page at `https://emmaus-agir-31.fr/` on 2026-11-10. Computed tokens include paper `#f1ece1`, secondary paper `#e7e1d3`, ink `#1b1b1b`, muted text `#5f5d57`, blue `#33669b`, green `#43744e`, yellow `#ebc017` and line `rgba(27,27,27,0.18)`. The observed page loads Bricolage Grotesque and Instrument Serif; these are documented only and will not be bundled or used in the product. Desktop body is 18px/27px; mobile body is 16px/24px. Hero headline measurements are 164.8px/138.432px, weight 740, letter spacing -6.592px at 1440px, and 60.45px/50.778px, weight 740, letter spacing -2.418px at 390px; the measured heading occupies about 3 and 9 lines respectively.

The reference uses a fixed 88px desktop/56px mobile header, 57.6px/20px horizontal header padding, and a long five-section scroll narrative. At the measured viewports its first three sections are approximately 1,890/1,604px, 5,040/4,051px and 13,500/10,972px tall (desktop/mobile). CSS keyframes include `spin`, `hero-bob`, `grain`, `pulse-dot` and `pin-pulse`. First-party bundles statically mention React, Next.js, GSAP, ScrollTrigger and Splitting; the exact runtime import status of every fingerprint is not established, and Lenis is not confirmed. Screenshots and complete measured values live in `docs/reference/`; they are documentation, never product assets.

The Vaani-Dalal palette is intentionally distinct: parchment `#F5EFE4`, ink `#1E2621`, signal vermilion `#D9583B`, muted sage `#D5DED2`, soft text `#73756B` and fine border `rgba(30,38,33,.16)`. Layout borrows only the broad editorial rhythm, not the source structure or branded details.

## Project structure

- `apps/web/`: Next.js routes, metadata, public sections, EN/Hindi copy, accessible UI, demo and app console; custom dev/production HTTP+WebSocket proxy.
- `apps/api/`: Fastify REST/WebSocket routes, account OAuth/session validation, waitlist/task/call handlers, demo runner, rate limits, health and metrics.
- `packages/protocol/`: shared event names, Zod schemas, audio/event payload types and WebSocket contracts.
- `packages/orchestrator/`: ten-state reducer, allowed transitions, planner generation/cancellation, mock tools, IVR/hold/whisper/patch flows, summary and redaction.
- `packages/adapters/`: mock STT/LLM/TTS/telephony plus documented, disabled provider integration boundaries.
- `packages/audio/`: G.711 μ-law helpers, 20ms frame utilities, sequence/jitter ordering, monotonic pacing, VAD interface and playback flush behavior.
- `packages/storage/`: SQLite/PostgreSQL data-store interfaces, migrations and redacted durable records.
- `infra/`: Compose services, PostgreSQL/Redis/MinIO setup, Prometheus and Grafana examples, CI configuration, and placeholder environment template.
- `docs/`: architecture/protocol/state diagrams, reference screenshots, measured test report, provider/regulatory source notes and controlled-number-only test plan.
- Root files: pinned workspace/package-manager settings, `README.md`, `design-spec.md`, `TODO.md`, `.env.example`, `Dockerfile` and Compose entry point.

## Delivery sequence

1. Verify the official REA CLI and browser tools; keep setup task-scoped and make no unreviewed account-wide changes.
2. Record computed reference design findings and screenshots, clearly separating observed facts from unverified details.
3. Implement typed protocol, state machine, mocks, audio helpers, storage and tests.
4. Build the responsive public site, interactive product journey, scripted demo and app console with safety/motion/accessibility behavior.
5. Add local infrastructure, documentation, observability and CI; keep external telephony off.
6. Run available type/lint/unit/simulation/build/browser/accessibility checks and record actual results only.
7. Commit coherent phases under the repository's configured owner identity and push the completed source tree to the specified repository with a normal push. Keep the checkpoint remote separate and do not expose secrets.
