import { arrangeView } from './arrange'
import { CANVAS_MIN_HEIGHT, CANVAS_MIN_WIDTH, CARD_HEADER, CARD_PADDING, CARD_ROW, expandBoundaryToContain, fitBoundary, fitOuterBoundary, nodeSize, nodeSizeFor, overlaps, pad, referenceRowText, rowChars, TITLE_UNIT, union } from './layout'
import { cardRows, dependentsOf, isViewStorage, type DiagramView, type Element, type ErdRelationshipKind, type Group, type Position, type Project, type Rect } from './model'
import { pathData, routeEdges, type Route } from './routing'
import { tokenFor, tokenKeyFor, type IconKind, type Theme, type Token, type TokenKey } from './theme'
import { projectRelationships, visibleElements, type ProjectedRelationship } from './views'

export interface RenderLabels {
  kind: (element: Element, isExternal: boolean) => string
  /** Entity storage kind for the technology brackets, for example "Table" (decision: storage-kind-as-technology). */
  storage: (element: Element) => string
  boundary: string
  /** Kind tag drawn under the boundary name, for example "[Software System]". */
  boundaryKind?: string
  /** Component views: the enclosing software system boundary. */
  outerBoundary?: string
  outerBoundaryKind?: string
  title: string
  subtitle?: string
  legend: {
    heading: string
    relationship: string
    projectedRelationship: string
    boundaryRelationship: string
    boundary: string
    outerBoundary: string
    group: string
    externalContext: string
    kinds: Record<TokenKey, string>
    applicationKinds: Record<string, string>
    /** ERD line kinds, keyed by data:entity-relationship kind. */
    erdKinds: Record<ErdRelationshipKind, string>
    /** Legend line for view and materialized view cards, drawn dashed. */
    entityView: string
  }
  /** Footer row of an entity card counting the attributes not drawn. */
  moreFields: (count: number) => string
  /** Compact entity cards show the field count instead of rows. */
  fieldCount: (count: number) => string
}

export type Placement = 'internal' | 'sibling' | 'external'

export interface RenderNode {
  id: string
  element: Element
  rect: Rect
  token: Token
  tokenKey: TokenKey
  /** Sibling and external nodes are context drawn outside the scope boundary. */
  isExternal: boolean
  placement: Placement
}

export interface RenderEdge {
  id: string
  relationship: ProjectedRelationship
  route: Route
}

export interface RenderGroup {
  id: string
  group: Group
  rect: Rect
  depth: number
}

export interface LegendEntry {
  id: string
  label: string
  swatch: { kind: 'node'; token: Token; dashed?: boolean } | { kind: 'edge'; projected: boolean; boundary?: boolean; erdKind?: ErdRelationshipKind } | { kind: 'boundary' } | { kind: 'outerBoundary' } | { kind: 'group' }
}

export interface RenderModel {
  project: Project
  view: DiagramView
  theme: Theme
  labels: RenderLabels
  nodes: RenderNode[]
  edges: RenderEdge[]
  groups: RenderGroup[]
  boundary?: Rect
  /** Component views: the software system boundary enclosing the scope boundary and sibling containers. */
  outerBoundary?: Rect
  legend: LegendEntry[]
  size: { width: number; height: number }
}

export interface RenderOverrides {
  positions?: Record<string, Position>
  boundary?: Rect
}

const FRAME_HEIGHT = 44
const LEGEND_ROW = 20

