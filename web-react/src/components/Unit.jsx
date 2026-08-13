/** Instrument panel shell: matte glass, hairline, LED, mono label. */
export default function Unit({ area, label, led = 'var(--color-sig)', children, read }) {
  return (
    <section className="glasspanel toplight relative flex min-h-[190px] flex-col gap-4 rounded-2xl border border-white/10 px-6 pb-5 pt-[22px]">
      <div className="flex items-center justify-between">
        <span className="digits text-[9px] uppercase tracking-[.26em] text-faint">{label}</span>
        <i className="h-[7px] w-[7px] rounded-full" style={{ background: led, boxShadow: `0 0 9px ${led}` }} />
      </div>
      {children}
      {read && <p className="mt-auto text-[13px] leading-relaxed text-dim">{read}</p>}
    </section>
  )
}
