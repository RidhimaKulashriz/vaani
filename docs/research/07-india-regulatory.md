# India telecom: AI-call regulatory and provider terms

**Verified 11 November 2026.** This is a source note, not legal advice or a compliance assessment. The official materials reviewed do not state an AI-specific exemption or AI-specific call rule.

## TRAI / DLT framework

TRAI’s TCCCPR landing page describes the framework as protecting customers from unsolicited commercial communication and facilitating communications to customers who opted in or set preferences.[1] The 12 February 2025 Second Amendment applies throughout India and amended the 2018 rules.[2]

The amended regulation defines promotional voice calls as commercial voice communications containing promotional material or advertising; promotional content mixed into another commercial voice call makes the call promotional. Such calls are delivered according to the recipient’s registered preference or consent register, with explicit digital consent treated as specified in the regulation.[2] Service voice calls include non-promotional information for an existing customer/subscriber about a product or service, and certain ongoing transactions after explicit consent; that transaction-related explicit consent is valid for seven days unless TRAI directs otherwise. A transactional voice call is in response to a customer-initiated transaction within 30 minutes and must be non-promotional.[2] Consent inferred for transactional/service communication is limited to the contract’s duration or discharge. Consent tied to an ongoing transaction is not indefinite: the amendment sets seven days.[2]

The amendment requires commercial communications over an access provider’s network to use registered headers or sender number resources from special commercial-communication series. A sender must be registered with an access provider for commercial communication; an unregistered sender’s commercial communication is treated as UCC. It also requires every sender to notify the originating access provider **in advance, in writing**, of use of an auto dialer or robo-calls and their intended objective.[2] These provisions do not expressly mention AI voice agents, synthetic speech, or AI disclosure.

TRAI’s 2025 official press release says 140-series numbers continue for promotional calls and 1600-series numbers are designated for transactional and service calls, with implementation in progress at release.[3] TRAI’s directions listing subsequently identifies a 10 August 2026 direction on allocating and operationalizing **1601** for service and transactional voice calls by entities outside BFSI and Government sectors; the listing alone does not provide its operational details.[4] Applicability, allocation process, and effective milestones for a particular caller should be checked against the direction itself and relevant access provider; they are not established by the listing. TRAI’s 2025 notice also describes registered entities, consent/preferences, and commercial number series; ordinary ten-digit caller numbers are not presented as the permitted commercial-call identity.[2][3]

## Caller identity, recording, and business recipients

TRAI describes the special series as helping recipients identify call type through caller-line identification.[3] The reviewed regulation does not state a separate rule for AI caller-name display or require an AI-generated voice to identify itself as AI. DoT has published an official document on measures addressing spoofed Indian CLI, but this research did not verify from accessible text a rule specifying how an AI service must identify itself; caller ID must not be treated as verified merely because an app or API accepts a caller-ID field.[5]

No specific call-recording consent, announcement, or retention rule for AI business calls was located in the reviewed TRAI TCCCPR amendment or the provider docs examined. Exotel’s public developer privacy page says call recording is not enabled by default, can be enabled per flow/API/account, and provides a `record=true` parameter example; it also states a default 90-day retention period for recordings (configurable depending on plan).[6] This is provider documentation, not a statement of Indian law or a regulator’s ruling. It does not establish that notification alone is sufficient or settle all-party consent, lawful basis, or retention obligations.

The TCCCPR language focuses on commercial communications sent to a “Recipient” and defines service/transactional categories by reference to the sender’s customer/subscriber and customer-initiated transaction.[2] It does not expressly carve out calls to businesses, corporate switchboards, or business contacts, nor clarify treatment of a named employee’s personal mobile used for work. Whether a particular B2B AI call falls in a class, is commercial, or reaches a protected subscriber therefore remains fact- and interpretation-dependent in the sources reviewed.

## Provider integration surface (Exotel documentation example)

Exotel’s official developer use-case page documents a call-connect example: `POST https://${SUBDOMAIN}/v1/Accounts/${ACCOUNT_SID}/Calls/connect`, form-urlencoded fields `From`, `To`, `CallerId`, `StatusCallback`, `StatusCallbackEvents`, and `StatusCallbackContentType`. It shows `api.exotel.com` as the default subdomain and HTTP Basic authentication formed from API Key and API Token.[7] An Exotel testing page separately documents v2 JSON example endpoint `https://api.exotel.com/v2/accounts/<account_sid>/calls/connect` with fields `from`, `to`, `caller_id`, and `url`; it lists `api.in.exotel.com` for production in India and `api.exotel.com` for production Singapore.[8] These are exact sample formats from docs, not a TRAI-mandated API or confirmation of current account eligibility. No DLT registration API, consent registration endpoint, or call-recording disclosure endpoint was found in these provider pages.

## Unavailable / unresolved

- No official primary source reviewed specifies how the TCCCPR applies to AI-generated speech, requires AI disclosure, or distinguishes an AI agent from a human caller.
- The TRAI directions listing names the 1601 direction but its linked operative text and rollout details were not verified here. Specific 1600/1601 eligibility and effective dates are consequently unavailable in this note.
- No definitive official source reviewed resolved B2B/corporate-target scope, business-contact consent, or whether a company relationship alone qualifies as service/transactional consent.
- No applicable recording statute/regulator text was verified here that specifically prescribes notice, consent mechanics, or retention for the described calls. Exotel’s vendor guidance is not a substitute.
- Provider contractual terms for Exotel were not successfully opened; the cited provider materials are developer/help documentation, not a verified complete contract or AI-calling policy.
- The DoT source located on CLI spoofing and current DLT portal workflows were not fully text-verified. Exact DLT API format/endpoints are unavailable in the sources reviewed.

## References

[1]: https://trai.gov.in/tcccpr "TRAI TCCCPR-2018 overview"
[2]: https://www.trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf "TRAI Telecom Commercial Communications Customer Preference Second Amendment Regulations 2025"
[3]: https://www.trai.gov.in/sites/default/files/2025-02/PR_No.11of2025.pdf "TRAI press release on TCCCPR amendments, 12 February 2025"
[4]: https://www.trai.gov.in/release-publication/directions "TRAI directions listing"
[5]: https://www.dot.gov.in/static/uploads/2025/07/bad057ea19930a8c58cb45d7631e1ace.pdf "DoT official document on spoofed Indian CLI"
[6]: https://developer.exotel.com/docs/faqs/data-privacy "Exotel developer documentation: Data Privacy and Retention"
[7]: https://developer.exotel.com/docs/use-cases/call-monitoring-visualization "Exotel developer documentation: Call Monitoring and Visualization"
[8]: https://developer.exotel.com/docs/getting-started/testing-guide "Exotel developer documentation: Testing Guide"
