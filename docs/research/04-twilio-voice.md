# Twilio Voice: Media Streams and conferences

**Retrieved:** 2026-11-11. Sources below are official Twilio documentation pages opened and read directly.

## Outbound calls

Create an outbound call with an HTTP `POST` to `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Calls.json`, using `application/x-www-form-urlencoded`. The Call resource documentation identifies `To` (destination) and `From` (caller ID) as call inputs and supports `Url` for TwiML or `Twiml` inline; the outbound-call guide demonstrates both SDK creation with `twiml`, `to`, `from_` and with `url`, `to`, `from`. A phone-number `From` must be a Twilio number or a Verified outgoing caller ID. Calls REST requests are rate-limited by account CPS (default one CPS); excess calls queue. [1] [2]

## Bidirectional Media Streams

Use TwiML `<Connect><Stream url="wss://…"/>` to establish a bidirectional stream. Only secure WebSockets (`wss`) are supported; URL query parameters are not supported, and custom values can instead be passed through `<Parameter>`. Bidirectional streams receive only the inbound track and a Call can have only one active bidirectional stream. `<Connect><Stream>` blocks subsequent TwiML until the WebSocket disconnects; the stream can be stopped by closing the socket or ending the Call. The Stream resource cannot start a bidirectional stream. [3] [4]

The documented WebSocket event types include `connected`, `start`, `media`, `dtmf`, and `stop`; bidirectional server-to-Twilio playback additionally uses `media`, `mark`, and `clear`. `start.mediaFormat` is always `audio/x-mulaw`, sample rate `8000`, one channel; media `payload` is raw audio encoded in Base64. For sending audio back, Twilio requires payload encoded as `audio/x-mulaw` at 8000 Hz and Base64-encoded. Send a `mark` after media to learn when playback completes; `clear` empties buffered audio and returns corresponding marks. [4]

DTMF is supported only in the inbound direction: Twilio sends a `dtmf` event to the media server with `dtmf.track` equal to `inbound` and the detected digit. Sending DTMF from the media server to Twilio is not supported. Unidirectional streams do not support DTMF. [3] [4]

## Conference and warm transfer

A participant can join a named conference through TwiML `<Dial><Conference>room-name</Conference></Dial>` or by adding a participant to a named Conference with the Create Participant API. The room is created when its first participant connects; the first participant waits with hold music, and without a moderator the conference starts when the second participant joins. Conference supports up to 250 participants. [5] [6]

Twilio describes warm transfer as adding a new participant to the conference so all three parties can talk before the transfer initiator drops off. Conference participants can be held, muted, removed, and joined via TwiML/API. The reference documents `startConferenceOnEnter` (default `true`) and `endConferenceOnExit` (default `false`) for controlling start/end behavior. Twilio’s conference documentation links a dedicated warm-transfer guide, but that page did not return extractable content in this research; this note therefore does not assert a complete step-by-step transfer sequence or undocumented API request format. [5] [6]

## Webhook and WebSocket signature validation

Twilio signs requests with `X-Twilio-Signature`. For ordinary form-encoded webhooks, Twilio describes signing the full request URL plus POST fields sorted by parameter name, using HMAC-SHA1 keyed by the Auth Token, then Base64 encoding. Twilio recommends the built-in SDK request validator; include all received parameters. For JSON requests the security page documents a distinct body-validation helper and `bodySHA256` handling. Media Streams also require validating `X-Twilio-Signature` on the WebSocket handshake. Follow Twilio’s SDK guidance for signature validation; the security page notes special URL handling for voice WSS and says to try a trailing slash if handshake validation fails. [3] [7]

## Credentials, trial, and real-call caveat

The outbound-call quickstart requires an Account SID, API key SID and API key secret (or Account SID/Auth Token for local testing), plus a Voice-capable Twilio number. A real call requires valid Twilio credentials and a usable account/number; Twilio documents trial free Voice minutes, but trial calls are restricted to verified numbers and the signup country, and trial TwiML has restrictions. After free units are consumed, current Voice rates apply. Test credentials do not connect to real phone numbers. Therefore, actual live calls require account credentials and applicable available/paid Voice service; test credentials alone cannot place real calls. [1] [8] [9]

This is a technical documentation summary, not legal advice or a compliance assessment.

## References

[1]: https://www.twilio.com/docs/voice/api/call-resource "Call resource"
[2]: https://www.twilio.com/docs/voice/tutorials/how-to-make-outbound-phone-calls "Make outbound phone calls"
[3]: https://www.twilio.com/docs/voice/media-streams "Media Streams Overview"
[4]: https://www.twilio.com/docs/voice/media-streams/websocket-messages "Media Streams WebSocket Messages"
[5]: https://www.twilio.com/docs/voice/conference "Voice Conference"
[6]: https://www.twilio.com/docs/voice/twiml/conference "TwiML Voice Conference"
[7]: https://www.twilio.com/docs/usage/security "Security"
[8]: https://www.twilio.com/docs/usage/trials "Twilio trial account"
[9]: https://www.twilio.com/docs/iam/test-credentials "Test credentials"
