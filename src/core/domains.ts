// Data domains: field-first birth, typing, consolidation, and physical expansion (decision: field-first-domains).
import { makeId, type Attribute, type CodeSetEntry, type DataDomain, type DomainCategory, type DomainComponent, type Element, type Project, type TypeSpec } from './model'
import { attributeName, bindName, findEntryByTerm, formatIdentifier, patchEntry, toWords } from './vocabulary'

const normalize = (name: string) => name.trim().toLowerCase()
/** Case and separators ignored: created_at, CreatedAt, and createdAt collapse to one key. */
const looseKey = (name: string) => name.toLowerCase().replace(/[\s_\-./・]+/g, '')

export function makeDomain(name: string, patch: Partial<DataDomain> = {}): DataDomain {
  return { id: makeId('domain'), name, description: '', origin: 'from_field', curated: false, shape: 'unresolved', ...patch }
}

export function findDomainByName(project: Pick<Project, 'domains'>, name: string, exceptId?: string): DataDomain | undefined {
  const key = normalize(name)
  if (!key) return undefined
  return Object.values(project.domains).find((domain) => domain.id !== exceptId && normalize(domain.name) === key)
}

/** The domain named like the field, created unresolved when absent (requirement: domain-consolidation creation). */
export function ensureDomain(project: Project, name: string): { project: Project; domain?: DataDomain } {
  if (!name.trim()) return { project }
  const existing = findDomainByName(project, name)
  if (existing) return { project, domain: existing }
  const domain = makeDomain(name.trim())
  return { project: { ...project, domains: { ...project.domains, [domain.id]: domain } }, domain }
}

/** Every attribute of every entity, with its owner. */
export function allAttributes(project: Project): Array<{ entity: Element; attribute: Attribute }> {
  return Object.values(project.elements).flatMap((entity) => (entity.kind === 'entity' ? (entity.attributes ?? []).map((attribute) => ({ entity, attribute })) : []))
}

export function domainUsage(project: Project): Map<string, Array<{ entity: Element; attribute: Attribute }>> {
  const usage = new Map<string, Array<{ entity: Element; attribute: Attribute }>>(Object.keys(project.domains).map((id) => [id, []]))
  allAttributes(project).forEach((item) => { if (item.attribute.domainId) usage.get(item.attribute.domainId)?.push(item) })
  return usage
}

function componentRefs(project: Project, domainId: string): number {
  return Object.values(project.domains).reduce((sum, domain) => sum + (domain.components ?? []).filter((component) => component.domainRef === domainId).length, 0)
}

/** Automatic domains nobody uses any more disappear; curated and dictionary domains stay. */
export function pruneDomains(project: Project, candidateIds: Iterable<string>): Project {
  const candidates = [...new Set(candidateIds)].filter((id) => {
    const domain = project.domains[id]
    return domain && domain.origin === 'from_field' && !domain.curated
  })
  if (!candidates.length) return project
  const used = new Set(allAttributes(project).map((item) => item.attribute.domainId).filter(Boolean))
  const drop = candidates.filter((id) => !used.has(id) && !componentRefs(project, id))
  if (!drop.length) return project
  const domains = { ...project.domains }
  drop.forEach((id) => delete domains[id])
  return { ...project, domains }
}

/**
 * Keeps an entity's attributes on domains as they are added, renamed, and removed:
 * a new field gets or reuses the same-named domain; renaming a field whose domain is still its automatic twin
 * renames the twin, or moves the field to the domain of its new name; fields moved off or removed let unused
 * automatic domains go.
 */
export function syncAttributeDomains(project: Project, before: Attribute[], after: Attribute[]): { project: Project; attributes: Attribute[]; released: string[] } {
  let next = project
  const released: string[] = []
  const previous = new Map(before.map((attribute) => [attribute.id, attribute]))
  const usedByOthers = (domainId: string, attributeId: string) => allAttributes(next).some((item) => item.attribute.domainId === domainId && item.attribute.id !== attributeId)
  const attributes = after.map((attribute) => {
    const name = attribute.name
    const current = attribute.domainId ? next.domains[attribute.domainId] : undefined
    if (!current) {
      if (attribute.useDomainName) return attribute
      const ensured = ensureDomain(next, name)
      next = ensured.project
      return ensured.domain ? { ...attribute, domainId: ensured.domain.id } : attribute
    }
    const old = previous.get(attribute.id)
    if (!old || old.name === name || !name.trim() || attribute.useDomainName) return attribute
    // The domain follows the name while it is the one named like the field (or the field was just cleared);
    // a domain assigned under another name stays. Each keystroke re-derives, so the final name decides.
    if (old.name.trim() && normalize(current.name) !== normalize(old.name)) return attribute
    const target = findDomainByName(next, name, current.id)
    if (!target && !current.curated && current.origin === 'from_field' && !usedByOthers(current.id, attribute.id)) {
      next = { ...next, domains: { ...next.domains, [current.id]: { ...current, name: name.trim() } } }
      return attribute
    }
    const ensured = target ? { project: next, domain: target } : ensureDomain(next, name)
    next = ensured.project
    released.push(current.id)
    return { ...attribute, domainId: ensured.domain?.id }
  })
  before.forEach((attribute) => { if (attribute.domainId && !after.some((item) => item.id === attribute.id)) released.push(attribute.domainId) })
  return { project: next, attributes, released }
}

