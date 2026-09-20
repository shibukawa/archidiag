import { useCallback, useRef, useState } from 'react'
import type { Project } from '../core/model'

/** Snapshot history: every committed mutation is one undo step; the owner decides what counts as one batch. */
export function useProjectHistory(initial: Project) {
  const [project, setProjectState] = useState(initial)
  const past = useRef<Project[]>([])
  const future = useRef<Project[]>([])
  const [, bump] = useState(0)
  const projectRef = useRef(project)
  projectRef.current = project

  const commit = useCallback((mutator: (current: Project) => Project) => {
    const current = projectRef.current
    const next = mutator(current)
    if (next === current) return
    past.current = [...past.current.slice(-79), current]
    future.current = []
    projectRef.current = next
    setProjectState(next)
  }, [])

  const replace = useCallback((next: Project) => {
    past.current = []
    future.current = []
    projectRef.current = next
    setProjectState(next)
  }, [])

  const undo = useCallback(() => {
    const previous = past.current[past.current.length - 1]
    if (!previous) return
    past.current = past.current.slice(0, -1)
    future.current = [projectRef.current, ...future.current]
    projectRef.current = previous
    setProjectState(previous)
    bump((value) => value + 1)
  }, [])

  const redo = useCallback(() => {
    const next = future.current[0]
    if (!next) return
    future.current = future.current.slice(1)
    past.current = [...past.current, projectRef.current]
    projectRef.current = next
    setProjectState(next)
    bump((value) => value + 1)
  }, [])

  return { project, projectRef, commit, replace, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 }
}
