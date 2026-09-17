---
id: requirement:browser-editing
type: requirement
title: Browser Editing Without a Backend
---
A user must be able to use the core editor on a static host without login, server calls, or a collaboration service.

```yaml
priority: mvp
acceptance:
  - load the app from static assets
  - create and edit a project after page load
  - preserve work during normal reload through local browser persistence
  - show clear storage limits and recovery actions
  - degrade gracefully when browser storage is unavailable
depends_on:
  - system:github-pages-host
  - decision:static-first-architecture
```
