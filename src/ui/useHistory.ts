import { useCallback, useRef, useState } from 'react'
import type { Project } from '../core/model'

/**
 * Snapshot history: every committed mutation is one undo step, except that consecutive commits sharing a
 * batch key (one text field while it keeps focus) fold into the step that opened the batch. The owner closes
 * a batch on blur; undo, redo, replace, or a commit with another key close it too (rule: undo-scope).
 */
export function useProjectHistory(initial: Project) {
  const [project, setProjectState] = useState(initial)
  const past = useRef<Project[]>([])
  const future = useRef<Project[]>([])
  const batchKey = useRef<string | null>(null)
  const [, bump] = useState(0)
  const projectRef = useRef(project)
  projectRef.current = project

  const commit = useCallback((mutator: (current: Project) => Project, key?: string) => {
    const current = projectRef.current
    const next = mutator(current)
    if (next === current) return
    if (!key || key !== batchKey.current) past.current = [...past.current.slice(-79), current]
    batchKey.current = key ?? null
    future.current = []
    projectRef.current = next
    setProjectState(next)
  }, [])

  /** Ends the current text-edit batch so the next commit starts a new undo step. */
  const endBatch = useCallback(() => { batchKey.current = null }, [])

  const replace = useCallback((next: Project) => {
    past.current = []
    future.current = []
    batchKey.current = null
    projectRef.current = next
    setProjectState(next)
  }, [])

  const undo = useCallback(() => {
    const previous = past.current[past.current.length - 1]
    if (!previous) return
    past.current = past.current.slice(0, -1)
    future.current = [projectRef.current, ...future.current]
    batchKey.current = null
    projectRef.current = previous
    setProjectState(previous)
    bump((value) => value + 1)
  }, [])

  const redo = useCallback(() => {
    const next = future.current[0]
    if (!next) return
    future.current = future.current.slice(1)
    past.current = [...past.current, projectRef.current]
    batchKey.current = null
    projectRef.current = next
    setProjectState(next)
    bump((value) => value + 1)
  }, [])

  return { project, projectRef, commit, endBatch, replace, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 }
}
