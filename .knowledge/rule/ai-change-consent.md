---
id: rule:ai-change-consent
type: rule
title: AI Change Consent
---
AI mutations must be inspectable, attributable, bounded, and explicitly accepted before they become durable project changes.

```yaml
read_only_tools: may run without confirmation
mutation_tools:
  default: proposal
  require: preview diff, target scope, actor label, and accept or reject action
shared_session:
  record: data:edit-operation
  broadcast: accepted changes only
```
