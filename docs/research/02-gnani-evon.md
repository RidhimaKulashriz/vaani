# Gnani Evon planner/LLM

**Retrieved:** 2026-11-11. **Scope:** Official Gnani documentation and Gnani-published model material only.

## Finding

A public, Evon-specific hosted API reference was not found in Gnani’s public developer documentation. The official docs landing page describes Speech APIs, Agent Builder and Agent Builder Platform APIs, but not Evon. Gnani’s Evon page describes API availability via a closed beta/waitlist and planned wider access, without publishing an endpoint, authentication instructions or an API schema. Therefore there is no publicly verified Gnani-hosted Evon request/response format to reproduce here. [1] [2]

The distinction is that Gnani has published open model weights and local-serving guidance. The Gnani-published Hugging Face model card demonstrates Transformers usage and OpenAI-compatible chat-completion calls to locally hosted vLLM/SGLang servers. Those are self-hosted inference examples, not evidence of a Gnani cloud endpoint or Gnani API contract. [3]

## Verified capabilities and limits

Gnani’s Evon waitlist describes text chat, reasoning and agents in English and 10 Indian languages, a 128K-token context, and a thinking mode for math and code. It also describes combining Evon with speech recognition and synthesis as separate API calls. [2]

The Gnani-published model card specifies 11 supported languages (English, Hindi, Bengali, Telugu, Tamil, Marathi, Gujarati, Kannada, Malayalam, Odia and Punjabi), a 131,072-token maximum context, and text chat-message inputs with OpenAI-compatible roles (`system`, `user`, `assistant`, `tool`). It includes `stream: false` in an example configuration, but does not document Gnani-hosted streaming behavior. It describes reasoning traces as optional and shows how to disable thinking for the local model/runtime. [3]

For local vLLM serving, the model card gives a concrete OpenAI-compatible endpoint example: `http://localhost:8000/v1/chat/completions`; its SGLang example uses `http://localhost:30000/v1/chat/completions`. These are local server addresses shown in model-card examples, not Gnani service URLs. The card includes tool-calling setup flags for vLLM (`--enable-auto-tool-choice` and `--tool-call-parser qwen3_coder`) and describes agentic/tool-calling intended use. It does not establish hosted API tool-calling support or a Gnani-specific tool schema. [3]

## Access, authentication, safety

The waitlist says a selected group receives Evon v3.3 on Gnani AI API, with beta users working directly with the team; it states that access starts 12 October 2026 and that wider developer access is intended after beta. It provides no public API key procedure, authentication scheme, base URL, account setup guide or public rate/quota/pricing limits. [2]

The model card says the weights are released under Apache 2.0 and explicitly says the model is not recommended for high-stakes decisions or legal, medical or financial advice, or deployment without safety evaluation on target languages and domains. These are model-card cautions, not a hosted API safety policy or a compliance claim. No API-level moderation controls, content policy, data retention terms, privacy/security guarantees, or safety-filter configuration were found in the reviewed public official sources. [3]

## References

[1]: https://docs.gnani.ai/ "Gnani AI developer documentation landing page"
[2]: https://www.gnani.ai/evon-waitlist "Evon v3.3 on the Gnani AI API waitlist"
[3]: https://huggingface.co/gnani/gnani-evon-v3.3-30B-A3B "Gnani-published Evon v3.3 model card"