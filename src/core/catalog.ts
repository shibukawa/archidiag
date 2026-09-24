// Project-wide catalogs of tables and DFDs, derived live from the model (requirement: project-catalogs).
import { dfdOf, dfdViews } from './dfd'
import { entitiesOfStore, estimateVolume, isDependentEntity, isErdStore, type Element, type NameMode, type Project } from './model'
import type { Finding } from './validate'
import { bindName, displayName } from './vocabulary'

export interface TableRow {
  entity: Element
  store: Element
  name: string
  physical: string
  dialect: string
  classification: string
  storage: string
  owner: string
  primaryKey: string
  fields: number
  importantFields: number
  dfdReads: number
  dfdWrites: number
  dfds: number
  bytes?: number
  findings: number
  worstLevel?: Finding['level']
}

export interface DfdRow {
  viewId: string
  useCase: string
  scope: string
  processes: number
  stores: number
  nodes: number
  flows: number
  boundaries: number
  unplaced: number
  findings: number
  worstLevel?: Finding['level']
}

const LEVEL_ORDER: Record<Finding['level'], number> = { error: 0, warning: 1, info: 2 }
const worst = (items: Finding[]) => items.reduce<Finding['level'] | undefined>((level, finding) => (!level || LEVEL_ORDER[finding.level] < LEVEL_ORDER[level] ? finding.level : level), undefined)

/** Every table of every database and schema container, in the given name mode. */
export function tableRows(project: Project, findings: Finding[], mode: NameMode = 'business'): TableRow[] {
  const plural = project.settings.namingPolicy.tableNumber === 'plural'
  const byTarget = new Map<string, Finding[]>()
  findings.forEach((finding) => byTarget.set(finding.targetId, [...(byTarget.get(finding.targetId) ?? []), finding]))
  // DFD reads and writes: flows touching a store node bound to the table.
  const reads = new Map<string, number>()
  const writes = new Map<string, number>()
  const inDfds = new Map<string, Set<string>>()
  dfdViews(project).forEach((view) => {
    const payload = dfdOf(view)
    Object.values(payload.flows).forEach((flow) => {
      ;[payload.nodes[flow.sourceNodeId], payload.nodes[flow.targetNodeId]].forEach((node) => {
        if (node?.role !== 'data_store' || !node.elementId) return
        inDfds.set(node.elementId, (inDfds.get(node.elementId) ?? new Set()).add(view.id))
        if (flow.operations.includes('R')) reads.set(node.elementId, (reads.get(node.elementId) ?? 0) + 1)
        if (flow.operations.some((operation) => operation !== 'R')) writes.set(node.elementId, (writes.get(node.elementId) ?? 0) + 1)
      })
    })
  })
  return Object.values(project.elements).filter(isErdStore).flatMap((store) => entitiesOfStore(project, store.id).map((entity) => {
    const own = byTarget.get(entity.id) ?? []
    const attributes = entity.attributes ?? []
    return {
      entity,
      store,
      name: displayName(project, entity.name, mode, plural).text,
      physical: bindName(project, entity.name, plural).physical ?? '',
      dialect: store.sqlDialect ?? '',
      classification: entity.classification ?? '',
      storage: entity.storageKind ?? 'table',
      owner: isDependentEntity(project, entity) ? displayName(project, project.elements[entity.parentId!]?.name ?? '', mode).text : '',
      primaryKey: attributes.filter((attribute) => attribute.primaryKey).map((attribute) => displayName(project, attribute.name, mode).text).join(', '),
      fields: attributes.length,
      importantFields: attributes.filter((attribute) => attribute.important).length,
      dfdReads: reads.get(entity.id) ?? 0,
      dfdWrites: writes.get(entity.id) ?? 0,
      dfds: inDfds.get(entity.id)?.size ?? 0,
      bytes: estimateVolume(entity.volume, project.settings.volumeHorizonMonths)?.bytes,
      findings: own.length,
      worstLevel: worst(own),
    }
  }))
}

/** Every DFD with its size and open findings. */
export function dfdRows(project: Project, findings: Finding[]): DfdRow[] {
  return dfdViews(project).map((view) => {
    const payload = dfdOf(view)
    const nodes = Object.values(payload.nodes)
    const own = findings.filter((finding) => finding.viewId === view.id && ['node', 'flow', 'boundary', 'view'].includes(finding.targetKind))
    return {
      viewId: view.id,
      useCase: view.useCase || view.name,
      scope: view.scopeId ? project.elements[view.scopeId]?.name ?? '' : '',
      processes: nodes.filter((node) => node.role === 'process').length,
      stores: nodes.filter((node) => node.role === 'data_store').length,
      nodes: nodes.length,
      flows: Object.keys(payload.flows).length,
      boundaries: Object.keys(payload.boundaries).length,
      unplaced: nodes.filter((node) => !node.elementId && node.role !== 'start' && node.role !== 'diagram_ref').length,
      findings: own.length,
      worstLevel: worst(own),
    }
  })
}
