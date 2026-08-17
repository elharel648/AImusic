import { useRef } from 'react'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { loadRefs, removeRef, MAX_REFS } from '../lib/reference.js'

/** You vs your references — up to 5 finished tracks you trust, all measured by
 *  the exact same engine. With 2+ refs the min–max across them becomes YOUR
 *  corridor: the sound you're aiming at, measured — never a vibe. */
export default function RefTrack({ rep, bare = false }) {
  const { ui } = useLang()
  const { uploadReference, clearReference, refTick, bumpRef } = useSession()
  const fileRef = useRef(null)
  const raw = (rep && rep._raw) || {}
  const refs = loadRefs()
  const measuring = refTick >= 1000

  const pct = v => Math.round(v * 100) + '%'
  const METRICS = [
    { k: 'lufs', l: 'LUFS', f: v => v.toFixed(1) },
    { k: 'bpm', l: 'BPM', f: v => String(Math.round(v)), i: true },
    { k: 'intro_sec', l: ui('lg_intro'), f: v => Math.round(v) + 's', i: true },
    { k: 'dynamic_range_db', l: ui('bt_dyn'), f: v => v.toFixed(1) + ' dB' },
    { k: 'low_mid_ratio', l: ui('ref_m_mud'), f: pct, s: 100 },
    { k: 'stereo_width', l: ui('ref_m_width'), f: v => v.toFixed(2) },
    { k: 'transient_strength', l: ui('ref_m_punch'), f: v => Math.round(v * 100) + '/100', s: 100, i: true },
    { k: 'kick_bass_overlap', l: ui('ref_m_lowend'), f: pct, s: 100 },
  ]
  const rows = METRICS.map(m => {
    const y = raw[m.k]
    const vals = refs.map(r => r.raw[m.k]).filter(v => typeof v === 'number')
    if (typeof y !== 'number' || !vals.length) return null
    const lo = Math.min(...vals), hi = Math.max(...vals)
    const state = y < lo ? 'below' : y > hi ? 'above' : 'in'
    // Δ vs the single ref, or vs the nearest corridor edge with 2+
    const d = refs.length === 1 ? (y - vals[0]) * (m.s || 1)
      : state === 'in' ? 0 : (y < lo ? y - lo : y - hi) * (m.s || 1)
    const dtxt = Math.abs(d) < (m.i ? 0.5 : 0.05) ? '='
      : (d > 0 ? '+' : '−') + (m.i || Math.abs(d) >= 10 ? String(Math.round(Math.abs(d))) : Math.abs(d).toFixed(1))
    return { ...m, y, lo, hi, state, dtxt }
  }).filter(Boolean)

  const curves = refs.map(r => r.raw.energy_curve).filter(c => Array.isArray(c) && c.length > 7)
  const linePath = arr => arr.map((v, i) =>
    `${i ? 'L' : 'M'}${(i / (arr.length - 1) * 400).toFixed(1)},${(60 - 3 - v * 52).toFixed(1)}`).join('')

  return (
    <section className={bare ? '' : 'rule-t py-7'} data-sec={bare ? undefined : 'ref'}>
      {!bare && (
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          <span className="lbl">{ui('ref_section')}</span>
          <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
          {refs.length > 0 && <span className="val text-[11px] text-ink2">{refs.length}/{MAX_REFS}</span>}
        </div>
      )}
      <input ref={fileRef} type="file" accept="audio/*" hidden
             onChange={e => { const f = e.target.files?.[0]; if (f) uploadReference(f); e.target.value = '' }} />

      {measuring ? (
        <p className="text-[13.5px] text-ink2">{ui('ref_measuring')}</p>
      ) : refs.length === 0 ? (
        <div>
          <p className="max-w-[52ch] text-[13.5px] leading-relaxed text-ink2">{ui('ref_hint')}</p>
          <button className="btn mt-3" onClick={() => fileRef.current?.click()}>{ui('ref_add')}</button>
        </div>
      ) : (
        <>
          {/* the shelf of trusted tracks */}
          <div className="flex flex-wrap items-center gap-2">
            {refs.map(r => (
              <span key={r.name} className="flex items-center gap-1.5 border border-rule px-2 py-0.5 text-[12px]">
                <bdi>{r.name}</bdi>
                <button type="button" aria-label={ui('ref_clear')} className="val text-ink2 hover:text-red"
                        onClick={() => { removeRef(r.name); bumpRef() }}>×</button>
              </span>
            ))}
            {refs.length < MAX_REFS && (
              <button className="border border-dashed border-ink2 px-2 py-0.5 text-[12px] text-ink2 transition-colors hover:border-ink hover:text-ink"
                      onClick={() => fileRef.current?.click()}>+ {ui('ref_add')}</button>
            )}
            <button className="ms-auto text-[12px] font-semibold text-ink2 underline decoration-rule underline-offset-4 hover:text-red"
                    onClick={clearReference}>{ui('ref_clear')}</button>
          </div>

          <table className="mt-4 w-full max-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="lbl">
                <th className="border-b border-ink pb-1.5 text-start font-semibold"></th>
                <th className="border-b border-ink pb-1.5 text-start font-semibold">{ui('bench_you')}</th>
                <th className="border-b border-ink pb-1.5 text-start font-semibold">
                  {refs.length > 1 ? `${ui('ref_ref')} · min–max` : ui('ref_ref')}
                </th>
                <th className="border-b border-ink pb-1.5 text-start font-semibold">Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(x => (
                <tr key={x.l} className="border-b border-rule">
                  <td className="py-1.5 text-ink2">{x.l}</td>
                  <td className={`val py-1.5 font-semibold ${x.state !== 'in' && refs.length > 1 ? 'text-red' : ''}`}>{x.f(x.y)}</td>
                  <td className="val py-1.5 text-ink2">{x.lo === x.hi ? x.f(x.lo) : `${x.f(x.lo)}…${x.f(x.hi)}`}</td>
                  <td className={`val py-1.5 ${x.dtxt === '=' || x.state === 'in' ? 'text-ok' : ''}`}>
                    {refs.length > 1 && x.state === 'in' ? '✓' : x.dtxt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {Array.isArray(raw.energy_curve) && curves.length > 0 && (
            <figure className="mt-4 max-w-[620px]">
              <figcaption className="lbl mb-1">{ui('ref_curve')}</figcaption>
              <svg viewBox="0 0 400 60" className="block h-[64px] w-full" dir="ltr" aria-hidden>
                {curves.map((c, i) => <path key={i} d={linePath(c)} fill="none" stroke="var(--color-rule)" strokeWidth="1.2" />)}
                <path d={linePath(raw.energy_curve)} fill="none" stroke="var(--color-red)" strokeWidth="1.7" />
              </svg>
            </figure>
          )}
          <p className="mt-3 max-w-[62ch] text-[12px] leading-relaxed text-ink2">
            {ui('ref_note')(refs.map(r => r.name).join(' · '))}
          </p>
        </>
      )}
    </section>
  )
}
