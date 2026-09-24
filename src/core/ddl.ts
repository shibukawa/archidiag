// SQL DDL for one data store (requirement: sql-ddl-export). Domains are logical only: their canonical PostgreSQL
// type is substituted inline per dialect (data:sql-dialect-mapping), never emitted as a SQL DOMAIN.
import { componentType, formatType } from './domains'
import { entitiesOfStore, isErdStore, isViewStorage, type Attribute, type Element, type PrimitiveKind, type Project, type SqlDialect, type TypeSpec } from './model'
import { attributeName, bindName, formatIdentifier, termKey, toWords } from './vocabulary'

export type DdlIssueKind = 'unresolved_name' | 'untyped' | 'lossy'
export interface DdlIssue { kind: DdlIssueKind; message: string; elementId?: string; domainId?: string }
export interface DdlResult { sql: string; issues: DdlIssue[] }

interface Rendered { type: string; lossy: boolean }

/** One rule per canonical kind and dialect; lossy renderings keep the canonical type as a trailing comment. */
export function renderType(dialect: SqlDialect, type: TypeSpec): Rendered {
  const canonical = formatType(type)
  if (dialect === 'postgresql') return { type: canonical, lossy: false }
  const kind: PrimitiveKind = type.primitive
  if (dialect === 'sqlite') {
    const map: Record<PrimitiveKind, Rendered> = {
      smallint: { type: 'integer', lossy: false }, integer: { type: 'integer', lossy: false }, bigint: { type: 'integer', lossy: false },
      numeric: { type: 'numeric', lossy: Boolean(type.precision) }, real: { type: 'real', lossy: false }, double_precision: { type: 'real', lossy: false },
      varchar: { type: 'text', lossy: Boolean(type.length) }, text: { type: 'text', lossy: false }, bytea: { type: 'blob', lossy: false },
      date: { type: 'text', lossy: true }, time: { type: 'text', lossy: true }, timestamp: { type: 'text', lossy: true }, timestamptz: { type: 'text', lossy: true },
      boolean: { type: 'integer', lossy: true }, uuid: { type: 'text', lossy: true }, jsonb: { type: 'text', lossy: true },
    }
    return map[kind]
  }
  const map: Record<PrimitiveKind, Rendered> = {
    smallint: { type: 'smallint', lossy: false }, integer: { type: 'int', lossy: false }, bigint: { type: 'bigint', lossy: false },
    numeric: { type: type.precision ? `decimal(${type.precision}${type.scale !== undefined ? `,${type.scale}` : ''})` : 'decimal', lossy: false }, real: { type: 'float', lossy: false }, double_precision: { type: 'double', lossy: false },
    varchar: { type: `varchar(${type.length ?? 255})`, lossy: !type.length }, text: { type: 'text', lossy: false }, bytea: { type: 'longblob', lossy: false },
    date: { type: 'date', lossy: false }, time: { type: 'time', lossy: false }, timestamp: { type: 'datetime', lossy: false }, timestamptz: { type: 'datetime', lossy: true },
    boolean: { type: 'tinyint(1)', lossy: true }, uuid: { type: 'char(36)', lossy: true }, jsonb: { type: 'json', lossy: false },
  }
  return map[kind]
}

const RESERVED = new Set(['all', 'and', 'as', 'asc', 'between', 'by', 'case', 'check', 'column', 'constraint', 'create', 'cross', 'default', 'delete', 'desc', 'distinct', 'drop', 'else', 'end', 'exists', 'foreign', 'from', 'full', 'group', 'having', 'in', 'index', 'inner', 'insert', 'into', 'is', 'join', 'key', 'left', 'like', 'limit', 'not', 'null', 'offset', 'on', 'or', 'order', 'outer', 'primary', 'references', 'right', 'select', 'set', 'table', 'then', 'to', 'union', 'unique', 'update', 'user', 'using', 'values', 'when', 'where', 'with'])

function quote(dialect: SqlDialect, identifier: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(identifier) && !RESERVED.has(identifier)) return identifier
  return dialect === 'mysql' ? `\`${identifier.replace(/`/g, '``')}\`` : `"${identifier.replace(/"/g, '""')}"`
}

interface Column { name: string; type?: TypeSpec; notNull: boolean; domainName?: string; source: string }
interface Table { entity: Element; name: string; singular: string; columns: Column[]; primaryKey: string[]; unique: string[][]; foreignKeys: Array<{ columns: string[]; target: Table; targetColumns: string[]; cascade: boolean }> }

/** Physical name of a name: vocabulary first, else the typed words in the policy case, reported as unresolved. */
function physicalOf(project: Project, name: string, plural: boolean, report: (message: string) => void): string {
  const binding = bindName(project, name, plural)
  if (binding.physical) return binding.physical
  report(name)
  return formatIdentifier(toWords(name), project.settings.namingPolicy.identifierCase) || 'unnamed'
}

