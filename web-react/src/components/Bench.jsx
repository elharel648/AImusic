import { useLang } from '../i18n/index.jsx'

/** You vs the genre — measured values against the hit range. The conclusion
 *  speaks before any scale (Law One); every module: VALUE > STATUS > RANGE > READ. */
export default function Bench({ rep }) {
  const { ui } = useLang()
  const raw = rep._raw || {}, norms = raw.norms || {}
  const axes = [
    { k: 'bpm', name: ui('metric_bpm'), l: 'BPM', unit: 'BPM', val: raw.bpm, rng: norms.bpm, f: v => String(Math.round(v)) },
    { k: 'lufs', name: ui('metric_lufs'), l: 'LUFS', unit: 'LUFS', val: raw.lufs, rng: norms.lufs, f: v => v.toFixed(1) },
    { k: 'intro', name: ui('metric_intro'), l: 'INTRO', unit: 's', val: raw.intro_sec, rng: norms.intro_sec, f: v => String(Math.round(v)) },
  ].filter(a => typeof a.val === 'number' && Array.isArray(a.rng))
  if (!axes.length) return null

  const READ = { bpm: { below: 'slow', above: 'fast' }, lufs: { below: 'quiet', above: 'loud' }, intro: { below: 'short', above: 'long' } }
  const states = axes.map(a => a.val < a.rng[0] ? 'below' : (a.val > a.rng[1] ? 'above' : 'in'))
  const offN = states.filter(s => s !== 'in').length

  return (
    <section className="rule-t py-7" data-sec="bench">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <span className="lbl">{ui('bench_section')}</span>
        <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
        {norms.n_hits && <span className="val text-[11px] text-ink2">n={norms.n_hits}</span>}
      </div>

      {/* the conclusion first */}
      <h3 className={`text-[16.5px] font-semibold ${offN ? 'text-red' : ''}`}>
        {offN ? (offN === 1 ? ui('health_warn1') : ui('health_warn')(offN)) : ui('health_ok')}
      </h3>

      <div className="mt-4 grid gap-x-10 gap-y-6 sm:grid-cols-3">
        {axes.map((a, ix) => {
          const [lo, hi] = a.rng, state = states[ix]
          const bandW = (hi - lo) || 1
          const out = Math.max(lo - a.val, a.val - hi, 0)
          const pad = Math.max(bandW * 0.15, out * 1.3)
          const lo2 = lo - pad, hi2 = hi + pad
          const pct = x => Math.max(0, Math.min(100, (x - lo2) / (hi2 - lo2) * 100))
          const read = state === 'in' ? ui('bench_' + a.k + '_in')
            : ui('bench_' + a.k + '_' + READ[a.k][state])(a.f(state === 'below' ? lo - a.val : a.val - hi))
          return (
            <div key={a.k}>
              <div className="flex items-baseline gap-3">
                <span className="text-[12.5px] font-bold">{a.name}</span>
                <span className={`text-[11px] font-semibold ${state === 'in' ? 'text-ok' : 'text-red'}`}>{ui('bench_' + state)}</span>
              </div>
              <div className="val mt-1 text-[24px] font-semibold" dir="ltr">
                {a.f(a.val)}<small className="ms-1 text-[11px] font-normal text-ink2">{a.unit}</small>
              </div>
              <div dir="ltr" className="relative mt-2 h-[30px] select-none">
                <span className="absolute inset-x-0 top-[12px] h-px bg-rule" aria-hidden />
                <span className="absolute top-[5px] h-[14px] border-x border-ink/30 bg-ink/[.08]"
                      style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} aria-hidden />
                <span className="val absolute top-[20px] -translate-x-1/2 text-[9.5px] text-ink2" style={{ left: `${pct(lo)}%` }}>{a.f(lo)}</span>
                <span className="val absolute top-[20px] -translate-x-1/2 text-[9.5px] text-ink2" style={{ left: `${pct(hi)}%` }}>{a.f(hi)}</span>
                <span className={`absolute top-[2px] h-[20px] w-[2px] ${state === 'in' ? 'bg-ink' : 'bg-red'}`}
                      style={{ left: `${pct(a.val)}%` }} aria-hidden />
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2 [&_b]:font-semibold [&_b]:text-ink"
                 dangerouslySetInnerHTML={{ __html: read }} />
            </div>
          )
        })}
      </div>
      {norms.n_hits && (
        <p className="mt-4 text-[12px] text-ink2">
          {ui('bench_note')(norms.n_hits)}{norms.n_fma ? ' ' + ui('bench_note_intro')(norms.n_fma) : ''}
        </p>
      )}
    </section>
  )
}
