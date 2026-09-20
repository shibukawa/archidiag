---
id: data:style-theme
type: data
title: Style Theme
---
A style theme is the named token set that draws every kind, role, relationship, DFD node, and boundary in a project, selected once per project and rendered identically on canvas, in exports, and in the legend.

```yaml
fields: id, name, based_on, tokens, builtin
tokens:
  key: element kind or role, relationship kind, dfd node kind, boundary kind
  value: shape, fill, stroke, dash, text_color, corner_icon, label_style
based_on: built-in theme id when the theme is a customized copy
storage: in data:c4-project settings; on disk in c4sketch.yaml
constraints:
  - every key defined by rule:diagram-styles has a value; missing keys fall back to based_on, then to compact
  - shapes come from the fixed shape set; icons from the fixed icon set
  - editing a theme is one undoable settings operation
  - the legend and exports always use the active theme
```