function attributeColumns(project: Project, attribute: Attribute, report: (message: string) => void, untyped: (domainName: string, domainId?: string) => void): Column[] {
  const name = attributeName(project, attribute)
  const base = physicalOf(project, name, false, report)
  const domain = attribute.domainId ? project.domains[attribute.domainId] : undefined
  const policy = project.settings.namingPolicy.identifierCase
  if (domain?.shape === 'multi_field' && domain.components?.length) {
    return domain.components.map((component) => {
      const suffix = physicalOf(project, component.name, false, report)
      const type = componentType(project, component)
      if (!type) untyped(`${domain.name}.${component.name}`, domain.id)
      return { name: formatIdentifier([...toWords(base), ...toWords(suffix)], policy), type, notNull: attribute.required || attribute.primaryKey || component.required && attribute.required, domainName: domain.name, source: name }
    })
  }
  const type = domain?.shape === 'single_field' ? domain.type : domain?.shape === 'code_set' ? domain.codeSet?.base : undefined
  if (!type) untyped(domain?.name ?? name, domain?.id)
  return [{ name: base, type, notNull: attribute.required || attribute.primaryKey, domainName: domain?.name, source: name }]
}

/** DDL for one database or schema container in its dialect (PostgreSQL when none is chosen). Deterministic. */
export function buildDdl(project: Project, storeId: string, dialectOverride?: SqlDialect): DdlResult {
  const store = project.elements[storeId]
  const issues: DdlIssue[] = []
  if (!store || !isErdStore(store)) return { sql: '', issues }
  const dialect = dialectOverride ?? store.sqlDialect ?? 'postgresql'
  const plural = project.settings.namingPolicy.tableNumber === 'plural'
  const unresolved = new Set<string>()
  const report = (name: string) => { if (!unresolved.has(name)) { unresolved.add(name); issues.push({ kind: 'unresolved_name', message: `${name}: physical name not derived from the vocabulary` }) } }
  const untypedSeen = new Set<string>()
  const untyped = (name: string, domainId?: string) => { if (!untypedSeen.has(name)) { untypedSeen.add(name); issues.push({ kind: 'untyped', message: `${name}: domain has no type`, domainId }) } }
  const entities = entitiesOfStore(project, storeId).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const views = entities.filter(isViewStorage)
  const tables = new Map<string, Table>()
  entities.filter((entity) => !isViewStorage(entity)).forEach((entity) => {
    const attributes = entity.attributes ?? []
    const columns = attributes.flatMap((attribute) => attributeColumns(project, attribute, report, untyped).map((column) => ({ ...column, attributeId: attribute.id })))
    const byAttribute = (attribute: Attribute) => columns.filter((column) => column.attributeId === attribute.id).map((column) => column.name)
    tables.set(entity.id, {
      entity,
      name: physicalOf(project, entity.name, plural, report),
      singular: bindName(project, entity.name).physical ?? formatIdentifier(toWords(entity.name), project.settings.namingPolicy.identifierCase),
      columns,
      primaryKey: attributes.filter((attribute) => attribute.primaryKey).flatMap(byAttribute),
      unique: attributes.filter((attribute) => attribute.unique && !attribute.primaryKey).map(byAttribute),
      foreignKeys: [],
    })
  })
  const relationships = Object.values(project.relationships).filter((relationship) => relationship.erd && tables.has(relationship.sourceId) && tables.has(relationship.targetId)).sort((a, b) => a.id.localeCompare(b.id))
  const policy = project.settings.namingPolicy.identifierCase
  // Inherit: the child copies the parent's non-key columns it does not already have.
  relationships.filter((relationship) => relationship.erd!.kind === 'inherit').forEach((relationship) => {
    const child = tables.get(relationship.sourceId)!
    const parent = tables.get(relationship.targetId)!
    parent.columns.filter((column) => !parent.primaryKey.includes(column.name) && !child.columns.some((other) => other.name === column.name)).forEach((column) => child.columns.push({ ...column }))
  })
  // References and dependents: the key holder gets the referenced primary key's columns, in order.
  relationships.filter((relationship) => relationship.erd!.kind === 'reference' || relationship.erd!.kind === 'dependent').forEach((relationship) => {
    const dependent = relationship.erd!.kind === 'dependent'
    const holder = tables.get(dependent ? relationship.targetId : relationship.sourceId)!
    const referenced = tables.get(dependent ? relationship.sourceId : relationship.targetId)!
    if (!referenced.primaryKey.length) return
    const optional = !dependent && (relationship.erd!.targetCardinality === '0..1' || relationship.erd!.targetCardinality === '*')
    const prefix = termKey(referenced.singular)
    let names = referenced.primaryKey.map((key) => (termKey(key).startsWith(prefix) ? key : formatIdentifier([...toWords(referenced.singular), ...toWords(key)], policy)))
    // A second key to the same table (shipping and billing address) gets its own columns, named by the relationship.
    if (holder.foreignKeys.some((key) => key.columns.some((column) => names.includes(column)))) {
      const role = toWords(relationship.label).length ? toWords(relationship.label) : [String(holder.foreignKeys.length + 1)]
      names = names.map((name) => formatIdentifier([...role, ...toWords(name)], policy))
    }
    names.forEach((name, index) => {
      if (holder.columns.some((column) => column.name === name)) return
      const keyColumn = referenced.columns.find((column) => column.name === referenced.primaryKey[index])
      holder.columns.push({ name, type: keyColumn?.type, notNull: !optional, domainName: keyColumn?.domainName, source: `${referenced.entity.name} key` })
    })
    holder.foreignKeys.push({ columns: names, target: referenced, targetColumns: referenced.primaryKey, cascade: dependent })
  })
  // Referenced tables first; a cycle falls back to name order with the remaining keys added afterwards.
  const ordered: Table[] = []
  const placed = new Set<string>()
  const pending = [...tables.values()]
  while (pending.length) {
    const ready = pending.find((table) => table.foreignKeys.every((key) => key.target === table || placed.has(key.target.entity.id)))
    const next = ready ?? pending[0]
    ordered.push(next)
    placed.add(next.entity.id)
    pending.splice(pending.indexOf(next), 1)
  }
  const q = (identifier: string) => quote(dialect, identifier)
  const lines: string[] = [`-- ${project.name} · ${store.name} · ${dialect}`, '-- Generated by C4Sketch. Column types come from data domains; domains are never emitted as SQL DOMAIN.']
  const created = new Set<string>()
  const deferred: string[] = []
  ordered.forEach((table) => {
    lines.push('')
    if (table.entity.description.trim()) table.entity.description.trim().split('\n').forEach((line) => lines.push(`-- ${line}`))
    const body: string[] = []
    table.columns.forEach((column) => {
      // MySQL cannot key a text column, so an untyped column falls back to varchar(255) there.
      let typeText = dialect === 'mysql' ? 'varchar(255)' : 'text'
      let comment = ''
      if (column.type) {
        const rendered = renderType(dialect, column.type)
        typeText = rendered.type
        if (rendered.lossy) {
          comment = ` -- ${formatType(column.type)}`
          issues.push({ kind: 'lossy', message: `${table.name}.${column.name}: ${formatType(column.type)} becomes ${rendered.type} in ${dialect}` })
        }
      } else comment = ` -- untyped domain ${column.domainName ?? column.source}`
      body.push(`  ${q(column.name)} ${typeText}${column.notNull ? ' NOT NULL' : ''}${comment ? ` ${comment}` : ''}`)
    })
    if (table.primaryKey.length) body.push(`  PRIMARY KEY (${table.primaryKey.map(q).join(', ')})`)
    table.unique.filter((columns) => columns.length).forEach((columns) => body.push(`  UNIQUE (${columns.map(q).join(', ')})`))
    table.foreignKeys.forEach((key) => {
      const clause = `FOREIGN KEY (${key.columns.map(q).join(', ')}) REFERENCES ${q(key.target.name)} (${key.targetColumns.map(q).join(', ')})${key.cascade ? ' ON DELETE CASCADE' : ''}`
      if (dialect === 'sqlite' || created.has(key.target.entity.id) || key.target === table) body.push(`  ${clause}`)
      else deferred.push(`ALTER TABLE ${q(table.name)} ADD ${clause};`)
    })
    lines.push(`CREATE TABLE ${q(table.name)} (`)
    // A trailing comment goes after the comma, so each column line stays valid SQL.
    body.forEach((line, index) => {
      const [code, comment] = line.split(' ')
      lines.push(`${code}${index < body.length - 1 ? ',' : ''}${comment ?? ''}`)
    })
    lines.push(');')
    created.add(table.entity.id)
  })
  if (deferred.length) lines.push('', ...deferred)
  views.forEach((view) => lines.push('', `-- ${view.storageKind === 'materialized_view' ? 'materialized view' : 'view'} ${physicalOf(project, view.name, false, report)}: its query is not modeled`))
  if (issues.length) {
    const counts = (kind: DdlIssueKind) => issues.filter((issue) => issue.kind === kind).length
    lines.splice(2, 0, `-- Check before use: ${counts('unresolved_name')} names not from the vocabulary, ${counts('untyped')} untyped domains, ${counts('lossy')} lossy type conversions.`)
  }
  return { sql: `${lines.join('\n')}\n`, issues }
}

/** DDL for every database and schema container, in name order. */
export function buildAllDdl(project: Project): DdlResult {
  const stores = Object.values(project.elements).filter(isErdStore).sort((a, b) => a.name.localeCompare(b.name))
  const results = stores.map((store) => buildDdl(project, store.id))
  return { sql: results.map((result) => result.sql).join('\n'), issues: results.flatMap((result) => result.issues) }
}
