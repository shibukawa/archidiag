---
id: vision:c4-modeling-workbench
type: vision
title: Browser C4 Modeling Workbench
---
Build a browser-first editor for C4 diagrams that works on static hosting and can add shared and AI-assisted editing when services are available.

```yaml
scope:
  supported_levels:
    - term:c4-diagram-level
  primary_actors:
    - actor:diagram-author
    - actor:collaborator
    - actor:ai-agent
  deployment_baseline: system:github-pages-host
  optional_runtime: system:collaboration-service
```
