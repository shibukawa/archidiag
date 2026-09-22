import { cardRows, isViewStorage } from './model'
import { escapeXml, framePlacement, type RenderModel } from './render'

/** draw.io XML with nodes, edges, boundary, groups, and a locked title block and legend. */
export function buildDrawioXml(model: RenderModel): string {
  const { theme, labels } = model
  const parent = '1'
  const cells: string[] = []
  const attr = (value: string) => escapeXml(value).replace(/\n/g, '&#10;')
  if (model.outerBoundary) {
    const o = model.outerBoundary
    const value = `&lt;b&gt;${attr(labels.outerBoundary ?? '')}&lt;/b&gt;${labels.outerBoundaryKind ? `&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(labels.outerBoundaryKind)}&lt;/font&gt;` : ''}`
    cells.push(`<mxCell id="outer-boundary" value="${value}" style="rounded=1;whiteSpace=wrap;html=1;strokeColor=${theme.boundary.stroke};fillColor=none;fontColor=${theme.boundary.text};verticalAlign=bottom;align=left;spacingBottom=6;spacingLeft=12;" vertex="1" parent="${parent}"><mxGeometry x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" as="geometry"/></mxCell>`)
  }
  if (model.boundary) {
    const b = model.boundary
    const boundaryValue = `&lt;b&gt;${attr(labels.boundary)}&lt;/b&gt;${labels.boundaryKind ? `&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(labels.boundaryKind)}&lt;/font&gt;` : ''}`
    cells.push(`<mxCell id="boundary" value="${boundaryValue}" style="rounded=1;dashed=1;whiteSpace=wrap;html=1;strokeColor=${theme.boundary.stroke};fillColor=none;fontColor=${theme.boundary.text};verticalAlign=bottom;align=left;spacingBottom=6;spacingLeft=12;" vertex="1" parent="${parent}"><mxGeometry x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" as="geometry"/></mxCell>`)
  }
  model.groups.forEach((group) => {
    const r = group.rect
    cells.push(`<mxCell id="group-${attr(group.id)}" value="${attr(group.group.name)}" style="rounded=1;dashed=1;dashPattern=4 3;whiteSpace=wrap;html=1;strokeColor=${theme.group.stroke};fillColor=none;fontColor=${theme.group.text};verticalAlign=top;align=left;spacingLeft=8;fontSize=10;fontStyle=1;" vertex="1" parent="${parent}"><mxGeometry x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" as="geometry"/></mxCell>`)
  })
  model.processGroups.forEach((group) => {
    const r = group.rect
    const token = theme.tokens.dfdProcess
    cells.push(`<mxCell id="pgroup-${attr(group.id)}" value="&lt;b&gt;${attr(group.number)} ${attr(group.name)}&lt;/b&gt;" style="rounded=1;arcSize=6;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=${token.stroke};fillColor=${token.fill};opacity=12;fontColor=${token.stroke};verticalAlign=top;align=left;spacingLeft=8;spacingTop=4;fontSize=11;" vertex="1" parent="${parent}"><mxGeometry x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" as="geometry"/></mxCell>`)
  })
  model.regions.forEach((region) => {
    const r = region.rect
    const atomic = region.boundary.consistency === 'atomic'
    cells.push(`<mxCell id="region-${attr(region.id)}" value="&lt;b&gt;${attr(region.boundary.name)}&lt;/b&gt; · ${attr(labels.dfd.consistency[region.boundary.consistency])}" style="rounded=1;dashed=1;dashPattern=${atomic ? '7 4' : '3 4'};whiteSpace=wrap;html=1;strokeColor=${atomic ? '#2563eb' : '#d97706'};fillColor=none;fontColor=${atomic ? '#1d4ed8' : '#b45309'};verticalAlign=top;align=left;spacingLeft=8;fontSize=10;" vertex="1" parent="${parent}"><mxGeometry x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" as="geometry"/></mxCell>`)
  })
  model.nodes.forEach((node) => {
    const r = node.rect
    if (node.dfd) {
      // DFD node: draw.io's own process, note, step, and cylinder shapes stand in for the Gane-Sarson pictures.
      const info = node.dfd
      const shape = info.node.role === 'start' ? 'ellipse;' : info.node.role === 'process' ? 'shape=process;size=0.06;' : info.node.role === 'diagram_ref' ? 'shape=step;perimeter=stepPerimeter;size=0.12;' : node.token.shape === 'cylinder' ? 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;' : node.token.shape === 'horizontal_cylinder' ? 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;rotation=90;' : node.token.shape === 'folded_rect' ? 'shape=note;size=14;' : node.token.shape === 'open_rect' ? 'shape=partialRectangle;right=0;' : 'rounded=0;'
      const kind = info.node.elementId ? labels.kind(node.element, false) : info.node.role === 'intermediate_data' ? labels.dfd.intermediate[info.node.intermediateKind ?? 'file'] : labels.dfd.roles[info.node.role]
      const number = info.number ?? info.node.processNumber ? `${attr(info.number ?? info.node.processNumber ?? '')} · ` : ''
      const caption = info.node.role === 'diagram_ref' ? (info.refTarget ? labels.dfd.refTo(info.refTarget) : labels.dfd.missingRef) : kind
      const description = model.view.displayMode === 'descriptive' && node.element.description ? `&lt;div style=&quot;text-align:left;margin:4px 10px 0&quot;&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(node.element.description)}&lt;/font&gt;&lt;/div&gt;` : ''
      const value = `&lt;b&gt;${number}${attr(info.name)}&lt;/b&gt;&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(caption)}&lt;/font&gt;${description}`
      cells.push(`<mxCell id="${attr(node.id)}" value="${value}" style="${shape}whiteSpace=wrap;html=1;${info.free ? 'dashed=1;' : ''}strokeColor=${node.token.stroke};fillColor=${node.token.fill};fontColor=${node.token.text};" vertex="1" parent="${parent}"><mxGeometry x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" as="geometry"/></mxCell>`)
      return
    }
    if (node.token.shape === 'card') {
      // Entity card: header line plus the same rows the canvas draws for the view's display mode.
      const attributes = node.element.attributes ?? []
      const { shown, references, hidden } = cardRows(node.element, model.project)
      const kindLine = (model.view.displayMode !== 'compact' ? `[${labels.storage(node.element)}] ` : '') + labels.kind(node.element, node.isExternal)
      const body = model.view.displayMode === 'fields'
        ? [...shown.map((attribute) => `${attribute.primaryKey ? '🔑 ' : ''}${attr(attribute.name)}`), ...references.map((row) => `🔗 ${attr(row.label ? `${row.targetName} · ${row.label}` : row.targetName)}`), ...(hidden > 0 || !shown.length ? [`&lt;i&gt;${attr(labels.moreFields(hidden))}&lt;/i&gt;`] : [])].join('&lt;br&gt;')
        : model.view.displayMode === 'descriptive' && node.element.description ? attr(node.element.description) : `&lt;i&gt;${attr(labels.fieldCount(attributes.length))}&lt;/i&gt;`
      const value = `&lt;b&gt;${attr(node.element.name)}&lt;/b&gt;&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(kindLine)}&lt;/font&gt;&lt;hr&gt;&lt;font style=&quot;font-size:10px&quot;&gt;${body}&lt;/font&gt;`
      cells.push(`<mxCell id="${attr(node.id)}" value="${value}" style="rounded=1;arcSize=4;whiteSpace=wrap;html=1;verticalAlign=top;align=left;spacingLeft=8;spacingTop=2;${isViewStorage(node.element) ? 'dashed=1;' : ''}strokeColor=${node.token.stroke};fillColor=${theme.background};fontColor=${node.token.text};" vertex="1" parent="${parent}"><mxGeometry x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" as="geometry"/></mxCell>`)
      return
    }
    const shapeStyle = node.token.shape === 'cylinder' ? 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;' : node.token.shape === 'horizontal_cylinder' ? 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;rotation=90;' : node.token.shape === 'person_figure' ? 'shape=mxgraph.c4.person;' : node.token.shape === 'bucket' ? 'shape=trapezoid;flipV=1;perimeter=trapezoidPerimeter;' : node.token.shape === 'browser_window' ? 'shape=mxgraph.mockup.containers.browserWindow;' : node.token.shape === 'mobile_device' ? 'shape=mxgraph.android.phone2;' : node.token.shape === 'desktop_window' ? 'shape=mxgraph.mockup.containers.window;' : node.token.shape === 'folder' ? 'shape=folder;' : 'rounded=1;'
    const kind = labels.kind(node.element, node.isExternal)
    const technology = node.element.technology ? ` [${node.element.technology}]` : ''
    const description = model.view.displayMode === 'descriptive' && node.element.description ? `&lt;div style=&quot;text-align:left;margin:4px 10px 0&quot;&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(node.element.description)}&lt;/font&gt;&lt;/div&gt;` : ''
    const value = `&lt;b&gt;${attr(node.element.name)}&lt;/b&gt;&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(kind + (model.view.displayMode === 'compact' ? '' : technology))}&lt;/font&gt;${description}`
    cells.push(`<mxCell id="${attr(node.id)}" value="${value}" style="${shapeStyle}whiteSpace=wrap;html=1;strokeColor=${node.token.stroke};fillColor=${node.token.fill};fontColor=${node.token.text};" vertex="1" parent="${parent}"><mxGeometry x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" as="geometry"/></mxCell>`)
  })
  model.edges.forEach((edge) => {
    const erd = edge.relationship.erd
    const labelText = edge.relationship.label.split('\n').map((line) => attr(line)).join('&lt;br&gt;')
    const payload = edge.payload ? `&lt;br&gt;&lt;i&gt;⟨${attr(edge.payload)}⟩&lt;/i&gt;` : ''
    const operations = edge.flow?.operations.length && edge.storeEnd ? `&lt;br&gt;&lt;b&gt;${attr(edge.flow.operations.join(''))}&lt;/b&gt;` : ''
    const label = erd
      ? (erd.kind === 'label' ? labelText : `${labelText}&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(erd.sourceCardinality)} → ${attr(erd.targetCardinality)}&lt;/font&gt;`)
      : `${labelText}${payload}${operations}${edge.relationship.technology ? `&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;[${attr(edge.relationship.technology)}]&lt;/font&gt;` : ''}`
    const erdStyle = erd ? ({ reference: 'endArrow=open;endFill=0;', inherit: 'endArrow=block;endFill=0;endSize=10;', dependent: 'endArrow=diamondThin;endFill=1;endSize=12;', label: 'endArrow=none;dashed=1;' } as const)[erd.kind] : ''
    const dashed = erd ? erdStyle : edge.relationship.projected ? 'endFill=0;' : ''
    const points = edge.route.points.slice(1, -1).map((point) => `<mxPoint x="${point.x}" y="${point.y}"/>`).join('')
    cells.push(`<mxCell id="edge-${attr(edge.id)}" value="${label}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=${theme.edge.stroke};fontColor=${theme.edge.text};fontSize=10;exitX=1;exitY=0.5;entryX=0;entryY=0.5;${dashed}" edge="1" parent="${parent}" source="${attr(edge.relationship.sourceId)}" target="${attr(edge.relationship.targetId)}"><mxGeometry relative="1" as="geometry"><Array as="points">${points}</Array></mxGeometry></mxCell>`)
  })
  const placement = framePlacement(model)
  const t = placement.title
  const subtitle = labels.subtitle ? `&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${attr(labels.subtitle)}&lt;/font&gt;` : ''
  cells.push(`<mxCell id="title-block" value="&lt;b&gt;${attr(labels.title)}&lt;/b&gt;${subtitle}" style="rounded=1;whiteSpace=wrap;html=1;align=left;spacingLeft=10;strokeColor=${theme.frame.stroke};fillColor=${theme.frame.fill};fontColor=${theme.frame.text};locked=1;" vertex="1" parent="${parent}"><mxGeometry x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" as="geometry"/></mxCell>`)
  const l = placement.legend
  const legendLines = model.legend.map((entry) => `• ${attr(entry.label)}`).join('&lt;br&gt;')
  cells.push(`<mxCell id="legend" value="&lt;b&gt;${attr(labels.legend.heading)}&lt;/b&gt;&lt;br&gt;${legendLines}" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=4;fontSize=10;strokeColor=${theme.frame.stroke};fillColor=${theme.frame.fill};fontColor=${theme.frame.text};locked=1;" vertex="1" parent="${parent}"><mxGeometry x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" as="geometry"/></mxCell>`)
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="c4sketch"><diagram name="${attr(labels.title)}"><mxGraphModel dx="${model.size.width}" dy="${model.size.height}" grid="1" gridSize="10" page="0" background="${theme.background}"><root><mxCell id="0"/><mxCell id="${parent}" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
}
