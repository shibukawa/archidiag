---
id: flow:ai-assisted-editing
type: flow
title: AI-Assisted Editing Flow
---
An AI agent reads the current model, applies validated edits directly as an editor, and the user watches, continues, or undoes them in the same session.

```yaml
flow:
  trigger: actor:ai-agent receives a task while attached to a project through term:webmcp-integration or api:mcp-server
  steps:
    - id: inspect
      action: call read tools and resources from api:ai-tool-surface, including get_element_usage and get_check_findings
    - id: edit
      action: call mutation tools; each call is a validated data:edit-operation applied immediately
    - id: observe
      action: the activity panel and canvas show the attributed change live; presence shows the agent
    - id: continue_or_undo
      action: the user edits alongside, or undoes the agent's batch as one step
    - id: share
      action: in a shared session the server broadcasts accepted operations like any participant's
  failure:
    invalid_operation: descriptive error, no partial mutation, agent may retry
```
