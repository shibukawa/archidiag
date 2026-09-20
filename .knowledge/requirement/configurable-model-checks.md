---
id: requirement:configurable-model-checks
type: requirement
title: Configurable Cross-Diagram Checks
---
Authors must be able to choose and tailor a ladder of check profiles so the validation panel reports the completeness expected at the current stage across C4, ERD, DFD, vocabulary, domains, and perspectives.

```yaml
priority: v1
user_story: As an author early in a project, I select "container_sketch" so missing component diagrams and domains stay silent; later I switch to "domains_typed" and see exactly which domains still lack a type.
acceptance:
  - select the active profile from the ladder in the validation panel
  - the panel lists findings grouped by diagram and by item with level badges and navigation
  - the ladder view shows pass ratio per profile and the failing items of the next step
  - edit a profile: set item levels, extend another profile, rename, reorder, duplicate, delete
  - add a parameterized item from a built-in template, for example a required perspective on external-facing containers
  - built-in profiles are editable copies; reset restores the built-in ladder
  - integrity errors are always shown and cannot be disabled
  - export the ladder as JSON and import it into another project
  - checks run automatically on change and on demand; export runs the active profile first and shows blocking findings
  - the AI tool surface reports the same findings and can apply fixes directly with agent attribution (rule:ai-change-consent)
non_goals:
  - numeric maturity scores
  - user-scripted check logic
depends_on:
  - decision:checks-over-maturity
  - data:check-item
  - data:check-profile
  - rule:check-evaluation
  - requirement:validation-and-export
  - data:c4-project
  - api:ai-tool-surface
  - ui:diagram-editor
```
