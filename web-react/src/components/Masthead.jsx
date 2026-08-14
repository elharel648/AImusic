/** The sheet's letterhead — one ruled strip: wordmark · track label · status · actions. */
export default function Masthead({ name, meta, busy, report, onPick }) {
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
        <span className="display text-[19px] font-bold tracking-tight">A&R·AI</span>
        <span className="lbl">גיליון מדידה</span>

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
            {busy ? 'מודד…' : 'המדידה הושלמה'}
          </span>
          <label className="btn" role="button" tabIndex={0}>
            מדוד שיר
            <input type="file" accept="audio/*" hidden
                   onChange={e => e.target.files?.[0] && onPick(e.target.files[0])} />
          </label>
          <button className="btn" onClick={exportReport} disabled={!report}>ייצוא דוח</button>
          <a href="/" className="text-[13px] font-semibold text-ink2 underline decoration-rule underline-offset-4 transition-colors hover:text-ink">
            המוצר המלא
          </a>
        </span>
      </div>
    </header>
  )
}
