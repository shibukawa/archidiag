import { describe, expect, test } from 'bun:test'
import { parseProject, serializeProject } from '../src/core/io'
import { commerceStarter } from '../src/core/starter'
import { filesToProject, projectToFiles } from '../src/core/yamlStore'

describe('YAML project folder', () => {
  test('round-trips the starter losslessly', () => {
    const project = parseProject(serializeProject(commerceStarter()))
    const files = projectToFiles(project)
    expect(JSON.parse(serializeProject(filesToProject(files)))).toEqual(JSON.parse(serializeProject(project)))
  })

  test('writes one file per record with the id first', () => {
    const files = projectToFiles(commerceStarter())
    expect(files['c4sketch.yaml']).toContain('format: c4sketch-project')
    const customer = files['elements/entity_customer.yaml']
    expect(customer.startsWith('id: entity:customer')).toBe(true)
    expect(Object.keys(files).filter((path) => path.startsWith('views/')).length).toBe(Object.keys(commerceStarter().views).length)
  })

  test('is deterministic', () => {
    const project = parseProject(serializeProject(commerceStarter()))
    expect(projectToFiles(project)).toEqual(projectToFiles(project))
    expect(projectToFiles(filesToProject(projectToFiles(project)))).toEqual(projectToFiles(project))
  })

  test('keeps unknown keys a person added by hand', () => {
    const files = projectToFiles(commerceStarter())
    files['elements/person_customer.yaml'] += 'x_note: kept\n'
    expect((filesToProject(files).elements['person:customer'] as unknown as { x_note: string }).x_note).toBe('kept')
  })
})
