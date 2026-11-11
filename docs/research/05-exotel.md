# Exotel India call control and bridging

**Retrieved:** 2026-11-11. Sources below are Exotel’s official developer documentation, opened directly. This note records documented interfaces and distinguishes product/API facts from access or account-specific details that the pages do not establish.

## Outbound call control

The production-grade Voice v1 Connect Two Numbers API initiates a two-leg outbound call: Exotel calls `From` first; after answer it dials `To` and connects the legs through the `CallerId` ExoPhone. The documented request is an `application/x-www-form-urlencoded` `POST` to `https://api.in.exotel.com/v1/Accounts/{account_sid}/Calls/connect` for Mumbai/India accounts (the docs also list `api.exotel.com` for Singapore). Required fields are `From`, `To`, and `CallerId`; the docs accept E.164 for phone numbers and also allow `From` as a SIP URI. Optional fields include `TimeLimit` (maximum 14,400 seconds), `TimeOut`, recording controls, `StatusCallback`, and streaming fields. [1] [2]

To dial a number into a configured IVR/call flow instead, the same POST path takes `From`, `CallerId`, and `Url`; the documented flow URL shape is `http://my.exotel.com/{your_sid}/exoml/start_voice/{app_id}`. The response `To` is null for this flow-based call. [3]

## Bridge, conference, and call legs

Connect Two Numbers is the documented standard two-party bridge. For explicit participant/bridge management, Exotel documents a separate ExoML Legs & Bridges API. The India base is `https://cpaas-api.in.exotel.com/v2/accounts/{account_sid}` (Singapore: `cpaas-api.exotel.com`), authenticated with HTTP Basic. `POST .../legs` creates a leg; required fields are `contact_uri`, `exophone`, and `leg_event_endpoint` (gRPC). `POST .../bridges` connects two or more active legs; required fields are `leg_sids` and `bridge_event_endpoint` (gRPC). The reference also documents getting bridge state with `GET .../bridges/{bridge_sid}` and stopping it with `PUT .../bridges/{bridge_sid}` and JSON `{"action":"stop"}`; stopping disconnects all legs. [4] [5]

Exotel’s Voice FAQ describes multi-party calling, adding participants to active calls, conference bridges, and participant mute/hold/disconnect through the Legs API. Exact feature availability, account entitlement, limits, or commercial terms for a given account are not established by those generic pages. [6]

## Audio streaming / WebSocket

AgentStream documentation describes Stream (one-way audio to the customer’s WebSocket) and Voicebot (bidirectional audio). For a Voicebot, Exotel opens a WebSocket and exchanges JSON `connected`, `start`, `media`, and `stop` events; bidirectional sessions additionally support DTMF/mark and server-to-Exotel `media`, `mark`, and `clear`. Audio is base64 raw PCM, signed 16-bit little-endian mono; documented sample rates are 8,000, 16,000, or 24,000 Hz. Chunks must be 3.2 KB–100 KB and multiples of 320 bytes. [7] [8]

The Connect API page documents `StreamUrl` (WebSocket URL) and `StreamBegin` (`at Leg1Connect` or `at Leg2Connect`); AgentStream overview describes outbound Voice AI using `StreamUrl` plus `StreamType=bidirectional`. Use the applet/AgentStream protocol documentation for the separate flow-based setup. [1] [9] The Stream/Voicebot applet page documents WebSocket URL configuration and says authentication options are IP allowlisting (contact Exotel) or Basic Auth in the WSS URL, transmitted as an Authorization Basic header. [8]

## Authentication and webhook security

Exotel’s API authentication guide says API Key is the Basic-auth username and API Token the password; Account SID is part of the URL path. It directs users to Dashboard → Settings → API Settings to obtain credentials, recommends HTTPS, and says not to put credentials in URLs. For regional endpoints, the docs list `api.in.exotel.com` as the Mumbai/India host. [10]

For callbacks, the same guide recommends HTTPS, source-IP verification using current ranges obtained from Exotel Support, prompt 200 responses, payload validation, and idempotency. It warns not to rely on an obscure callback URL alone. The reviewed pages describe these as webhook security best practices; they do not document a signed-webhook/HMAC verification mechanism. [10]

## Not established by the reviewed documentation

The public pages do not establish whether a specific account is enabled for Legs & Bridges, AgentStream/Voicebot, call concurrency or higher limits, or what enterprise contract is required. The Voice FAQ says concurrency varies by plan and may be increased through Support/account manager, while Voice v3 is explicitly marked Beta and is primarily described as reporting/monitoring; it is not a substitute for the production-grade Voice v1 outbound initiation API. [6] [9] The reviewed docs do not state a cryptographic webhook signature scheme, a universal webhook source-IP list, or detailed SLA/pricing. Confirm account-specific enablement and current network allowlists with Exotel; absence from these pages is not evidence that a capability is unavailable.

## References

[1]: https://developer.exotel.com/docs/voice-v1/api-reference/connect-two-numbers "Connect Two Numbers"
[2]: https://developer.exotel.com/docs/voice "Programmable Voice"
[3]: https://developer.exotel.com/docs/voice-v1/api-reference/connect-to-flow "Connect Number to Call Flow"
[4]: https://developer.exotel.com/docs/legs/overview "Legs and Bridges API"
[5]: https://developer.exotel.com/docs/legs/api-reference/manage-legs "Manage Legs and Bridges"
[6]: https://developer.exotel.com/docs/faqs/voice-faqs "Voice API FAQs"
[7]: https://developer.exotel.com/docs/agentstream/websocket-protocol "AgentStream WebSocket protocol"
[8]: https://developer.exotel.com/docs/agentstream/stream-voicebot-applet "Working with the Stream and Voicebot Applet"
[9]: https://developer.exotel.com/docs/voice-v3/overview "Voice v3 Beta"
[10]: https://developer.exotel.com/docs/references/authentication "Authentication and Security"
