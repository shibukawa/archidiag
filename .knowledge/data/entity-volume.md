---
id: data:entity-volume
type: data
title: Entity Volume Assumptions
---
Entity volume is the set of sizing assumptions an author records on one data:entity, from which the tool derives row counts and data size at a project-wide horizon.

```yaml
fields: record_bytes, initial_rows, growth_rows, growth_period, refresh_mode, refresh_every, retention_months, note
record_bytes: estimated bytes per row; typed by the author now, derivable from domains later (data:data-domain)
initial_rows: rows present at go-live or migration
growth:
  growth_rows: rows added per growth_period
  growth_period: day | week | month | year
refresh:
  refresh_mode: append | upsert | rebuild; rebuild means the whole table is replaced (洗い替え) each cycle
  refresh_every: hourly | daily | weekly | monthly | on_demand
retention_months: rows older than this are deleted or archived; empty means kept forever
derived:
  rows_at_horizon: initial_rows + growth_rows × periods(horizon) for append and upsert, capped by retention when set; initial_rows for rebuild
  bytes_at_horizon: rows_at_horizon × record_bytes; indexes and free space excluded, stated on the estimate
  horizon: project setting volume_horizon_months, default 36
  daily_write_rows: growth_rows normalized to a day, plus rows_at_horizon per rebuild cycle for rebuild mode
constraints:
  - every field is optional; the estimate exists once record_bytes and at least one of initial_rows or growth_rows are set
  - views and materialized views may carry volume too; a plain view normally has record_bytes only when materialized
  - values are assumptions, kept as typed; changing the horizon never rewrites them
  - the fields round-trip through project JSON and api:ai-tool-surface
```
