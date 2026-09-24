// CSV and Markdown renderings of catalog rows (requirement: project-catalogs export).

export type Cell = string | number | boolean | null | undefined

const text = (cell: Cell) => (cell === null || cell === undefined ? '' : typeof cell === 'boolean' ? (cell ? 'yes' : '') : String(cell))

/** RFC 4180: fields with commas, quotes, or line breaks are quoted, quotes doubled; CRLF line ends. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const field = (cell: Cell) => { const value = text(cell); return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value }
  return [headers, ...rows].map((row) => row.map(field).join(',')).join('\r\n') + '\r\n'
}

/** A GitHub-flavored Markdown table; pipes are escaped and line breaks folded. */
export function toMarkdown(headers: string[], rows: Cell[][]): string {
  const field = (cell: Cell) => text(cell).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  const lines = [`| ${headers.map(field).join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(field).join(' | ')} |`)]
  return `${lines.join('\n')}\n`
}
