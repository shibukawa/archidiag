---
id: rule:nested-relationship-projection
type: rule
title: Project Relationships Into Nested Views
---
Nested diagrams must render relationships between visible elements rather than connecting the system boundary.

```yaml
projection:
  direct: retain endpoints visible in the current view
  descendant: promote a hidden descendant endpoint to its nearest visible ancestor
  explicit: allow a per-level endpoint mapping when domain semantics identify a specific child
example:
  context: Customer -> Commerce Platform
  container: Customer -> Web Application
merging:
  one_line_per_pair: several relationships between the same two visible nodes in the same direction draw as one line; their labels stack one per line and technologies join with a slash
  selection: clicking the line selects the first relationship; the inspector lists the others folded into it
  opposite_directions: two lines, one per direction
boundary:
  pending: a relationship whose endpoint is the scope element itself is not drawn, but its other end stays in the view and is placed left when it sends and right when it receives, so nothing from the parent view disappears
  assignment: the inspector assigns the endpoint to a child of the scope for this level (viewEndpoints); the parent view keeps its own endpoints
  check: c4.relationship_assigned_in_child_view reports pending edges once the child view exists (warning by default, error when export ready)
  fallback: omit the relationship only when no visible endpoint and no boundary can be resolved
```
