import type { ReactElement } from 'react'

export type IconName =
  | 'folder' | 'chevron' | 'chevronDown' | 'search' | 'plus' | 'download' | 'upload' | 'undo' | 'redo' | 'check'
  | 'link' | 'database' | 'box' | 'user' | 'globe' | 'layers' | 'trash' | 'external' | 'grid' | 'zoomIn' | 'zoomOut'
  | 'alignLeft' | 'alignCenterX' | 'alignRight' | 'alignTop' | 'alignCenterY' | 'alignBottom' | 'distributeX' | 'distributeY'
  | 'row' | 'column' | 'wand' | 'group' | 'eye' | 'copy' | 'star' | 'x' | 'warning' | 'info' | 'error' | 'tag' | 'shrink' | 'expand'

export function Icon({ name, size = 16, stroke = 1.8, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className }
  const paths: Record<IconName, ReactElement> = {
    folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /><path d="M3 10h18" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 21h16" /></>,
    upload: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5M4 21h16" /></>,
    undo: <><path d="M9 7 4 12l5 5" /><path d="M4 12h10a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 7 5 5-5 5" /><path d="M20 12H10a6 6 0 0 0-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" /><path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.15-1.15" /></>,
    database: <><ellipse cx="12" cy="5.5" rx="7" ry="3" /><path d="M5 5.5v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6M5 11.5v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" /></>,
    box: <><path d="m4 7 8-4 8 4-8 4z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    layers: <path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" />,
    trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="m6 7 1 14h10l1-14M9 7V4h6v3" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    zoomIn: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5M11 8v6M8 11h6" /></>,
    zoomOut: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5M8 11h6" /></>,
    alignLeft: <><path d="M4 3v18" /><rect x="7" y="6" width="12" height="4" /><rect x="7" y="14" width="8" height="4" /></>,
    alignCenterX: <><path d="M12 3v18" /><rect x="5" y="6" width="14" height="4" /><rect x="8" y="14" width="8" height="4" /></>,
    alignRight: <><path d="M20 3v18" /><rect x="5" y="6" width="12" height="4" /><rect x="9" y="14" width="8" height="4" /></>,
    alignTop: <><path d="M3 4h18" /><rect x="6" y="7" width="4" height="12" /><rect x="14" y="7" width="4" height="8" /></>,
    alignCenterY: <><path d="M3 12h18" /><rect x="6" y="5" width="4" height="14" /><rect x="14" y="8" width="4" height="8" /></>,
    alignBottom: <><path d="M3 20h18" /><rect x="6" y="5" width="4" height="12" /><rect x="14" y="9" width="4" height="8" /></>,
    distributeX: <><path d="M3 4v16M21 4v16" /><rect x="8" y="8" width="3" height="8" /><rect x="13" y="8" width="3" height="8" /></>,
    distributeY: <><path d="M4 3h16M4 21h16" /><rect x="8" y="8" width="8" height="3" /><rect x="8" y="13" width="8" height="3" /></>,
    row: <><rect x="3" y="9" width="5" height="6" /><rect x="10" y="9" width="5" height="6" /><rect x="17" y="9" width="4" height="6" /></>,
    column: <><rect x="9" y="3" width="6" height="5" /><rect x="9" y="10" width="6" height="5" /><rect x="9" y="17" width="6" height="4" /></>,
    wand: <><path d="m15 4 5 5L8 21l-5-5z" /><path d="m14 5 5 5M5 3v3M3 4h3M19 15v3M18 16h3" /></>,
    group: <><rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="4 3" /><rect x="7" y="7" width="4" height="4" /><rect x="13" y="13" width="4" height="4" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    warning: <><path d="M12 3 2 20h20z" /><path d="M12 9v5M12 17h.01" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></>,
    error: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
    tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" /></>,
    shrink: <><path d="M9 3v6H3M15 21v-6h6" /><path d="m3 21 6-6M21 3l-6 6" /></>,
    expand: <><path d="M3 9V3h6M21 15v6h-6" /><path d="m3 3 6 6M21 21l-6-6" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}