/** Gives every attribute that lacks a domain its same-named one; used on import and for seeded projects. */
export function assignMissingDomains(project: Project): Project {
  let next = project
  Object.values(project.elements).forEach((element) => {
    if (element.kind !== 'entity' || !(element.attributes ?? []).some((attribute) => !attribute.domainId || !next.domains[attribute.domainId])) return
    const cleared = (element.attributes ?? []).map((attribute) => (attribute.domainId && !next.domains[attribute.domainId] ? { ...attribute, domainId: undefined } : attribute))
    const synced = syncAttributeDomains(next, cleared, cleared)
    next = { ...synced.project, elements: { ...synced.project.elements, [element.id]: { ...element, attributes: synced.attributes } } }
  })
  return next
}

// ---------- definition ----------

export function formatType(type: TypeSpec | undefined): string {
  if (!type) return ''
  if (type.primitive === 'varchar') return type.length ? `varchar(${type.length})` : 'varchar'
  if (type.primitive === 'numeric') return type.precision ? `numeric(${type.precision}${type.scale !== undefined ? `,${type.scale}` : ''})` : 'numeric'
  if (type.primitive === 'double_precision') return 'double precision'
  return type.primitive
}

export function componentType(project: Project, component: DomainComponent): TypeSpec | undefined {
  if (component.type) return component.type
  const referenced = component.domainRef ? project.domains[component.domainRef] : undefined
  return referenced?.shape === 'single_field' ? referenced.type : undefined
}

export function isDefined(project: Project, domain: DataDomain): boolean {
  if (domain.shape === 'single_field') return Boolean(domain.type)
  if (domain.shape === 'multi_field') return Boolean(domain.components?.length) && domain.components!.every((component) => componentType(project, component))
  if (domain.shape === 'code_set') return Boolean(domain.codeSet?.base)
  return false
}

/** Short type text for lists and field rows; empty while unresolved. */
export function domainTypeLabel(project: Project, domain: DataDomain): string {
  if (domain.shape === 'single_field') return formatType(domain.type)
  if (domain.shape === 'code_set') return domain.codeSet ? `${formatType(domain.codeSet.base)} {${domain.codeSet.entries.length}}` : ''
  if (domain.shape === 'multi_field') return (domain.components ?? []).map((component) => `${component.name}: ${formatType(componentType(project, component)) || '?'}`).join(', ')
  return ''
}

/** A patch that also marks the domain curated, since an author touched it. */
export function patchDomain(project: Project, id: string, patch: Partial<DataDomain>, curate = true): Project {
  const current = project.domains[id]
  if (!current) return project
  return { ...project, domains: { ...project.domains, [id]: { ...current, ...patch, id, curated: curate ? true : current.curated } } }
}

/** A shared domain known up front; it stays unresolved until typed (flow: domain-lifecycle). */
export function createDictionaryDomain(project: Project, name: string): { project: Project; domain: DataDomain } {
  const existing = findDomainByName(project, name)
  if (existing) return { project, domain: existing }
  const domain = makeDomain(name.trim(), { origin: 'dictionary' })
  return { project: { ...project, domains: { ...project.domains, [domain.id]: domain } }, domain }
}

/** Removes an unused domain; a domain still assigned to a field cannot go. */
export function deleteDomain(project: Project, id: string): Project {
  if (!project.domains[id] || allAttributes(project).some((item) => item.attribute.domainId === id)) return project
  const domains = Object.fromEntries(Object.entries(project.domains).filter(([domainId]) => domainId !== id).map(([domainId, domain]) => [domainId, domain.components ? { ...domain, components: domain.components.map((component) => (component.domainRef === id ? { ...component, domainRef: undefined } : component)) } : domain]))
  return { ...project, domains }
}