export function buildRenderModel(project: Project, view: DiagramView, theme: Theme, labels: RenderLabels, overrides: RenderOverrides = {}): RenderModel {
  const { internal, siblings, external } = visibleElements(project, view)
  const size = nodeSize(view.displayMode)
  // A view without any saved layout is arranged on the fly; the same result is saved when the view is created.
  const arranged = Object.keys(view.layout.positions).length === 0 && !overrides.positions ? arrangeView(project, view) : undefined
  const positions = { ...(arranged?.positions ?? view.layout.positions), ...overrides.positions }
  const storedBoundary = overrides.boundary ?? (arranged ? arranged.boundary : view.layout.boundary)
  const internalNodes: RenderNode[] = internal.map((element, index) => ({
    id: element.id,
    element,
    rect: positions[element.id] ? { ...positions[element.id], ...nodeSizeFor(element, view.displayMode, project) } : { x: 340 + (index % 3) * (size.width + 80), y: 100 + Math.floor(index / 3) * (size.height + 48), ...nodeSizeFor(element, view.displayMode, project) },
    token: tokenFor(theme, element, false),
    tokenKey: tokenKeyFor(element, false),
    isExternal: false,
    placement: 'internal',
  }))
  const groups = buildGroups(project, view, internalNodes)
  // The boundary contains every internal node and every group box, leaving room for the boundary label above group labels.
  let boundary = view.kind === 'c4_context' ? undefined : fitBoundary(storedBoundary, internalNodes.map((node) => node.rect))
  // Context nodes without a saved position line up by arrow direction: senders left of the boundary, receivers right of it.
  const contextElements = [...siblings, ...external]
  const roleRelationships = projectRelationships(project, view, [...internal, ...contextElements])
  const roleOf = (id: string) => {
    const outgoing = roleRelationships.some((relationship) => relationship.sourceId === id)
    const incoming = roleRelationships.some((relationship) => relationship.targetId === id)
    return incoming && !outgoing ? 'sink' : 'source'
  }
  const placed: Rect[] = internalNodes.map((node) => node.rect)
  const anchor = boundary ?? union(placed) ?? { x: 340, y: 100, width: size.width, height: size.height }
  const fallbackContext = (element: Element, placement: Placement): Rect => {
    const stored = positions[element.id]
    if (stored) return { ...stored, ...size }
    const distance = placement === 'external' && view.kind === 'c4_component' ? size.width + 96 + 40 : size.width + 48
    const x = roleOf(element.id) === 'sink' ? anchor.x + anchor.width + distance - size.width : anchor.x - distance
    let y = anchor.y
    while (placed.some((rect) => overlaps({ x, y, ...size }, rect, 12))) y += size.height + 24
    const rect = { x: Math.max(8, x), y, ...size }
    placed.push(rect)
    return rect
  }
  const contextNode = (element: Element, placement: Placement): RenderNode => ({
    id: element.id,
    element,
    rect: fallbackContext(element, placement),
    token: tokenFor(theme, element, true),
    tokenKey: 'externalContext',
    isExternal: true,
    placement,
  })
  const siblingNodes = siblings.map((element) => contextNode(element, 'sibling'))
  const externalNodes = external.map((element) => contextNode(element, 'external'))
  const nodes = [...internalNodes, ...siblingNodes, ...externalNodes]
  if (boundary) groups.forEach((group) => { boundary = expandBoundaryToContain(boundary!, { ...group.rect, y: group.rect.y - 8, height: group.rect.height + 8 }) })
  if (boundary) {
    // Reserve space for the bottom-right boundary label.
    const lowest = Math.max(...internalNodes.map((node) => node.rect.y + node.rect.height), ...groups.map((group) => group.rect.y + group.rect.height), 0)
    if (lowest && boundary.y + boundary.height < lowest + 44) boundary = { ...boundary, height: lowest + 44 - boundary.y }
  }
  // Component views nest the scope boundary inside its software system's boundary, which also holds sibling containers.
  const outerBoundary = boundary && view.kind === 'c4_component' ? fitOuterBoundary(boundary, siblingNodes.map((node) => node.rect)) : undefined
  const relationships = projectRelationships(project, view, nodes.map((node) => node.element))
  const rectById = new Map(nodes.map((node) => [node.id, node.rect]))
  // Relationships that stop at the scope itself are not drawn; they only place their other end left or right (arrange) and feed the checks.
  const routes = routeEdges(relationships.filter((relationship) => !relationship.boundaryEnd && rectById.has(relationship.sourceId) && rectById.has(relationship.targetId)).map((relationship) => ({
    id: relationship.id,
    sourceId: relationship.sourceId,
    targetId: relationship.targetId,
    source: rectById.get(relationship.sourceId)!,
    target: rectById.get(relationship.targetId)!,
  })), view.kind.startsWith('dfd_') ? 'sides' : 'free')
  const routeById = new Map(routes.map((route) => [route.id, route]))
  const edges: RenderEdge[] = relationships.filter((relationship) => routeById.has(relationship.id)).map((relationship) => ({ id: relationship.id, relationship, route: routeById.get(relationship.id)! }))
  const legend = buildLegend(nodes, edges, boundary, outerBoundary, groups, labels)
  const content = union([
    ...nodes.map((node) => node.rect),
    ...(boundary ? [boundary] : []),
    ...(outerBoundary ? [outerBoundary] : []),
    ...groups.map((group) => group.rect),
    ...edges.flatMap((edge) => edge.route.points.map((point) => ({ x: point.x, y: point.y, width: 1, height: 1 }))),
  ]) ?? { x: 0, y: 0, width: 0, height: 0 }
  const legendWidth = legendBoxWidth(legend)
  const frameTop = content.y + content.height + 32
  const width = Math.max(CANVAS_MIN_WIDTH, content.x + content.width + 80, content.x + 380 + 40 + legendWidth + 80)
  const height = Math.max(CANVAS_MIN_HEIGHT, frameTop + Math.max(FRAME_HEIGHT, legendBoxHeight(legend)) + 40)
  return { project, view, theme, labels, nodes, edges, groups, boundary, outerBoundary, legend, size: { width, height } }
}

export { fitOuterBoundary } from './layout'

function buildGroups(project: Project, view: DiagramView, nodes: RenderNode[]): RenderGroup[] {
  const groups = Object.values(project.groups).filter((group) => group.scopeId === view.scopeId)
  if (!groups.length) return []
  const byId = new Map(groups.map((group) => [group.id, group]))
  const depthOf = (group: Group): number => (group.parentGroupId && byId.has(group.parentGroupId) ? depthOf(byId.get(group.parentGroupId)!) + 1 : 0)
  const rects = new Map<string, Rect>()
  const rectOf = (group: Group, visiting = new Set<string>()): Rect | undefined => {
    if (rects.has(group.id)) return rects.get(group.id)
    if (visiting.has(group.id)) return undefined
    visiting.add(group.id)
    const members = nodes.filter((node) => node.element.groupId === group.id).map((node) => node.rect)
    const children = groups.filter((child) => child.parentGroupId === group.id).map((child) => rectOf(child, visiting)).filter((rect): rect is Rect => Boolean(rect))
    const all = union([...members, ...children])
    if (!all) return undefined
    const rect = pad(all, 18)
    rect.y -= 14
    rect.height += 14
    rects.set(group.id, rect)
    return rect
  }
  return groups
    .map((group) => ({ group, rect: rectOf(group) }))
    .filter((item): item is { group: Group; rect: Rect } => Boolean(item.rect))
    .map(({ group, rect }) => ({ id: group.id, group, rect, depth: depthOf(group) }))
    .sort((a, b) => a.depth - b.depth)
}

