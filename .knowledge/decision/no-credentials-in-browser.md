---
id: decision:no-credentials-in-browser
type: decision
title: No LLM Credentials in the Browser
---
The browser never asks for, stores, or sends an LLM API key; every model-backed feature runs either on-device without credentials or on system:bun-server, where providers are configured by the operator.

```yaml
status: accepted 2026-09-20
browser_allowed:
  - deterministic transliteration (no model)
  - Chrome built-in AI (on-device, no credentials)
server_only:
  - API-key providers: OpenAI-compatible endpoints, vendor APIs; keys come from server config or environment
  - subscription-backed agent SDKs running on the server host with the host user's login, for example Codex SDK or GitHub Copilot SDK
  - local LLM servers such as Ollama, LM Studio, or llama.cpp reached from the server, typically on localhost
ui_contract:
  - the browser shows which providers the server has configured and lets the user pick one
  - no text field for keys, tokens, or endpoint URLs exists in the browser UI
  - the static build shows only the browser-allowed providers
rejected:
  browser_entered_api_key: key exposure in local storage, history, and shared screens
  browser_direct_to_localhost_llm: still needs endpoint configuration in the browser and breaks on shared hosts
consequences:
  - system:name-suggestion-provider lists providers by runtime and credential source
  - future in-app assistants follow the same rule
```