/** Assigns a domain to one field, overriding the automatic one, which goes if nothing else uses it. */
export function assignDomain(project: Project, entityId: string, attributeId: string, domainId: string): Project {
  const entity = project.elements[entityId]
  const attribute = entity?.attributes?.find((item) => item.id === attributeId)
  if (!entity || !attribute || !project.domains[domainId] || attribute.domainId === domainId) return project
  const next = { ...project, elements: { ...project.elements, [entityId]: { ...entity, attributes: entity.attributes!.map((item) => (item.id === attributeId ? { ...item, domainId } : item)) } } }
  return attribute.domainId ? pruneDomains(next, [attribute.domainId]) : next
}

export function createCategory(project: Project, name: string): { project: Project; category: DomainCategory } {
  const category = { id: makeId('dcat'), name }
  return { project: { ...project, domainCategories: { ...project.domainCategories, [category.id]: category } }, category }
}

export function patchCategory(project: Project, id: string, name: string): Project {
  if (!project.domainCategories[id]) return project
  return { ...project, domainCategories: { ...project.domainCategories, [id]: { id, name } } }
}

export function deleteCategory(project: Project, id: string): Project {
  const domainCategories = { ...project.domainCategories }
  delete domainCategories[id]
  const domains = Object.fromEntries(Object.entries(project.domains).map(([domainId, domain]) => [domainId, domain.categoryId === id ? { ...domain, categoryId: undefined } : domain]))
  return { ...project, domainCategories, domains }
}

export function makeComponent(name: string): DomainComponent {
  return { id: makeId('dcomp'), name, required: true, description: '' }
}

export function makeCodeSetEntry(name: string, value: string): CodeSetEntry {
  return { id: makeId('code'), name, value, description: '' }
}

// ---------- consolidation (requirement: domain-consolidation) ----------

export type CandidateReason = 'same_name' | 'same_business_name' | 'similar_name' | 'same_type'

export interface MergeCandidate { reason: CandidateReason; domainIds: string[] }

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue }
    edits += 1
    if (edits > 1) return false
    if (a.length > b.length) i += 1
    else if (b.length > a.length) j += 1
    else { i += 1; j += 1 }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** Groups of domains that look like one: same name ignoring case and separators, same business name, similar names, same type. */
export function mergeCandidates(project: Project): MergeCandidate[] {
  const domains = Object.values(project.domains)
  const groups: MergeCandidate[] = []
  const seen = new Set<string>()
  const add = (reason: CandidateReason, ids: string[]) => {
    const key = [...ids].sort().join('|')
    if (ids.length < 2 || seen.has(key)) return
    seen.add(key)
    groups.push({ reason, domainIds: ids })
  }
  const bucket = (keyOf: (domain: DataDomain) => string | undefined) => {
    const map = new Map<string, string[]>()
    domains.forEach((domain) => { const key = keyOf(domain); if (key) map.set(key, [...(map.get(key) ?? []), domain.id]) })
    return [...map.values()]
  }
  bucket((domain) => looseKey(domain.name) || undefined).forEach((ids) => add('same_name', ids))
  bucket((domain) => {
    const binding = bindName(project, domain.name)
    return binding.segments.some((item) => item.kind === 'match') && !binding.unmatched.length ? `b:${looseKey(binding.business)}` : undefined
  }).forEach((ids) => add('same_business_name', ids))
  for (let a = 0; a < domains.length; a += 1) {
    for (let b = a + 1; b < domains.length; b += 1) {
      const left = looseKey(domains[a].name)
      const right = looseKey(domains[b].name)
      // Numbered siblings (line1, line2) are distinct columns, not a typo.
      if (left.replace(/\d+/g, '') === right.replace(/\d+/g, '')) continue
      if (left.length >= 5 && right.length >= 5 && editDistanceAtMostOne(left, right)) add('similar_name', [domains[a].id, domains[b].id])
    }
  }
  bucket((domain) => (domain.shape === 'single_field' && domain.type ? `t:${formatType(domain.type)}:${looseKey(domain.name).replace(/\d+$/, '')}` : undefined)).forEach((ids) => add('same_type', ids))
  return groups
}

