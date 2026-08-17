import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { reportLink } from '../lib/share.js'

/** The sheet's letterhead — track label · status · actions (share / PDF /
 *  export / replace, all quiet). The brand lives in the shell's sidebar. */
export default function Masthead({ name, meta, busy, report, onPick }) {
  const { ui } = useLang()
  const { toast } = useSession()
  const share = async () => {
    if (!report) return
    try { await navigator.clipboard.writeText(await reportLink(report)); toast(ui('toast_link')) }
    catch { /* clipboard blocked */ }
  }
  const exportReport = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name.replace(/\.[^.]+$/, '')}-anr-report.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-[920px] flex-wrap items-baseline gap-x-5 gap-y-1 px-[clamp(18px,4vw,40px)] py-4">
        <span className="lbl">{ui('rk_sheet')}</span>

        {meta && (
          <span className="min-w-0 truncate text-[13px] text-ink2">
            <bdi className="font-mono font-semibold text-ink">{name}</bdi>
            {' · '}<span className="val">{meta.duration}</span>
            {meta.genre ? <> · {meta.genre}</> : null}
          </span>
        )}

        <span className="ms-auto flex items-center gap-4">
          <span className="flex items-center gap-2 text-[12px] font-semibold">
            <i className={`inline-block h-[9px] w-[9px] ${busy ? 'bg-red' : 'bg-ok'}`} aria-hidden />
            {ui(busy ? 'rk_measuring' : 'rk_done_badge')}
          </span>
          <button onClick={share} disabled={!report}
                  className="text-[12px] font-semibold text-ink2 underline decoration-rule underline-offset-4 transition-colors hover:text-ink disabled:opacity-40">
            {ui('rk2_share')}
          </button>
          <button onClick={() => window.print()} disabled={!report}
                  className="val text-[12px] font-semibold text-ink2 underline decoration-rule underline-offset-4 transition-colors hover:text-ink disabled:opacity-40">
            PDF
          </button>
          <button onClick={exportReport} disabled={!report}
                  className="val text-[12px] font-semibold text-ink2 underline decoration-rule underline-offset-4 transition-colors hover:text-ink disabled:opacity-40">
            JSON
          </button>
          <label className="btn" role="button" tabIndex={0}>
            {ui('rk2_replace')}
            <input type="file" accept="audio/*" hidden
                   onChange={e => e.target.files?.[0] && onPick(e.target.files[0])} />
          </label>
        </span>
      </div>
    </header>
  )
}
