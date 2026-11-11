# Gnani Prisma streaming STT

**Retrieved:** 2026-11-11. This note is limited to Gnani’s official API documentation.

## Verified integration surface

The documented realtime endpoint is `wss://api.vachana.ai/stt/v3/stream`. Configuration is supplied as WebSocket upgrade headers. Required headers are `x-api-key-id` (Gnani API key) and `language_code` (language code); `model` is optional and accepts `prisma-v2.5` or `prisma-v3.0`, with v2.5 the default. The documented sample-rate header is `x-sample-rate`, default `16000`, with accepted values `8000`, `16000`, `44100`, and `48000`; it must match the source audio. [1]

Audio on the websocket is raw mono signed 16-bit little-endian PCM, not a file/container format. At 8 kHz the documented frame is 512 samples / 1,024 bytes / 64 ms; at 16 kHz it is 512 samples / 1,024 bytes / 32 ms. Send frames at real-time cadence, not in bursts. Gnani’s page says it internally resamples 44.1/48 kHz sources. [1]

**8 kHz G.711 μ-law comparison:** 8 kHz itself is explicitly supported for narrowband telephony, and the official Python SDK example sets `sample_rate=8000`. However, μ-law is not one of the documented websocket encodings: the stream format is specified as signed 16-bit little-endian PCM. Thus the docs do not establish that G.711 μ-law bytes can be sent directly. To conform to the documented wire format, μ-law telephony audio would need to be decoded/transcoded to mono signed 16-bit little-endian PCM at 8 kHz before framing; Gnani does not document a μ-law input mode here. [1]

## Authentication, lifecycle, and limits

Authenticate with `x-api-key-id` in the websocket handshake. Browser WebSocket cannot set custom headers; Gnani says to proxy through a backend that attaches them. The handshake is refused with HTTP 401 and no websocket opens for a missing or invalid key. [1] [2]

The documented sequence is connect, receive `connected`, send binary PCM frames, receive `processing` when VAD closes a speech segment and starts transcription, then receive a JSON `transcript` for the completed segment; either party may close. Server messages use JSON text frames and carry `type` and an ISO-8601 timestamp. The page also documents a `speech_start` message, client `commit` control frame to close an open utterance, and `update_settings` for supported settings. VAD configuration is fixed at connection time. [1]

A session is capped at 15 minutes. Default idle timeout is 60 seconds without a speech segment; `x-idle-timeout-sec` accepts 5–900 seconds (out-of-range values are clamped). Concurrent streams have a per-organisation cap, but the numeric value is not published on these docs pages. [1] [3]

The realtime language table lists Bengali `bn-IN`, English `en-IN`, Gujarati `gu-IN`, Hindi `hi-IN`, Kannada `kn-IN`, Malayalam `ml-IN`, Marathi `mr-IN`, Punjabi `pa-IN`, Tamil `ta-IN`, and Telugu `te-IN`; Prisma v3.0 additionally accepts `indic-auto` for language identification. Prisma v2.5 accepts one language or `indic-auto`; v3.0 accepts `indic-auto` or a comma-separated list of 1–4 languages. [1] [4]

## Documented errors and limits

The websocket sends `error` messages with a human-readable `message`; an error can be recoverable and leave the connection open. The docs specifically say: a single-utterance failure leaves the session open; missing/invalid `language_code` or bad `format` returns an error then closes with websocket code 1008; invalid substitution map closes with code 1008 and reason `Invalid x-substitution-map` without an error message; session beyond 15 minutes returns an error then closes with code 1001; concurrency-cap rejection includes the limit in an error message. Missing/invalid API key is HTTP 401 before websocket opens. Too many requests return HTTP 429 with `error_code: RATE_LIMITED`; docs recommend waiting/retrying with backoff. [1] [2] [3]

The error reference’s sample STT server error is `{"type":"error","timestamp":"…","message":"STT engine failed to initialize"}`. The reference does not enumerate a complete streaming error-code catalogue. [1] [2]

## References

[1]: https://docs.gnani.ai/api/STT/stt-websocket "Realtime streaming"
[2]: https://docs.gnani.ai/api/introduction/errors "Error Reference"
[3]: https://docs.gnani.ai/api/STT/limits "Speech-to-Text limits"
[4]: https://docs.gnani.ai/api/STT/languages "Supported languages"
