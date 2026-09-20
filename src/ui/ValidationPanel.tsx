import { CHECK_PROFILES, type Finding } from '../core/validate'
import type { Copy } from './i18n'
import { Icon } from './icons'

export function ValidationPanel({ findings, profileId, copy, onProfileChange, onNavigate, onClose }: { findings: Finding[]; profileId: string; copy: Copy; onProfileChange: (id: string) => void; onNavigate: (finding: Finding) => void; onClose: () => void }) {
  const counts = { error: 0, warning: 0, info: 0 }
  findings.forEach((finding) => { counts[finding.level] += 1 })
  const icon = { error: 'error', warning: 'warning', info: 'info' } as const
  const color = { error: 'text-rose-400', warning: 'text-amber', info: 'text-cyan' }
  return (
    <div className="flex min-h-0 flex-col border-t border-line/80 bg-panel/60">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="section-label">{copy.checks}</span>
          <select className="rounded-md border border-line bg-ink/60 px-2 py-1 text-[11px]" value={profileId} onChange={(event) => onProfileChange(event.target.value)}>
            {CHECK_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
          <span className="text-[11px] text-muted">
            <span className="text-rose-400">{counts.error}</span> · <span className="text-amber">{counts.warning}</span> · <span className="text-cyan">{counts.info}</span>
          </span>
        </div>
        <button type="button" className="text-muted hover:text-base-content" onClick={onClose} aria-label="close"><Icon name="x" size={14} /></button>
      </div>
      <div className="max-h-44 overflow-y-auto px-2 pb-2">
        {findings.length === 0 && <div className="px-2 py-3 text-xs text-muted">{copy.noFindings}</div>}
        {findings.map((finding, index) => (
          <button key={`${finding.itemId}-${finding.targetId}-${index}`} type="button" onClick={() => onNavigate(finding)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5">
            <Icon name={icon[finding.level]} size={13} className={`mt-0.5 shrink-0 ${color[finding.level]}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{finding.message}</span>
              <span className="block truncate text-[10px] text-muted">{finding.itemId}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
