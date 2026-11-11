# Plivo Voice streaming and conferencing

**Retrieved:** 2026-11-11. Official Plivo documentation only. Claims below are limited to facts visible in the opened documentation pages; omitted or unavailable API details are not inferred.

## Outbound calls and call flow

The Call API creates an outbound PSTN or SIP call. The Create a Call documentation requires `from`, `to`, and `answer_url`; `from` is in E.164 form, `to` accepts number(s) or SIP URI(s), and Plivo requests XML from `answer_url` once answered. `answer_url` defaults to POST; ring, hangup, and fallback URLs and their HTTP methods are also documented. Bulk destinations can be separated by `<`, up to 1,000 destinations. The opened page does not expose the precise create-call REST path or HTTP method in its extracted content, so neither is specified here. [1]

Plivo XML `<Dial>` connects the current call to a number, SIP endpoint, or Plivo user; the parties are connected when answered. `<Redirect>` transfers call execution to another URL, from which Plivo fetches new XML. Separately, the Call API “Transfer a Call” action transfers an in-progress call to XML at per-leg URL(s); `legs` is `aleg`, `bleg`, or `both`, with `aleg_url` and/or `bleg_url` as applicable. The endpoint and HTTP method for the transfer action were not visible in the opened extract. [2] [3]

## Streaming, codecs, events, and DTMF

The `<Stream>` element opens a WebSocket stream for active-call audio. In bidirectional mode (`bidirectional="true"`), the server may send audio back to the caller. Plivo documents that when bidirectional is true, `audioTrack` cannot be `outbound` or `both`. `keepCallAlive="true"` makes subsequent XML wait until stream disconnects. Custom headers have a documented maximum length of 512 bytes and allowed characters `[A-Z]`, `[a-z]`, and `[0-9]`. [4]

The protocol reference names the incoming `start`, `media`, and `dtmf` events, plus `playedStream` and `clearedAudio`; outgoing server messages include `playAudio`, `checkpoint`, `clearAudio`, and `sendDTMF`. `media.payload` and `playAudio.media.payload` are base64 audio. The `start` event includes media-format `encoding` and `sampleRate`; the reference gives `audio/x-mulaw` as an encoding example and recommends μ-law at 8 kHz. It says media chunks are about 20 ms and at 8 kHz μ-law about 160 bytes. `playAudio` contentType and sampleRate must match the stream. The reference’s DTMF event represents digits `0-9`, `*`, `#`, and `A-D`; `sendDTMF` supports the same set. [5]

The XML page’s audio-format section did not render its supported-format list in the extracted page. Therefore, this note verifies μ-law as an example/recommendation, but cannot establish a complete supported-codec list, nor all legal codec/sample-rate combinations. A stream-status callback can report connected/started, stopped, or failed states. [4] [5]

## Conference

Plivo’s conference guide shows `<Conference>` joining participants to a conference by a name, with options such as `startConferenceOnEnter` and `endConferenceOnExit`; its sample also uses `waitSound`. Plivo’s voice overview describes conferences as supporting multiple participants and points to Conference API and Member API references. The opened conference guide is a use-case guide rather than the complete attribute/API reference, so exact full option coverage and conference REST endpoint formats are not asserted. [6] [7]

## Webhook validation

Plivo’s Voice signature page documents V3 signatures: the signed request string is based on the final URL (scheme, port, query string) plus POST parameters sorted alphabetically by name for POST requests; a unique nonce is appended and supplied separately in `X-Plivo-Signature-V3-Nonce`. Plivo signs using HMAC-SHA256 with the relevant account or subaccount Auth Token; the Base64 signature is sent in `X-Plivo-Signature-V3`. `X-Plivo-Signature-Ma-V3` uses the main account token. The page advises validating every webhook and notes that Plivo SDKs include helpers. This describes the vendor’s signature mechanism; it is not a claim of legal or regulatory compliance. [8]

## References

[1]: https://plivo.com/docs/voice/api/calls "Plivo Voice API Calls"
[2]: https://plivo.com/docs/voice/xml/routing "Plivo XML Call Routing"
[3]: https://plivo.com/docs/voice/api/calls "Plivo Voice API Calls"
[4]: https://plivo.com/docs/voice-agents/audio-streaming/xml/stream "Plivo Stream XML element"
[5]: https://plivo.com/docs/voice-agents/audio-streaming/concepts/audio-streaming-reference "Plivo Audio Streaming Protocol Reference"
[6]: https://plivo.com/docs/voice/use-cases/call-conference "Plivo PINless Conference Calls"
[7]: https://plivo.com/docs/voice/concepts/overview "Plivo Voice Overview"
[8]: https://plivo.com/docs/voice/concepts/signature-validation "Plivo Voice Signature Validation"
