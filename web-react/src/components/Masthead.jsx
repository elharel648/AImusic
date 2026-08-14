import { useLang } from '../i18n/index.jsx'

/** The sheet's letterhead — track label · status · actions.
 *  (The brand lives in the shell's sidebar now.) */
export default function Masthead({ name, meta, busy, report, onPick }) {
  const { ui } = useLang()
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
          <label className="btn" role="button" tabIndex={0}>
            {ui('rk_measure_btn')}
            <input type="file" accept="audio/*" hidden
                   onChange={e => e.target.files?.[0] && onPick(e.target.files[0])} />
          </label>
          <button className="btn" onClick={exportReport} disabled={!report}>{ui('rk_export')}</button>
        </span>
      </div>
    </header>
  )
}
