---
id: requirement:webmcp-edit-logging
type: requirement
title: Log WebMCP Edits
---
WebMCP mutation tools must emit a structured browser console log for each accepted edit.

```yaml
priority: mvp
log:
  level: console.log
  prefix: "[WebMCP edit]"
  fields: timestamp, source, scope, tool, action, element_id, element_kind, changes
acceptance:
  - log only after input validation succeeds
  - include before and after values for changed fields
  - preserve the same canonical mutation path used by manual editing
  - keep read-only tools and rejected edits out of the edit log
depends_on:
  - term:webmcp-integration
  - data:webmcp-tool-contract
  - requirement:ai-assisted-editing
```
