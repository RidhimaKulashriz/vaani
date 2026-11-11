# Gnani Timbre streaming TTS

**Retrieved:** 2026-11-11. **Evidence scope:** Gnani’s official API documentation only.

## Verified interface

Gnani documents two streaming interfaces. SSE is `POST https://api.vachana.ai/api/v1/tts/sse` with `Content-Type: application/json` and `X-API-Key-ID: <api-key>`. Its JSON request example uses `text`, `voice`, `model`, `language`, `speed`, and `audio_config`. Models documented are `timbre-v2.5` and `timbre-v3.0`; selected model determines valid voices. [1]

For SSE, the server emits `start`, zero or more `chunk`, and a final `complete` event. Each audio chunk is base64 in JSON field `audio`, with `chunk_index` and `is_final`; the final event example has empty audio and `is_final: true`. Docs say to decode and append chunks in order. [1]

The WebSocket docs specify path `/api/v1/tts`; connect with configuration as upgrade headers (not changeable mid-session), then send a JSON synthesis message containing `text`, `voice`, `model`, and `audio_config`. The service returns base64 audio chunks as JSON messages and a final message with `is_final: true`. Send one synthesis request at a time. The documentation does not render the full connection URL or a complete header list in the extracted page, so no WebSocket host or exact header names beyond those explicitly shown elsewhere are asserted here. [2]

## Voices and languages

The docs describe Timbre v2.5 as 42 voices across 10 Indian languages, English, and Hinglish, each with a preferred language. Timbre v3.0 has 13 voices, each speaking all 10 Indian languages, and supports audio tags. Examples named in the TTS pages are Nalini, Kaveri, Deepak, and Poorvi for v2.5; Shivani, Avinash, and Lakshmi for v3.0. The language values listed are `auto`, `hi-IN`, `en-IN`, `ta-IN`, `te-IN`, `kn-IN`, `ml-IN`, `mr-IN`, `pa-IN`, `bn-IN`, `gu-IN`, and `hi-en` (Hinglish). The dedicated catalog links did not yield readable page content during retrieval; this note does not claim a complete list of voice names. [1] [2]

## Audio formats, µ-law, and limits

The audio configuration examples use `sample_rate`, `num_channels`, `sample_width`, `encoding`, and `container`. Documented sample rates are 8000, 16000, 22050, 24000, 44100, and 48000 Hz; channels may be 1 (mono) or 2; sample width is 2 for 16-bit audio. Listed encodings include `linear_pcm`, `pcm_s16le`, `pcm_mulaw`, `pcm_alaw`, and `oggopus`; containers include `wav`, `raw`, `mp3`, `ogg`, `mulaw`, and `alaw`. [1]

For G.711 µ-law specifically, the official format reference calls `container=mulaw` raw G.711 µ-law and says it forces 8000 Hz. It lists content type `audio/basic`; `container=raw` with `encoding=pcm_mulaw` is documented as equivalent to `container=mulaw`. The docs say µ-law/alaw override `sample_rate` to 8000 Hz. I do not infer any additional framing, packetization, or audio metadata not stated there. [1]

SSE documents a limit of only **one active request at a time**, returning 429 when another request is active. WebSocket docs advise one synthesis request at a time. No numeric audio chunk/frame duration, byte size, samples per chunk, maximum text length, or general payload-size limit was found in the reviewed TTS pages. Do not treat illustrative chunk indices as a frame-size specification. [1] [2]

## Authentication and setup

Gnani’s API introduction says to generate an API key from the Gnani API dashboard and send it on every request; missing or invalid keys return 401. The SSE/REST examples identify the header as `X-API-Key-ID`. The introduction recommends storing keys in environment variables or a secrets manager, not committing them to source control. [3]

## Safety and compliance

This is a technical documentation summary, not legal advice and not a claim of legal, regulatory, privacy, security, or telephony compliance. The cited docs describe API behavior and credential handling; they do not establish such compliance.

## References

[1]: https://docs.gnani.ai/api/TTS/tts-sse "Text-to-Speech Streaming via SSE"
[2]: https://docs.gnani.ai/api/TTS/tts-websocket "Text-to-Speech Realtime via WebSocket"
[3]: https://docs.gnani.ai/api/introduction/introduction "Gnani Speech APIs Introduction"
[4]: https://docs.gnani.ai/api/TTS/tts-inference "Text-to-Speech REST API"
