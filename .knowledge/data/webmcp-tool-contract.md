---
id: data:webmcp-tool-contract
type: data
title: WebMCP Tool Contract
---
The WebMCP tool contract describes an editor operation with a stable name, human-readable description, typed input schema, result shape, and mutation classification.

```yaml
fields: name, title, description, input_schema, result_schema, mutation_kind, permission_hint
mutation_kinds:
  - read_only
  - proposal
  - consequential
contract_rules:
  - inputs are explicit and bounded
  - errors are descriptive and retryable
  - tool names remain stable across compatible releases
```
