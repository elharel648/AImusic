/** Top header: breadcrumbs · status badge · primary action. */
export default function Header({ trackName = '—', busy = false, report = null }) {
  const exportReport = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${trackName.replace(/\.[^.]+$/, '')}-anr-report.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-white/[.07] bg-black/80 px-[clamp(16px,3vw,32px)] py-3 backdrop-blur-xl">
      {/* breadcrumbs */}
      <nav className="flex min-w-0 items-center gap-2 text-[13px]">
        <a href="/" className="text-dim transition hover:text-ink">השירים שלי</a>
        <span className="text-faint">/</span>
        <span dir="ltr" className="digits truncate text-[12px] text-ink">{trackName}</span>
      </nav>

      {/* status */}
      <span className={`digits inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[.16em]
        ${busy ? 'border-ml/30 bg-ml/10 text-ml' : 'border-sig/30 bg-sig/10 text-sig'}`}>
        <i className={`h-1.5 w-1.5 rounded-full ${busy ? 'animate-pulse bg-ml' : 'bg-sig'}`}
           style={{ boxShadow: busy ? '0 0 8px var(--color-ml)' : '0 0 8px var(--color-sig)' }} />
        {busy ? 'מנתח…' : 'הניתוח הושלם'}
      </span>

      {/* primary action */}
      <button onClick={exportReport} disabled={!report}
              className="ms-auto rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-black transition
                         enabled:hover:shadow-[0_0_24px_-8px_var(--color-sig)] enabled:active:scale-[.97] disabled:opacity-40">
        ייצא דוח
      </button>
    </header>
  )
}
