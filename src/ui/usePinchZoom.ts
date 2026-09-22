import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { Position } from '../core/model'

/** Canvas zoom bounds, shared by the toolbar buttons and pinch zoom. */
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2
export const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

/** Safari's non-standard pinch event; scale is relative to the start of the gesture. */
interface SafariGestureEvent extends UIEvent { scale: number; clientX: number; clientY: number }

/**
 * Trackpad pinch zoom for a scrolling canvas. Chromium and Firefox send a pinch as ctrl+wheel, Safari as gesture
 * events; either scales the zoom around the pointer, and once the new zoom renders the scroll offset is corrected
 * so the canvas point under the pointer stays put. The frame receives the gestures; the host is the scroll container.
 */
export function usePinchZoom(frameRef: RefObject<HTMLElement | null>, hostRef: RefObject<HTMLElement | null>, zoom: number, onZoom: (zoom: number) => void) {
  // The zoom on screen and the zoom last requested; they differ between a pinch step and its render.
  const zoomRef = useRef({ shown: zoom, requested: zoom })
  const anchorRef = useRef<{ zoom: number; point: Position; offset: Position } | null>(null)

  useLayoutEffect(() => {
    zoomRef.current = { shown: zoom, requested: zoom }
    const anchor = anchorRef.current
    const host = hostRef.current
    anchorRef.current = null
    if (!anchor || anchor.zoom !== zoom || !host) return
    host.scrollLeft = anchor.point.x * zoom - anchor.offset.x
    host.scrollTop = anchor.point.y * zoom - anchor.offset.y
  }, [hostRef, zoom])

  useEffect(() => {
    const frame = frameRef.current
    const host = hostRef.current
    if (!frame || !host) return
    const zoomAt = (factor: number, clientX: number, clientY: number) => {
      const current = zoomRef.current
      const next = clampZoom(current.requested * factor)
      if (next === current.requested) return
      const rect = host.getBoundingClientRect()
      const offset = { x: clientX - rect.left, y: clientY - rect.top }
      anchorRef.current = { zoom: next, point: { x: (host.scrollLeft + offset.x) / current.shown, y: (host.scrollTop + offset.y) / current.shown }, offset }
      current.requested = next
      onZoom(next)
    }
    // Safari may also send ctrl+wheel for the same pinch; those are swallowed while a gesture is open.
    let gestureScale: number | null = null
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return // a plain wheel or two-finger swipe keeps scrolling
      event.preventDefault()
      if (gestureScale !== null) return
      // A pinch step has deltaY = -100·ln(scale); mouse wheel notches (lines, or large pixel steps) are capped near 25%.
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? event.deltaY : event.deltaY * 20
      zoomAt(Math.exp(-Math.max(-25, Math.min(25, delta)) / 100), event.clientX, event.clientY)
    }
    const onGestureStart = (event: Event) => { event.preventDefault(); gestureScale = 1 }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      const { scale, clientX, clientY } = event as SafariGestureEvent
      if (gestureScale === null || !(scale > 0)) return
      zoomAt(scale / gestureScale, clientX, clientY)
      gestureScale = scale
    }
    const onGestureEnd = (event: Event) => { event.preventDefault(); gestureScale = null }
    frame.addEventListener('wheel', onWheel, { passive: false })
    frame.addEventListener('gesturestart', onGestureStart)
    frame.addEventListener('gesturechange', onGestureChange)
    frame.addEventListener('gestureend', onGestureEnd)
    return () => {
      frame.removeEventListener('wheel', onWheel)
      frame.removeEventListener('gesturestart', onGestureStart)
      frame.removeEventListener('gesturechange', onGestureChange)
      frame.removeEventListener('gestureend', onGestureEnd)
    }
  }, [frameRef, hostRef, onZoom])
}