/** What the survivor's values override when the given domains merge into it; shown before confirming. */
export function mergeConflicts(project: Project, survivorId: string, mergedIds: string[]): string[] {
  const survivor = project.domains[survivorId]
  if (!survivor) return []
  const survivorType = domainTypeLabel(project, survivor)
  const conflicts: string[] = []
  mergedIds.filter((id) => id !== survivorId).forEach((id) => {
    const domain = project.domains[id]
    if (!domain) return
    const type = domainTypeLabel(project, domain)
    if (type && type !== survivorType) conflicts.push(`${domain.name}: ${type}`)
    if (domain.categoryId && domain.categoryId !== survivor.categoryId) conflicts.push(`${domain.name}: ${project.domainCategories[domain.categoryId]?.name ?? domain.categoryId}`)
    if (domain.description.trim() && domain.description.trim() !== survivor.description.trim()) conflicts.push(`${domain.name}: “${domain.description.trim()}”`)
  })
  return conflicts
}

/**
 * Merges domains into a survivor in one step: fields and component references follow, merged domains are deleted,
 * their names become aliases of the survivor's vocabulary entry, and the survivor is curated.
 */
export function mergeDomains(project: Project, survivorId: string, mergedIds: string[], rename?: string): { project: Project; aliasEntryId?: string } {
  const survivor = project.domains[survivorId]
  const merged = mergedIds.filter((id) => id !== survivorId && project.domains[id])
  if (!survivor || !merged.length) return { project }
  const gone = new Set(merged)
  const elements = Object.fromEntries(Object.entries(project.elements).map(([id, element]): [string, Element] => [id, element.kind === 'entity' && element.attributes?.some((attribute) => attribute.domainId && gone.has(attribute.domainId)) ? { ...element, attributes: element.attributes.map((attribute) => (attribute.domainId && gone.has(attribute.domainId) ? { ...attribute, domainId: survivorId } : attribute)) } : element]))
  const name = rename?.trim() || survivor.name
  const domains = Object.fromEntries(Object.entries(project.domains)
    .filter(([id]) => !gone.has(id))
    .map(([id, domain]): [string, DataDomain] => {
      // A survivor component that pointed at a merged domain would point at itself: it keeps that domain's type instead.
      const components = domain.components?.map((component) => {
        if (!component.domainRef || !gone.has(component.domainRef)) return component
        if (id !== survivorId) return { ...component, domainRef: survivorId }
        const merged = project.domains[component.domainRef]
        return { ...component, domainRef: undefined, type: component.type ?? (merged?.shape === 'single_field' ? merged.type : undefined) }
      })
      return [id, id === survivorId ? { ...domain, components, name, curated: true } : { ...domain, components }]
    }))
  let next: Project = { ...project, elements, domains }
  const names = [survivor.name, ...merged.map((id) => project.domains[id].name)].filter((item) => normalize(item) !== normalize(name))
  const binding = bindName(project, name)
  const whole = binding.segments.filter((item) => item.kind !== 'separator')
  const entry = whole.length === 1 && whole[0].kind === 'match' ? project.vocabulary[whole[0].entryId] : findEntryByTerm(project, name)
  if (entry) {
    const known = new Set([entry.businessName, ...entry.aliases].map(normalize))
    const aliases = [...entry.aliases, ...[...new Set(names)].filter((item) => !known.has(normalize(item)) && !findEntryByTerm(project, item))]
    if (aliases.length !== entry.aliases.length) next = patchEntry(next, entry.id, { aliases })
  }
  return { project: next, aliasEntryId: entry?.id }
}

// ---------- physical projection (rule: domain-expansion) ----------

export interface ProjectedColumn { name: string; type?: string; componentId?: string }

/** One column for a scalar domain, one per component for a composite; derived, never stored. */
export function expandColumns(project: Project, attribute: Attribute): ProjectedColumn[] {
  const binding = bindName(project, attributeName(project, attribute))
  const base = binding.physical ?? formatIdentifier(toWords(attributeName(project, attribute)), project.settings.namingPolicy.identifierCase)
  const domain = attribute.domainId ? project.domains[attribute.domainId] : undefined
  if (domain?.shape === 'multi_field' && domain.components?.length) {
    return domain.components.map((component) => {
      const componentBinding = bindName(project, component.name)
      const suffix = componentBinding.physical ?? formatIdentifier(toWords(component.name), project.settings.namingPolicy.identifierCase)
      return { name: formatIdentifier([...toWords(base), ...toWords(suffix)], project.settings.namingPolicy.identifierCase), type: formatType(componentType(project, component)) || undefined, componentId: component.id }
    })
  }
  const type = domain?.shape === 'code_set' ? formatType(domain.codeSet?.base) : domain?.shape === 'single_field' ? formatType(domain.type) : ''
  return [{ name: base, type: type || undefined }]
}
