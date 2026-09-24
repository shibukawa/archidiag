import { describe, expect, test } from 'bun:test'
import * as Y from 'yjs'
import * as commands from '../src/core/commands'
import { changedTargets, compactProject, readProject, writeProject } from '../src/core/crdt'
import { parseProject, serializeProject } from '../src/core/io'
import { commerceStarter } from '../src/core/starter'

/** Two replicas that exchange their updates both ways. */
function pair() {
  const a = new Y.Doc()
  const b = new Y.Doc()
  const sync = () => {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)))
  }
  return { a, b, sync }
}

describe('project document', () => {
  test('round-trips the starter unchanged', () => {
    const project = commerceStarter()
    const doc = new Y.Doc()
    writeProject(doc, project)
    expect(serializeProject(readProject(doc)!)).toBe(serializeProject(parseProject(serializeProject(project))))
  })

  test('a small edit writes a small update', () => {
    const project = commerceStarter()
    const doc = new Y.Doc()
    writeProject(doc, project)
    const next = commands.patchElement(project, 'entity:customer', { description: 'Changed' })
    let size = 0
    doc.once('update', (update: Uint8Array) => { size = update.length })
    writeProject(doc, next, project)
    expect(size).toBeGreaterThan(0)
    expect(size).toBeLessThan(200)
    expect(readProject(doc)!.elements['entity:customer'].description).toBe('Changed')
  })

  test('concurrent edits to different fields of one element both survive', () => {
    const { a, b, sync } = pair()
    const base = commerceStarter()
    writeProject(a, base)
    sync()
    const pa = readProject(a)!
    const pb = readProject(b)!
    writeProject(a, commands.patchElement(pa, 'container:web', { description: 'from A' }), pa)
    writeProject(b, commands.patchElement(pb, 'container:web', { technology: 'from B' }), pb)
    sync()
    for (const doc of [a, b]) {
      const web = readProject(doc)!.elements['container:web']
      expect(web.description).toBe('from A')
      expect(web.technology).toBe('from B')
    }
    expect(serializeProject(readProject(a)!)).toBe(serializeProject(readProject(b)!))
  })

  test('fields added to one table at the same time are both kept, with their domains', () => {
    const { a, b, sync } = pair()
    writeProject(a, commerceStarter())
    sync()
    const pa = readProject(a)!
    const pb = readProject(b)!
    writeProject(a, commands.addAttribute(pa, 'entity:customer', 'nickname').project, pa)
    writeProject(b, commands.addAttribute(pb, 'entity:customer', 'birthday').project, pb)
    sync()
    const names = readProject(a)!.elements['entity:customer'].attributes!.map((attribute) => attribute.name)
    expect(names).toContain('nickname')
    expect(names).toContain('birthday')
    expect(serializeProject(readProject(a)!)).toBe(serializeProject(readProject(b)!))
    const project = readProject(a)!
    for (const attribute of project.elements['entity:customer'].attributes!) expect(project.domains[attribute.domainId!]).toBeDefined()
  })

  test('moving different nodes in one view merges', () => {
    const { a, b, sync } = pair()
    writeProject(a, commerceStarter())
    sync()
    const pa = readProject(a)!
    const pb = readProject(b)!
    const viewId = Object.values(pa.views).find((view) => view.kind === 'c4_context')!.id
    writeProject(a, commands.setPositions(pa, viewId, { 'person:customer': { x: 1, y: 2 } }), pa)
    writeProject(b, commands.setPositions(pb, viewId, { 'person:ops': { x: 3, y: 4 } }), pb)
    sync()
    const positions = readProject(b)!.views[viewId].layout.positions
    expect(positions['person:customer']).toEqual({ x: 1, y: 2 })
    expect(positions['person:ops']).toEqual({ x: 3, y: 4 })
  })

  test('a delete and a concurrent edit of the same element converge', () => {
    const { a, b, sync } = pair()
    writeProject(a, commerceStarter())
    sync()
    const pa = readProject(a)!
    const pb = readProject(b)!
    writeProject(a, commands.deleteElements(pa, ['system:mail']).project, pa)
    writeProject(b, commands.patchElement(pb, 'system:mail', { description: 'edited' }), pb)
    sync()
    expect(serializeProject(readProject(a)!)).toBe(serializeProject(readProject(b)!))
  })

  test('changed targets name the records a transaction touched', () => {
    const doc = new Y.Doc()
    const project = commerceStarter()
    writeProject(doc, project)
    let targets: string[] = []
    doc.once('afterTransaction', (transaction: Y.Transaction) => { targets = changedTargets(transaction, doc) })
    writeProject(doc, commands.patchAttribute(project, 'entity:customer', project.elements['entity:customer'].attributes![1].id, { description: 'x' }), project)
    expect(targets).toEqual(['elements:entity:customer'])
  })

  test('undo reverts only the local replica’s own edits', () => {
    const { a, b, sync } = pair()
    writeProject(a, commerceStarter())
    sync()
    const local = { local: true }
    const undo = new Y.UndoManager(a.getMap('project'), { trackedOrigins: new Set([local]) })
    const pa = readProject(a)!
    const pb = readProject(b)!
    writeProject(a, commands.patchElement(pa, 'person:customer', { name: 'Shopper' }), pa, local)
    writeProject(b, commands.patchElement(pb, 'person:ops', { name: 'Ops' }), pb)
    sync()
    undo.undo()
    sync()
    const project = readProject(b)!
    expect(project.elements['person:customer'].name).toBe('Customer')
    expect(project.elements['person:ops'].name).toBe('Ops')
  })
})

describe('project document edge cases', () => {
  test('two replicas moving one field leave one copy', () => {
    const { a, b, sync } = pair()
    writeProject(a, commerceStarter())
    sync()
    const move = (doc: Y.Doc) => {
      const project = readProject(doc)!
      const attributes = [...project.elements['entity:customer'].attributes!]
      attributes.unshift(attributes.pop()!)
      writeProject(doc, commands.patchElement(project, 'entity:customer', { attributes }), project)
    }
    move(a)
    move(b)
    sync()
    const ids = readProject(a)!.elements['entity:customer'].attributes!.map((attribute) => attribute.id)
    expect(new Set(ids).size).toBe(ids.length)
    compactProject(a, readProject(a)!, null)
    sync()
    const raw = (a.getMap('project').get('elements') as Y.Map<Y.Map<Y.Array<unknown>>>).get('entity:customer')!.get('attributes')!
    expect(raw.length).toBe(ids.length)
  })

  test('reading is deterministic even when a field lost its domain', () => {
    const doc = new Y.Doc()
    const project = commerceStarter()
    const orphan = { ...project, domains: Object.fromEntries(Object.entries(project.domains).slice(1)) }
    writeProject(doc, orphan)
    expect(serializeProject(readProject(doc)!)).toBe(serializeProject(readProject(doc)!))
  })
})
