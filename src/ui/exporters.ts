import { jsPDF } from 'jspdf'
import { buildDrawioXml } from '../core/drawio'
import { serializeProject } from '../core/io'
import type { Project } from '../core/model'
import { renderSvg, type RenderModel } from '../core/render'

export type ExportFormat = 'json' | 'svg' | 'png' | 'pdf' | 'drawio'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fileStem(project: Project, title: string) {
  return `${project.name}-${title}`.toLowerCase().replace(/[^a-z0-9぀-鿿]+/gi, '-').replace(/^-|-$/g, '')
}

async function rasterize(svg: string, width: number, height: number, scale = 2): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('Canvas unavailable'))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas)
    }
    image.onerror = () => reject(new Error('SVG render failed'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/** Exports one view. The SVG is the same markup the canvas draws, with the frame placed inline. */
export async function exportView(format: ExportFormat, project: Project, model: RenderModel, stem: string) {
  if (format === 'json') {
    downloadBlob(new Blob([serializeProject(project)], { type: 'application/json' }), `${project.name.toLowerCase().replace(/\s+/g, '-')}.json`)
    return
  }
  const svg = renderSvg(model, { frame: 'inline', background: true })
  if (format === 'svg') {
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${stem}.svg`)
    return
  }
  if (format === 'drawio') {
    downloadBlob(new Blob([buildDrawioXml(model)], { type: 'application/xml;charset=utf-8' }), `${stem}.drawio`)
    return
  }
  const canvas = await rasterize(svg, model.size.width, model.size.height)
  if (format === 'png') {
    await new Promise<void>((resolve, reject) => canvas.toBlob((blob) => (blob ? (downloadBlob(blob, `${stem}.png`), resolve()) : reject(new Error('PNG unavailable'))), 'image/png'))
    return
  }
  const pdf = new jsPDF({ orientation: model.size.width >= model.size.height ? 'landscape' : 'portrait', unit: 'pt', format: [model.size.width, model.size.height] })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, model.size.width, model.size.height)
  pdf.save(`${stem}.pdf`)
}
