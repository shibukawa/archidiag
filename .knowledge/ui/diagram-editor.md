---
id: ui:diagram-editor
type: ui
title: Diagram Editor UI
---
The diagram editor combines a kind-aware canvas for c4_*, erd_*, and dfd_* diagrams, an element inspector with field list, vocabulary and domain dictionaries, validation feedback, project file actions, collaboration status, and AI change review.

```yaml
ui:
  root:
    kind: browser_app
    id: diagram-editor
    children:
      - kind: toolbar
        id: diagram-actions
        actions: new, open, save, export_json, export_pdf, export_drawio, export_png, export_svg, export_ddl, export_bundle, arrange, undo, redo, validate, new_dfd
      - kind: level_navigator
        id: c4-levels
        levels: context, container, component, code
        controls: breadcrumb, back, current_scope, view_tabs, paired_dfd_list, name_display_mode
      - kind: canvas_toolbar
        id: canvas-toolbar
        groups: undo_redo, quick_create_and_arrange, layout_helpers (multi-selection only), description_display_mode (descriptive default | compact | technology on c4_*; descriptive default | fields | compact on erd_*), style_theme, zoom
        view_tabs: views of the current scope and kind; default marked; new, rename, duplicate, delete, set_default
      - kind: explorer
        id: project-explorer
        sections: model_tree_with_groups, entities_under_data_stores, dfds_by_scope_and_use_case, perspectives
        catalogs: vocabulary, domains, tables, dfds (requirement:project-catalogs)
      - kind: catalog_view
        id: project-catalog
        tabs: vocabulary | domains | tables | dfds
        controls: search, filters, sort, column_picker, export_csv_markdown, bulk_actions
      - kind: canvas
        id: diagram-canvas
        actions: select, create, quick_create, connect, move_by_drag, delete, zoom, pan, double_click_enter
        navigation:
          software_system: open child container scope
          application_container: open child component scope
          database_store_container: open erd_component
          entity: open erd_code
          dfd_process: open next-level dfd of the same use case
          dfd_diagram_ref: open referenced dfd
          other_element: select and inspect
      - kind: erd_canvas
        id: erd-canvas
        visible_when: current_diagram.kind starts with erd_
        node: entity card; descriptive mode shows the description, fields mode shows important attribute rows with key markers and a hidden field count (requirement:erd-field-visibility); relationship reference rows, dependent count badge
        edge: UML-style relationship with multiplicity labels at both ends and kind markers
      - kind: dfd_canvas
        id: dfd-canvas
        visible_when: current_diagram.kind starts with dfd_
        node: external_entity | process (numbered) | data_store | intermediate_data (file | queue) | diagram_ref
        edge: labeled directed flow with CRUD at store ends and entity payload chips; no ordering
        region: dashed transaction boundary with name and atomic or eventual marker
        actions: add_node_from_model, link_handle_connect, insert_intermediate_data, zoom_process, add_diagram_ref, draw_transaction_boundary
      - kind: volume_bubble_chart
        id: data-volume-chart
        opened_from: erd canvas toolbar, data store inspector, explorer
        controls: horizon, measure bytes | rows | daily_writes, legend by classification, export_png_svg (requirement:data-volume-bubble-chart)
      - kind: group_boundary
        id: group-boundaries
        visible_when: current_diagram.kind in c4_context, c4_container, c4_component, erd_component
        style: dashed labeled boundary nested inside the scope boundary
        actions: drag_element_in_or_out, rename, collapse_in_tree
      - kind: perspective_badges
        id: perspective-badges
        placement: top_right of any annotated element, relationship label, group, or flow
        hover: callout with note text per perspective and a link to the perspective dashboard
      - kind: perspective_dashboard
        id: perspective-view
        sections: summary, notes, derived, findings, coverage, focus (requirement:perspective-view)
      - kind: perspective_filter
        id: perspective-filter
        placement: toolbar
        behavior: dim targets without a note of the selected perspective or value; toggle the perspective's styling; as-is and to-be presets for lifecycle
      - kind: link_handle
        id: selected-item-link-handle
        position: bottom_right of selected item
        applies_to: erd_canvas, dfd_canvas
      - kind: boundary
        id: current-system-boundary
        state: visible in container and component views
        placement: around current scope; external context remains outside
        actions: resize_from_bottom_right
      - kind: diagram_frame
        id: diagram-frame
        title_block: fixed bottom left overlay per rule:diagram-frame
        legend: fixed bottom right overlay from data:diagram-legend; minimizable, never hidden
        styles: rule:diagram-styles via the project's data:style-theme
      - kind: theme_settings
        id: style-theme
        placement: canvas toolbar beside zoom for picking a built-in theme; token editing in a settings dialog
        controls: pick built-in theme, copy and edit tokens, light or dark editor variant
      - kind: inspector
        id: element-inspector
        fields: name, description, technology, container_category, data_store_kind
        term_links: registered vocabulary in name and description renders as links with hover card
        bind_toggle: opt a C4 element into vocabulary binding
      - kind: field_list
        id: entity-attributes
        visible_when: current_element.kind == entity
        columns: important, name, domain, required, unique, primary_key, key_kind, default, value_generation, description
        filter: all | important only
        entity_header: dependency independent | dependent with owner picker, classification, storage kind, description
        volume_section: data:entity-volume fields with the derived rows, bytes, and daily writes at the project horizon (requirement:data-volume-estimation)
        rows: data:attribute plus relationship reference rows
        quick_entry: type name and Enter creates the field with a same-named domain; drop a domain to use it instead
      - kind: vocabulary_view
        id: vocabulary-dictionary
        columns: business_name, system_name, physical_name
        sidebar: meaning, notes, aliases, usage, suggestions
        actions: suggest_selected, suggest_missing, accept_candidate, reject_candidate, bulk_accept_safe
      - kind: naming_policy_settings
        id: naming-policy
        controls: business_language, system_language, transliteration, identifier_case, table_number, primary_key_column, foreign_key_column, suggestion_provider (browser providers plus server-advertised; no credential fields)
      - kind: locale_selector
        id: ui-locale
        placement: header
      - kind: domain_dictionary_panel
        id: domain-dictionary
        layout: merge candidates and uncurated first | categories | domains with origin and curated markers | selected domain definition
        actions: quick_entry, define, drag_to_attribute, merge_selected, show_merge_candidates
      - kind: dfd_flow_inspector
        id: dfd-flow
        visible_when: current_selection is dfd_flow
        fields: label, data_refs, operations, technology, transaction_boundaries
      - kind: perspective_notes
        id: perspective-notes
        visible_when: any target is selected
        actions: add_note, edit_note, delete_note, choose_perspective
      - kind: group_selector
        id: element-group
        visible_when: current_element has a parent scope with groups
      - kind: element_usage
        id: referenced-by-dfds
        visible_when: current_element is referenced by any dfd
      - kind: analysis_view
        id: element-analysis
        opened_from: inspector, explorer, canvas context menu
        sections: data:element-usage
        controls: filter_by_kind_use_case_perspective_operation, export_markdown
      - kind: view_element_picker
        id: add-to-view
        visible_when: current view is non-default or hides elements
      - kind: container_type_controls
        id: container-taxonomy
        visible_when: current_element.kind == container
        controls: application | data_store, database | database_schema | pubsub | other, sql_dialect postgresql | sqlite | mysql
      - kind: validation_panel
        id: validation-results
        controls: active_profile_selector, level_filter, group_by_diagram_or_item
        ladder: pass ratio per profile and next-step items
      - kind: check_profile_editor
        id: check-profiles
        actions: edit_levels, extend, reorder, duplicate, add_item_from_template, import_json, export_json, reset_builtin
      - kind: collaboration_panel
        id: session-status
        state: hidden when no session
        shows: server connection, participants including MCP agents, revision
      - kind: start_screen
        id: start-screen
        visible_when: no project is open
        options: blank, starter projects (data:starter-project), open file, server projects
      - kind: quick_create_popover
        id: quick-create
        open: toolbar, shortcut, double-click empty canvas, context menu
        sections: defaults by diagram kind, name field with persistent focus
        behavior: Enter creates and keeps focus; Escape closes (requirement:canvas-quick-create)
      - kind: layout_helper_toolbar
        id: layout-helpers
        visible_when: two or more nodes are selected
        actions: align, distribute, arrange_row, arrange_column, arrange_grid, match_size, spacing
      - kind: arrange_dialog
        id: arrange-options
        controls: scope whole_view | selection, direction, spacing
      - kind: project_picker
        id: server-projects
        visible_when: system:bun-server is detected
        actions: list, open, create, save
      - kind: ai_activity_panel
        id: ai-activity
        state: hidden until an agent is attached
        shows: attached agents, their recent attributed edits, undo per batch
```