function buildLegend(nodes: RenderNode[], edges: RenderEdge[], boundary: Rect | undefined, outerBoundary: Rect | undefined, groups: RenderGroup[], labels: RenderLabels): LegendEntry[] {
  const entries: LegendEntry[] = []
  const seen = new Set<string>()
  nodes.filter((node) => !node.isExternal).forEach((node) => {
    const appKind = node.tokenKey === 'containerApplication' ? node.element.applicationKind : undefined
    const key = appKind ? `${node.tokenKey}:${appKind}` : node.tokenKey
    if (seen.has(key)) return
    seen.add(key)
    const label = appKind ? labels.legend.applicationKinds[appKind] ?? labels.legend.kinds[node.tokenKey] : labels.legend.kinds[node.tokenKey]
    entries.push({ id: key, label, swatch: { kind: 'node', token: node.token } })
  })
  const viewNode = nodes.find((node) => !node.isExternal && node.element.kind === 'entity' && isViewStorage(node.element))
  if (viewNode) entries.push({ id: 'entityView', label: labels.legend.entityView, swatch: { kind: 'node', token: viewNode.token, dashed: true } })
  if (nodes.some((node) => node.isExternal)) entries.push({ id: 'externalContext', label: labels.legend.externalContext, swatch: { kind: 'node', token: nodes.find((node) => node.isExternal)!.token } })
  const erdKinds = [...new Set(edges.map((edge) => edge.relationship.erd?.kind).filter((kind): kind is ErdRelationshipKind => Boolean(kind)))]
  erdKinds.forEach((kind) => entries.push({ id: `erd:${kind}`, label: labels.legend.erdKinds[kind], swatch: { kind: 'edge', projected: false, erdKind: kind } }))
  if (edges.some((edge) => !edge.relationship.projected && !edge.relationship.erd)) entries.push({ id: 'relationship', label: labels.legend.relationship, swatch: { kind: 'edge', projected: false } })
  if (edges.some((edge) => edge.relationship.projected)) entries.push({ id: 'projected', label: labels.legend.projectedRelationship, swatch: { kind: 'edge', projected: true } })
  if (boundary) entries.push({ id: 'boundary', label: labels.legend.boundary, swatch: { kind: 'boundary' } })
  if (outerBoundary) entries.push({ id: 'outerBoundary', label: labels.legend.outerBoundary, swatch: { kind: 'outerBoundary' } })
  if (groups.length) entries.push({ id: 'group', label: labels.legend.group, swatch: { kind: 'group' } })
  return entries
}

function legendBoxWidth(legend: LegendEntry[]) {
  const longest = Math.max(12, ...legend.map((entry) => entry.label.length))
  return Math.min(320, 56 + longest * 6.4)
}

function legendBoxHeight(legend: LegendEntry[]) {
  return 30 + legend.length * LEGEND_ROW
}

// ---------- SVG ----------

export interface SvgOptions {
  /** inline: title block and legend drawn inside the drawing; none: caller draws overlays. */
  frame: 'inline' | 'none'
  background: boolean
  selectedIds?: Set<string>
  interactive?: boolean
  fontFamily?: string
}

export function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)
}

