import { useState } from 'react'
import { childViewKind, effectiveCategory, type DiagramView, type Element, type Group, type Project } from '../core/model'
import type { Copy } from './i18n'
import { Icon, type IconName } from './icons'

export interface ExplorerProps {
  project: Project
  view: DiagramView
  copy: Copy
  search: string
  onSearch: (value: string) => void
  onOpenScope: (kind: DiagramView['kind'], scopeId: string | null) => void
  onSelectElement: (id: string) => void
  onQuickCreate: () => void
  notice: string
}

const iconFor = (element: Element): IconName => {
  if (element.kind === 'person') return 'user'
  if (element.kind === 'softwareSystem') return 'globe'
  if (element.kind === 'externalSystem') return 'external'
  if (element.kind === 'component') return 'layers'
  return effectiveCategory(element) === 'dataStore' ? 'database' : 'box'
}

export function Explorer({ project, view, copy, search, onSearch, onOpenScope, onSelectElement, onQuickCreate, notice }: ExplorerProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const matches = (element: Element) => !search || `${element.name} ${element.description} ${element.technology}`.toLowerCase().includes(search.toLowerCase())
  const elements = Object.values(project.elements)
  const groupsFor = (scopeId: string | null) => Object.values(project.groups).filter((group) => group.scopeId === scopeId && !group.parentGroupId)

  const renderElement = (element: Element, depth: number) => {
    const kind = childViewKind(element)
    const isScope = view.scopeId === element.id
    const children = elements.filter((child) => child.parentId === element.id)
    const visibleChildren = children.filter(matches)
    const showChildren = children.length > 0 && !collapsed.has(element.id)
    return (
      <div key={element.id}>
        <div className={`flex items-center gap-1 rounded-lg px-1 py-1 text-xs ${isScope ? 'bg-cyan/10 text-cyan' : 'text-muted hover:bg-white/5 hover:text-base-content'}`} style={{ paddingLeft: 4 + depth * 12 }}>
          <button type="button" className="grid h-4 w-4 place-items-center" onClick={() => toggle(element.id)} aria-label="toggle">
            {children.length > 0 ? <Icon name={showChildren ? 'chevronDown' : 'chevron'} size={11} /> : <span className="h-1 w-1 rounded-full bg-line" />}
          </button>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => onSelectElement(element.id)} onDoubleClick={() => kind && onOpenScope(kind, element.id)} title={element.description}>
            <Icon name={iconFor(element)} size={13} className="shrink-0" />
            <span className="truncate">{element.name}</span>
          </button>
          {kind && <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-white/10 hover:text-cyan" title={copy.open} onClick={() => onOpenScope(kind, element.id)}><Icon name="external" size={11} /></button>}
        </div>
        {showChildren && renderScope(element.id, visibleChildren, depth + 1)}
      </div>
    )
  }

  const renderGroup = (group: Group, scopeChildren: Element[], depth: number) => {
    const members = scopeChildren.filter((element) => element.groupId === group.id)
    const nested = Object.values(project.groups).filter((child) => child.parentGroupId === group.id)
    const open = !collapsed.has(group.id)
    return (
      <div key={group.id}>
        <div className="flex items-center gap-1 rounded-lg px-1 py-1 text-xs text-muted hover:bg-white/5" style={{ paddingLeft: 4 + depth * 12 }}>
          <button type="button" className="grid h-4 w-4 place-items-center" onClick={() => toggle(group.id)} aria-label="toggle"><Icon name={open ? 'chevronDown' : 'chevron'} size={11} /></button>
          <Icon name="group" size={13} className="shrink-0 text-violet" />
          <span className="truncate italic">{group.name}</span>
        </div>
        {open && (
          <>
            {nested.map((child) => renderGroup(child, scopeChildren, depth + 1))}
            {members.map((element) => renderElement(element, depth + 1))}
          </>
        )}
      </div>
    )
  }

  const renderScope = (scopeId: string | null, scopeChildren: Element[], depth: number) => {
    const groups = groupsFor(scopeId)
    const groupIds = new Set(Object.values(project.groups).filter((group) => group.scopeId === scopeId).map((group) => group.id))
    const ungrouped = scopeChildren.filter((element) => !element.groupId || !groupIds.has(element.groupId))
    return (
      <div className="border-l border-line/60" style={{ marginLeft: 8 }}>
        {groups.map((group) => renderGroup(group, scopeChildren, depth))}
        {ungrouped.map((element) => renderElement(element, depth))}
      </div>
    )
  }

  const roots = elements.filter((element) => !element.parentId && matches(element))
  return (
    <aside className="flex min-h-0 flex-col border-r border-line/80 bg-panel/45">
      <div className="border-b border-line/80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="section-label">{copy.explorer}</div>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-cyan" onClick={onQuickCreate} title={copy.quickCreate}><Icon name="plus" size={15} /></button>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-line bg-ink/45 px-2.5 py-1.5 text-xs text-muted focus-within:border-cyan/60">
          <Icon name="search" size={14} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={copy.search} className="w-full bg-transparent text-base-content outline-none placeholder:text-muted/70" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <button type="button" onClick={() => onOpenScope('c4_context', null)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold ${view.kind === 'c4_context' ? 'bg-cyan/10 text-cyan' : 'text-base-content hover:bg-white/5'}`}>
          <Icon name="folder" size={14} className="text-cyan" />{project.name}
        </button>
        {renderScope(null, roots, 0)}
      </div>
      <div className="border-t border-line/80 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-ink/40 px-3 py-2 text-[11px] text-muted"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" /><span className="truncate">{notice}</span></div>
      </div>
    </aside>
  )
}
