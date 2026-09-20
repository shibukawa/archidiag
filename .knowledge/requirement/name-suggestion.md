---
id: requirement:name-suggestion
type: requirement
title: Japanese-to-English Name Suggestion
---
Authors must be able to get system and physical name suggestions for vocabulary entries by translating from the project's business language to its system language in the project's naming style, from an on-device, browser, or server provider, and confirm or reject them individually or in bulk.

```yaml
priority: v1
user_story: As an author, I register 顧客 and 注文明細 as business names, press Suggest, and get Customer / customer and OrderLine / order_line from Chrome built-in AI, reusing my existing 注文 = Order entry.
acceptance:
  - suggest for one entry, for all entries missing a name, or for a selection
  - candidates follow rule:physical-naming-policy: translation between the configured languages or romaji for Japanese, case rule, singular or explicit plural
  - existing confirmed entries are reused for known segments before any provider call
  - each candidate shows provider, rationale, and resolution kind; accept or reject per candidate
  - bulk accept applies only candidates marked reuse or composed unless the user opts in to translated ones
  - romaji transliteration works offline on the static build
  - Chrome built-in AI is used when available and hidden otherwise
  - model providers are configured only on the Bun server: API endpoints, subscription-backed agent SDKs, or local LLMs; the browser never shows a credential or endpoint field (decision:no-credentials-in-browser)
  - the provider picker lists browser providers plus those the server advertises
  - a glossary of confirmed names is passed to providers for consistency
  - suggestions never confirm automatically; accepted ones are attributed in history
  - the AI tool surface exposes suggest_names returning candidates; an agent applies chosen ones with upsert_vocabulary_entry
depends_on:
  - rule:physical-naming-policy
  - data:name-suggestion
  - system:name-suggestion-provider
  - data:vocabulary-entry
  - requirement:vocabulary-dictionary
  - rule:ai-change-consent
  - decision:static-first-architecture
  - decision:no-credentials-in-browser
  - system:bun-server
```