export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  const push = () => { if (current) lines.push(current); current = '' }
  const isCjk = (value: string) => /[　-鿿＀-￯]/.test(value)
  if (words.length === 1 && isCjk(words[0])) {
    const chars = [...words[0]]
    const perLine = Math.max(4, Math.floor(maxChars / 2))
    for (let i = 0; i < chars.length; i += perLine) lines.push(chars.slice(i, i + perLine).join(''))
  } else {
    words.forEach((word) => {
      const width = (value: string) => [...value].reduce((sum, char) => sum + (isCjk(char) ? 2 : 1), 0)
      if (width(`${current} ${word}`.trim()) > maxChars) push()
      current = `${current} ${word}`.trim()
      while (width(current) > maxChars) {
        const chars = [...current]
        let cut = chars.length
        while (cut > 0 && width(chars.slice(0, cut).join('')) > maxChars) cut -= 1
        lines.push(chars.slice(0, cut).join(''))
        current = chars.slice(cut).join('')
      }
    })
    push()
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${[...kept[maxLines - 1]].slice(0, Math.max(1, maxChars - 1)).join('')}…`
    return kept
  }
  return lines
}

export function renderSvg(model: RenderModel, options: SvgOptions): string {
  const { theme } = model
  const font = options.fontFamily ?? 'Inter, "Noto Sans JP", "Hiragino Sans", system-ui, sans-serif'
  const inlineFrame = options.frame === 'inline' ? renderFrame(model) : ''
  const width = model.size.width
  const height = model.size.height
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${escapeXml(font)}">`)
  parts.push(`<defs>
<marker id="c4-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 z" fill="${theme.edge.stroke}"/></marker>
<marker id="c4-arrow-hollow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0.5,0.5 L9.5,5 L0.5,9.5 z" fill="${theme.background}" stroke="${theme.edge.projectedStroke}" stroke-width="1.2"/></marker>
${erdMarkerDefs(theme)}
</defs>`)
  if (options.background) parts.push(`<rect width="100%" height="100%" fill="${theme.background}"/>`)
  if (model.outerBoundary) {
    const o = model.outerBoundary
    const labelY = o.y + o.height - (model.labels.outerBoundaryKind ? 24 : 14)
    parts.push(`<g data-role="outer-boundary"><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="18" fill="${theme.boundary.fill}" stroke="${theme.boundary.stroke}" stroke-width="1.2" opacity="0.9"/><text x="${o.x + 16}" y="${labelY}" fill="${theme.boundary.text}" font-size="13" font-weight="700">${escapeXml(model.labels.outerBoundary ?? '')}</text>${model.labels.outerBoundaryKind ? `<text x="${o.x + 16}" y="${labelY + 13}" fill="${theme.boundary.text}" font-size="9.5" opacity="0.8">${escapeXml(model.labels.outerBoundaryKind)}</text>` : ''}</g>`)
  }
  if (model.boundary) {
    const b = model.boundary
    // C4 style: the boundary is named at its bottom-left corner, kind tag beneath the name.
    const labelX = b.x + 16
    const labelY = b.y + b.height - (model.labels.boundaryKind ? 24 : 14)
    parts.push(`<g data-role="boundary"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="14" fill="${theme.boundary.fill}" stroke="${theme.boundary.stroke}" stroke-width="1.6"/><text x="${labelX}" y="${labelY}" fill="${theme.boundary.text}" font-size="13" font-weight="700">${escapeXml(model.labels.boundary)}</text>${model.labels.boundaryKind ? `<text x="${labelX}" y="${labelY + 13}" fill="${theme.boundary.text}" font-size="9.5" opacity="0.8">${escapeXml(model.labels.boundaryKind)}</text>` : ''}</g>`)
  }
  model.groups.forEach((group) => {
    const r = group.rect
    const tint = group.group.color ?? theme.group.fill
    parts.push(`<g data-role="group" data-group-id="${escapeXml(group.id)}"><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="10" fill="${tint}" fill-opacity="${group.group.color ? 0.12 : 1}" stroke="${theme.group.stroke}" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${r.x + 10}" y="${r.y + 15}" fill="${theme.group.text}" font-size="11" font-weight="700">${escapeXml(group.group.name)}</text></g>`)
  })
  model.edges.forEach((edge) => {
    const erd = edge.relationship.erd
    const stroke = edge.relationship.projected ? theme.edge.projectedStroke : theme.edge.stroke
    const marker = erd ? ERD_MARKERS[erd.kind] : edge.relationship.projected ? 'c4-arrow-hollow' : 'c4-arrow'
    const dash = erd?.kind === 'label' ? ' stroke-dasharray="6 4"' : ''
    const labelLines = edge.relationship.label.split('\n').filter(Boolean)
    const technology = !erd && edge.relationship.technology ? `[${edge.relationship.technology}]` : ''
    const lines = technology ? [...labelLines, technology] : labelLines
    const at = edge.route.labelAt
    const lineCount = Math.max(1, lines.length)
    const labelWidth = Math.max(...lines.map((line) => line.length), 4) * 6.2 + 12
    const selected = edge.relationship.mergedIds.some((id) => options.selectedIds?.has(id))
    parts.push(`<g data-role="edge" data-edge-id="${escapeXml(edge.id)}"${options.interactive ? ' style="cursor:pointer"' : ''}>`)
    parts.push(`<path d="${pathData(edge.route.points)}" fill="none" stroke="${selected ? '#2563eb' : stroke}" stroke-width="${selected ? 2.4 : 1.5}"${dash}${marker ? ` marker-end="url(#${marker})"` : ''}/>`)
    if (options.interactive) parts.push(`<path d="${pathData(edge.route.points)}" fill="none" stroke="transparent" stroke-width="14"/>`)
    // UML multiplicity at both ends (term: erd-notation); label kind carries none.
    if (erd && erd.kind !== 'label') {
      const points = edge.route.points
      const sourceAt = endLabelAt(points[0], points[1], 18)
      const targetAt = endLabelAt(points[points.length - 1], points[points.length - 2], 26)
      ;[[sourceAt, erd.sourceCardinality], [targetAt, erd.targetCardinality]].forEach(([at, text]) => {
        const position = at as { x: number; y: number; anchor: string }
        parts.push(`<text x="${position.x}" y="${position.y}" text-anchor="${position.anchor}" fill="${theme.edge.text}" font-size="10" font-weight="600">${escapeXml(String(text))}</text>`)
      })
    }
    if (lines.length) {
      const top = at.y - 8 - (lineCount - 1) * 6
      parts.push(`<rect x="${at.x - labelWidth / 2}" y="${top}" width="${labelWidth}" height="${14 + (lineCount - 1) * 12}" rx="3" fill="${theme.background}" fill-opacity="0.92"/>`)
      lines.forEach((line, index) => {
        const isTechnology = technology && index === lines.length - 1
        parts.push(`<text x="${at.x}" y="${top + 11 + index * 12}" text-anchor="middle" fill="${theme.edge.text}" font-size="${isTechnology ? 9.5 : 10.5}"${isTechnology ? ' opacity="0.8"' : ''}>${escapeXml(line)}</text>`)
      })
    }
    parts.push('</g>')
  })
  model.nodes.forEach((node) => parts.push(renderNode(model, node, options)))
  parts.push(inlineFrame)
  parts.push('</svg>')
  return parts.join('\n')
}

const ERD_MARKERS: Record<ErdRelationshipKind, string | undefined> = { reference: 'erd-open', dependent: 'erd-diamond', inherit: 'erd-triangle', label: undefined }

function erdMarkerDefs(theme: Theme) {
  return [
    `<marker id="erd-open" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L11,6 L1,11" fill="none" stroke="${theme.edge.stroke}" stroke-width="1.4"/></marker>`,
    `<marker id="erd-triangle" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L13,7 L1,13 z" fill="${theme.background}" stroke="${theme.edge.stroke}" stroke-width="1.4"/></marker>`,
    `<marker id="erd-diamond" markerWidth="16" markerHeight="12" refX="15" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,6 L8,1 L15,6 L8,11 z" fill="${theme.edge.stroke}" stroke="${theme.edge.stroke}" stroke-width="1"/></marker>`,
  ].join('\n')
}

/** A multiplicity label sits a little way along the edge from its port, beside the line rather than on it. */
function endLabelAt(port: Position, next: Position, distance: number): { x: number; y: number; anchor: 'start' | 'end' | 'middle' } {
  const dx = next.x - port.x
  const dy = next.y - port.y
  const length = Math.hypot(dx, dy) || 1
  const along = Math.min(distance, length / 2)
  const x = port.x + (dx / length) * along
  const y = port.y + (dy / length) * along
  if (Math.abs(dx) >= Math.abs(dy)) return { x, y: y - 5, anchor: 'middle' }
  return { x: x + 6, y: y + 4, anchor: 'start' }
}

