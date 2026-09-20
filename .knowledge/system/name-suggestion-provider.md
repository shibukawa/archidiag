---
id: system:name-suggestion-provider
type: system
title: Name Suggestion Provider
---
A name suggestion provider turns business names into system or physical name candidates behind one interface; browser providers need no credentials, and every model provider that needs configuration or credentials runs on system:bun-server (decision:no-credentials-in-browser).

```yaml
interface:
  suggest(entries, policy, glossary) -> data:name-suggestion list
  translate(text, from, to) -> candidates
  capabilities: translate | transliterate | compose
browser_providers:
  transliterator:
    runtime: browser, bundled
    needs: nothing; works on system:github-pages-host
    languages: ja romaji hepburn | kunrei; other languages as plugins
  chrome_builtin_ai:
    runtime: browser
    apis: Translator API between business_language and system_language, Prompt API for identifier composition
    detection: feature-detect; hidden when unavailable
    privacy: on-device
server_providers:
  api_endpoint:
    kinds: OpenAI-compatible endpoint, vendor API
    credentials: server config file or environment variables only
  agent_sdk:
    kinds: subscription-backed local agent SDKs such as Codex SDK or GitHub Copilot SDK
    credentials: the server host user's existing login; nothing stored by the product
    use: same suggest and translate interface; the SDK runs as a subprocess or library on the server
  local_llm:
    kinds: Ollama, LM Studio, llama.cpp server via OpenAI-compatible API
    credentials: none; endpoint configured on the server
selection:
  - the server advertises configured providers; the project stores the preferred provider id
  - the browser offers only advertised providers plus browser providers
glossary: confirmed data:vocabulary-entry names are passed so translations stay consistent
constraints:
  - no provider is required; manual entry always works
  - business names and the glossary are the only text sent to a provider
  - provider calls from the browser go through the server API, never to the provider directly
```