function shapePath(shape: Token['shape'], r: Rect): string {
  if (shape === 'cylinder') {
    const ry = 10
    return `M ${r.x} ${r.y + ry} a ${r.width / 2} ${ry} 0 0 1 ${r.width} 0 v ${r.height - ry * 2} a ${r.width / 2} ${ry} 0 0 1 -${r.width} 0 z`
  }
  if (shape === 'horizontal_cylinder') {
    const rx = 10
    return `M ${r.x + rx} ${r.y} h ${r.width - rx * 2} a ${rx} ${r.height / 2} 0 0 1 0 ${r.height} h -${r.width - rx * 2} a ${rx} ${r.height / 2} 0 0 1 0 -${r.height} z`
  }
  if (shape === 'bucket') {
    // Slightly narrower at the bottom with an elliptical rim.
    const ry = 8
    const inset = Math.min(18, r.width * 0.08)
    return `M ${r.x} ${r.y + ry} a ${r.width / 2} ${ry} 0 0 1 ${r.width} 0 L ${r.x + r.width - inset} ${r.y + r.height - ry} a ${r.width / 2 - inset} ${ry} 0 0 1 -${r.width - inset * 2} 0 z`
  }
  if (shape === 'browser_window' || shape === 'desktop_window') {
    const c = Math.min(10, r.height / 2)
    return `M ${r.x + c} ${r.y} h ${r.width - c * 2} a ${c} ${c} 0 0 1 ${c} ${c} v ${r.height - c * 2} a ${c} ${c} 0 0 1 -${c} ${c} h -${r.width - c * 2} a ${c} ${c} 0 0 1 -${c} -${c} v -${r.height - c * 2} a ${c} ${c} 0 0 1 ${c} -${c} z`
  }
  if (shape === 'mobile_device') {
    const c = Math.min(16, r.height / 2)
    return `M ${r.x + c} ${r.y} h ${r.width - c * 2} a ${c} ${c} 0 0 1 ${c} ${c} v ${r.height - c * 2} a ${c} ${c} 0 0 1 -${c} ${c} h -${r.width - c * 2} a ${c} ${c} 0 0 1 -${c} -${c} v -${r.height - c * 2} a ${c} ${c} 0 0 1 ${c} -${c} z`
  }
  if (shape === 'folder') {
    const tab = 12
    const tabWidth = Math.min(70, r.width * 0.35)
    return `M ${r.x} ${r.y + tab} v ${r.height - tab - 6} a 6 6 0 0 0 6 6 h ${r.width - 12} a 6 6 0 0 0 6 -6 v -${r.height - tab - 12} a 6 6 0 0 0 -6 -6 h -${r.width - tabWidth - 6} l -8 -${tab - 4} h -${tabWidth - 14} a 6 6 0 0 0 -6 6 z`
  }
  return ''
}

function renderNode(model: RenderModel, node: RenderNode, options: SvgOptions): string {
  const { rect: r, token, element } = node
  const selected = options.selectedIds?.has(node.id)
  const mode = model.view.displayMode
  if (token.shape === 'card') return renderEntityCard(model, node, options)
  const parts: string[] = []
  parts.push(`<g data-role="node" data-node-id="${escapeXml(node.id)}"${options.interactive ? ' style="cursor:grab"' : ''}>`)
  const strokeWidth = selected ? 3 : 1.4
  const stroke = selected ? '#2563eb' : token.stroke
  let textTop = r.y
  if (token.shape === 'person_figure') {
    const headR = 16
    const bodyY = r.y + headR * 2 - 6
    parts.push(`<circle cx="${r.x + r.width / 2}" cy="${r.y + headR}" r="${headR}" fill="${token.fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
    parts.push(`<rect x="${r.x}" y="${bodyY}" width="${r.width}" height="${r.height - (bodyY - r.y)}" rx="12" fill="${token.fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
    textTop = bodyY
  } else if (token.shape === 'browser_window' || token.shape === 'desktop_window') {
    const bar = 18
    parts.push(`<path d="${shapePath(token.shape, r)}" fill="${token.fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
    parts.push(`<path d="M ${r.x} ${r.y + bar} h ${r.width}" stroke="${token.subtext}" stroke-width="1" opacity="0.7"/>`)
    if (token.shape === 'browser_window') {
      ;[0, 1, 2].forEach((index) => parts.push(`<circle cx="${r.x + 12 + index * 10}" cy="${r.y + bar / 2}" r="3" fill="${token.subtext}" opacity="0.85"/>`))
      parts.push(`<rect x="${r.x + 44}" y="${r.y + 5}" width="${r.width - 56}" height="${bar - 10}" rx="3" fill="${token.subtext}" opacity="0.35"/>`)
    } else {
      parts.push(`<rect x="${r.x + 8}" y="${r.y + 6}" width="${bar - 12}" height="${bar - 12}" fill="${token.subtext}" opacity="0.85"/>`)
    }
    textTop = r.y + bar - 2
  } else if (token.shape === 'mobile_device') {
    parts.push(`<path d="${shapePath(token.shape, r)}" fill="${token.fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
    parts.push(`<rect x="${r.x + r.width / 2 - 18}" y="${r.y + 6}" width="36" height="4" rx="2" fill="${token.subtext}" opacity="0.8"/>`)
    parts.push(`<rect x="${r.x + r.width / 2 - 14}" y="${r.y + r.height - 9}" width="28" height="3" rx="1.5" fill="${token.subtext}" opacity="0.8"/>`)
    textTop = r.y + 8
  } else if (token.shape === 'cylinder' || token.shape === 'horizontal_cylinder' || token.shape === 'bucket' || token.shape === 'folder') {
    parts.push(`<path d="${shapePath(token.shape, r)}" fill="${token.fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
    if (token.shape === 'cylinder') parts.push(`<ellipse cx="${r.x + r.width / 2}" cy="${r.y + 10}" rx="${r.width / 2}" ry="10" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
    if (token.shape === 'bucket') parts.push(`<ellipse cx="${r.x + r.width / 2}" cy="${r.y + 8}" rx="${r.width / 2}" ry="8" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
    if (token.shape === 'horizontal_cylinder') parts.push(`<ellipse cx="${r.x + r.width - 10}" cy="${r.y + r.height / 2}" rx="10" ry="${r.height / 2}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
    textTop = r.y + (token.shape === 'cylinder' || token.shape === 'bucket' ? 8 : token.shape === 'folder' ? 6 : 0)
  } else {
    parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${token.shape === 'box' ? 2 : 10}" fill="${token.fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
  }
  // Corner icon (framed shapes carry their own chrome). The terminal prompt is drawn larger, like the official backend picture.
  if (token.icon === 'terminal') parts.push(`<text x="${r.x + 12}" y="${r.y + 22}" fill="${token.text}" font-size="16" font-weight="700" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" opacity="0.9">&gt;_</text>`)
  else if (token.icon !== 'none') parts.push(iconSvg(token.icon, r.x + 10, textTop + 9, token.text))
  const textX = r.x + r.width / 2
  const nameLines = wrapText(element.name, 28, 2)
  const kindLabel = model.labels.kind(element, node.isExternal)
  const technology = element.technology.trim()
  const kindLine = mode === 'compact' || !technology ? kindLabel : `${kindLabel} [${technology}]`
  let y = textTop + 24
  nameLines.forEach((line) => {
    parts.push(`<text x="${textX}" y="${y}" text-anchor="middle" fill="${token.text}" font-size="13" font-weight="700">${escapeXml(line)}</text>`)
    y += 15
  })
  parts.push(`<text x="${textX}" y="${y}" text-anchor="middle" fill="${token.subtext}" font-size="9.5" letter-spacing="0.3">${escapeXml(kindLine)}</text>`)
  y += 14
  if (mode === 'descriptive' && element.description.trim()) {
    const available = Math.max(1, Math.floor((r.y + r.height - 8 - y) / 12))
    wrapText(element.description, 34, Math.min(3, available)).forEach((line) => {
      parts.push(`<text x="${r.x + 12}" y="${y}" fill="${token.subtext}" font-size="10">${escapeXml(line)}</text>`)
      y += 12
    })
  }
  parts.push('</g>')
  return parts.join('')
}

/**
 * Entity card: a header band with the name and kind tag over a body that shows, by display mode, the
 * description (descriptive), the important attribute rows (fields), or the field count (compact).
 */
function renderEntityCard(model: RenderModel, node: RenderNode, options: SvgOptions): string {
  const { rect: r, token, element } = node
  const { theme } = model
  const selected = options.selectedIds?.has(node.id)
  // Context entities outside the boundary stay collapsed (rule: external-context-boundary).
  const mode = node.isExternal ? 'compact' : model.view.displayMode
  const strokeWidth = selected ? 3 : 1.4
  const stroke = selected ? '#2563eb' : token.stroke
  const dependents = dependentsOf(model.project, element.id).length
  const parts: string[] = []
  parts.push(`<g data-role="node" data-node-id="${escapeXml(node.id)}"${options.interactive ? ' style="cursor:grab"' : ''}>`)
  // Views and materialized views are derived, so their outline is dashed (rule: diagram-styles).
  const dashed = isViewStorage(element) ? ' stroke-dasharray="6 4"' : ''
  parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="4" fill="${theme.background}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashed}/>`)
  parts.push(`<path d="M ${r.x} ${r.y + 4} a 4 4 0 0 1 4 -4 h ${r.width - 8} a 4 4 0 0 1 4 4 v ${CARD_HEADER - 4} h -${r.width} z" fill="${token.fill}"/>`)
  parts.push(`<path d="M ${r.x} ${r.y + CARD_HEADER} h ${r.width}" stroke="${stroke}" stroke-width="1"/>`)
  parts.push(iconSvg(token.icon, r.x + 10, r.y + 15, token.text))
  // Dependent count badge: the owner card says how many tables hide behind it (term: erd-notation).
  if (dependents > 0) {
    const bx = r.x + r.width - 38
    parts.push(`<rect x="${bx}" y="${r.y + 6}" width="30" height="14" rx="7" fill="${token.stroke}" opacity="0.25"/>`)
    parts.push(iconSvg('table', bx + 5, r.y + 15, token.text))
    parts.push(`<text x="${bx + 24}" y="${r.y + 16.5}" text-anchor="end" fill="${token.text}" font-size="9.5" font-weight="700">${dependents}</text>`)
  }
  const textX = r.x + r.width / 2
  const nameLines = wrapText(element.name, Math.floor((r.width - 40 - (dependents ? 40 : 0)) / TITLE_UNIT), 1)
  parts.push(`<text x="${textX}" y="${r.y + 17}" text-anchor="middle" fill="${token.text}" font-size="13" font-weight="700">${escapeXml(nameLines[0] ?? '')}</text>`)
  const kindLabel = model.labels.kind(element, node.isExternal)
  const kindLine = mode === 'compact' ? kindLabel : `[${model.labels.storage(element)}] ${kindLabel}`
  parts.push(`<text x="${textX}" y="${r.y + 31}" text-anchor="middle" fill="${token.subtext}" font-size="9.5" letter-spacing="0.3">${escapeXml(kindLine)}</text>`)
  const attributes = element.attributes ?? []
  let y = r.y + CARD_HEADER + CARD_PADDING + 11
  if (mode === 'fields') {
    const { shown, references, hidden } = cardRows(element, model.project)
    shown.forEach((attribute) => {
      const keyed = attribute.primaryKey
      if (keyed) parts.push(iconSvg('key', r.x + 10, y + 1, token.subtext))
      parts.push(`<text x="${r.x + (keyed ? 26 : 14)}" y="${y}" fill="${token.text}" font-size="10.5"${keyed ? ' font-weight="700"' : ''}>${escapeXml(wrapText(attribute.name, rowChars(r.width, keyed, attribute.required), 1)[0] ?? '')}</text>`)
      if (attribute.required && !keyed) parts.push(`<text x="${r.x + r.width - 10}" y="${y}" text-anchor="end" fill="${token.subtext}" font-size="9">*</text>`)
      y += CARD_ROW
    })
    // Reference rows: a chain icon and the referenced entity, on the key holder's card (decision: reference-source-holds-key).
    references.forEach((row) => {
      parts.push(iconSvg('chain', r.x + 10, y + 1, token.subtext))
      parts.push(`<text x="${r.x + 26}" y="${y}" fill="${token.subtext}" font-size="10.5">${escapeXml(wrapText(referenceRowText(row), rowChars(r.width, true, false), 1)[0] ?? '')}</text>`)
      y += CARD_ROW
    })
    if (hidden > 0 || shown.length === 0) parts.push(`<text x="${r.x + 14}" y="${y}" fill="${token.subtext}" font-size="9.5" font-style="italic">${escapeXml(model.labels.moreFields(hidden))}</text>`)
  } else if (mode === 'descriptive' && element.description.trim()) {
    const available = Math.max(1, Math.floor((r.y + r.height - 6 - y) / 12) + 1)
    wrapText(element.description, Math.floor((r.width - 24) / 6), Math.min(4, available)).forEach((line) => {
      parts.push(`<text x="${r.x + 12}" y="${y}" fill="${token.subtext}" font-size="10">${escapeXml(line)}</text>`)
      y += 12
    })
  } else if (mode !== 'descriptive') {
    parts.push(`<text x="${textX}" y="${y}" text-anchor="middle" fill="${token.subtext}" font-size="9.5" font-style="italic">${escapeXml(model.labels.fieldCount(attributes.length))}</text>`)
  }
  parts.push('</g>')
  return parts.join('')
}

function iconSvg(icon: IconKind | 'key' | 'chain', x: number, y: number, color: string): string {
  const s = 12
  const attrs = `fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"`
  const glyph: Record<IconKind | 'key' | 'chain', string> = {
    person: `<circle cx="6" cy="4" r="2.4"/><path d="M1.5 11.5a4.5 4.5 0 0 1 9 0"/>`,
    external: `<path d="M7 1.5h3.5V5M10.5 1.5 5.5 6.5"/><path d="M9 7v3H1.5V3H5"/>`,
    database: `<ellipse cx="6" cy="3" rx="4.5" ry="1.8"/><path d="M1.5 3v6c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V3"/>`,
    schema: `<ellipse cx="6" cy="3" rx="4.5" ry="1.8"/><path d="M1.5 3v6c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V3M3 7.5h6"/>`,
    queue: `<rect x="1" y="3" width="10" height="6" rx="3"/><path d="M8 3v6"/>`,
    bucket: `<ellipse cx="6" cy="2.5" rx="4.5" ry="1.5"/><path d="M1.5 2.5 3 10.5h6l1.5-8"/>`,
    cache: `<path d="M7 1 2.5 7h3.5l-1 4L9.5 5H6z"/>`,
    folder: `<path d="M1.5 3.5h3l1.5 1.5h4.5v5.5h-9z"/>`,
    terminal: `<path d="M2 3 5.5 6 2 9M6.5 9.5H10"/>`,
    gear: `<circle cx="6" cy="6" r="2"/><path d="M6 1.5v1.5M6 9v1.5M1.5 6H3M9 6h1.5M2.8 2.8l1 1M8.2 8.2l1 1M2.8 9.2l1-1M8.2 3.8l1-1"/>`,
    store: `<rect x="1.5" y="2" width="9" height="8" rx="1.5"/><path d="M1.5 5h9"/>`,
    system: `<rect x="1.5" y="1.5" width="9" height="9" rx="1.5"/><path d="M4 6h4M6 4v4"/>`,
    container: `<rect x="1.5" y="2.5" width="9" height="7" rx="1.5"/><path d="M1.5 5h9"/>`,
    component: `<rect x="3" y="1.5" width="7.5" height="9" rx="1.2"/><path d="M1.5 4h3M1.5 7h3"/>`,
    table: `<rect x="1.5" y="2" width="9" height="8" rx="1"/><path d="M1.5 5h9M5 5v5"/>`,
    key: `<circle cx="4" cy="6" r="2.2"/><path d="M6.2 6h4.3M9 6v2M7.5 6v1.5"/>`,
    chain: `<path d="M5 7.5a2 2 0 0 0 2.8.2l1.5-1.5a2 2 0 0 0-2.8-2.8l-.6.6"/><path d="M7 4.5a2 2 0 0 0-2.8-.2L2.7 5.8a2 2 0 0 0 2.8 2.8l.6-.6"/>`,
    none: '',
  }
  if (!glyph[icon]) return ''
  return `<g transform="translate(${x} ${y - 6}) scale(${s / 12})" ${attrs}>${glyph[icon]}</g>`
}

export interface FramePlacement {
  title: Rect
  legend: Rect
}

export function framePlacement(model: RenderModel): FramePlacement {
  const content = union([...model.nodes.map((node) => node.rect), ...(model.boundary ? [model.boundary] : []), ...(model.outerBoundary ? [model.outerBoundary] : []), ...model.groups.map((group) => group.rect)]) ?? { x: 40, y: 40, width: 400, height: 200 }
  const top = content.y + content.height + 32
  const legendWidth = legendBoxWidth(model.legend)
  const legendHeight = legendBoxHeight(model.legend)
  const titleWidth = 380
  const legendX = Math.max(content.x + titleWidth + 40, content.x + content.width - legendWidth)
  return {
    title: { x: content.x, y: top, width: titleWidth, height: FRAME_HEIGHT },
    legend: { x: legendX, y: top, width: legendWidth, height: legendHeight },
  }
}

function renderFrame(model: RenderModel): string {
  const { theme, labels } = model
  const placement = framePlacement(model)
  const t = placement.title
  const parts: string[] = []
  parts.push(`<g data-role="title-block"><rect x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" rx="6" fill="${theme.frame.fill}" stroke="${theme.frame.stroke}"/>`)
  parts.push(`<text x="${t.x + 12}" y="${t.y + (labels.subtitle ? 19 : 27)}" fill="${theme.frame.text}" font-size="13" font-weight="700">${escapeXml(labels.title)}</text>`)
  if (labels.subtitle) parts.push(`<text x="${t.x + 12}" y="${t.y + 35}" fill="${theme.frame.subtext}" font-size="10">${escapeXml(labels.subtitle)}</text>`)
  parts.push('</g>')
  parts.push(renderLegend(model, placement.legend))
  return parts.join('')
}

/** Marker definitions the legend needs when drawn in its own SVG. */
export function markerDefs(theme: Theme): string {
  return `<marker id="c4-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 z" fill="${theme.edge.stroke}"/></marker><marker id="c4-arrow-hollow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0.5,0.5 L9.5,5 L0.5,9.5 z" fill="${theme.background}" stroke="${theme.edge.projectedStroke}"/></marker>${erdMarkerDefs(theme)}`
}

export function renderLegend(model: RenderModel, box: Rect): string {
  const { theme, labels } = model
  const parts: string[] = []
  parts.push(`<g data-role="legend"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="6" fill="${theme.frame.fill}" stroke="${theme.frame.stroke}"/>`)
  parts.push(`<text x="${box.x + 12}" y="${box.y + 17}" fill="${theme.frame.subtext}" font-size="9.5" font-weight="700" letter-spacing="0.8">${escapeXml(labels.legend.heading.toUpperCase())}</text>`)
  model.legend.forEach((entry, index) => {
    const y = box.y + 28 + index * LEGEND_ROW
    const sx = box.x + 12
    if (entry.swatch.kind === 'node') {
      const token = entry.swatch.token
      if (token.shape === 'cylinder') parts.push(`<path d="${shapePath('cylinder', { x: sx, y: y - 2, width: 22, height: 14 })}" fill="${token.fill}" stroke="${token.stroke}"/>`)
      else if (token.shape === 'horizontal_cylinder') parts.push(`<path d="${shapePath('horizontal_cylinder', { x: sx, y: y - 2, width: 22, height: 14 })}" fill="${token.fill}" stroke="${token.stroke}"/>`)
      else if (token.shape === 'browser_window' || token.shape === 'desktop_window' || token.shape === 'mobile_device') parts.push(`<path d="${shapePath(token.shape, { x: sx, y: y - 2, width: 22, height: 14 })}" fill="${token.fill}" stroke="${token.stroke}"/><path d="M ${sx} ${y + 3} h 22" stroke="${token.subtext}" stroke-width="1"/>`)
      else if (token.shape === 'bucket' || token.shape === 'folder') parts.push(`<path d="${shapePath(token.shape, { x: sx, y: y - 2, width: 22, height: 14 })}" fill="${token.fill}" stroke="${token.stroke}"/>`)
      else if (token.shape === 'person_figure') parts.push(`<circle cx="${sx + 11}" cy="${y + 1}" r="4" fill="${token.fill}" stroke="${token.stroke}"/><rect x="${sx + 3}" y="${y + 4}" width="16" height="8" rx="3" fill="${token.fill}" stroke="${token.stroke}"/>`)
      else parts.push(`<rect x="${sx}" y="${y - 2}" width="22" height="14" rx="3" fill="${token.fill}" stroke="${token.stroke}"${entry.swatch.dashed ? ' stroke-dasharray="4 3"' : ''}/>`)
    } else if (entry.swatch.kind === 'edge') {
      const stroke = entry.swatch.projected ? theme.edge.projectedStroke : theme.edge.stroke
      const erdKind = entry.swatch.erdKind
      const marker = erdKind ? ERD_MARKERS[erdKind] : entry.swatch.projected ? 'c4-arrow-hollow' : 'c4-arrow'
      const dashed = entry.swatch.boundary || erdKind === 'label'
      parts.push(`<path d="M ${sx} ${y + 5} L ${sx + 22} ${y + 5}" stroke="${stroke}" stroke-width="1.5"${dashed ? ' stroke-dasharray="4 3"' : ''}${marker ? ` marker-end="url(#${marker})"` : ''}/>`)
    } else if (entry.swatch.kind === 'boundary') {
      parts.push(`<rect x="${sx}" y="${y - 2}" width="22" height="14" rx="3" fill="${theme.boundary.fill}" stroke="${theme.boundary.stroke}"/>`)
    } else if (entry.swatch.kind === 'outerBoundary') {
      parts.push(`<rect x="${sx}" y="${y - 2}" width="22" height="14" rx="4" fill="${theme.boundary.fill}" stroke="${theme.boundary.stroke}" opacity="0.8"/><rect x="${sx + 6}" y="${y + 2}" width="12" height="7" rx="2" fill="none" stroke="${theme.boundary.stroke}"/>`)
    } else {
      parts.push(`<rect x="${sx}" y="${y - 2}" width="22" height="14" rx="3" fill="${theme.group.fill}" stroke="${theme.group.stroke}" stroke-dasharray="3 2"/>`)
    }
    parts.push(`<text x="${sx + 30}" y="${y + 9}" fill="${theme.frame.text}" font-size="10.5">${escapeXml(entry.label)}</text>`)
  })
  parts.push('</g>')
  return parts.join('')
}

export function nodeAt(model: RenderModel, id: string) {
  return model.nodes.find((node) => node.id === id)
}
