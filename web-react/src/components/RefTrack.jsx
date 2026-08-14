import { useRef } from 'react'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { loadRefTrack } from '../lib/reference.js'

/** You vs your reference — a finished track you trust, measured by the exact
 *  same engine. Every delta shown is measured on both files. */
export default function RefTrack({ rep }) {
  const { ui } = useLang()
  const { uploadReference, clearReference, refTick } = useSession()
  const fileRef = useRef(null)
  const raw = (rep && rep._raw) || {}
  const ref = loadRefTrack()
  const measuring = refTick >= 1000

  const pct = v => Math.round(v * 100) + '%'
  const rows = ref ? [
    { l: 'LUFS', y: raw.lufs, r: ref.raw.lufs, f: v => v.toFixed(1) },
    { l: 'BPM', y: raw.bpm, r: ref.raw.bpm, f: v => String(Math.round(v)), i: true },
    { l: ui('lg_intro'), y: raw.intro_sec, r: ref.raw.intro_sec, f: v => Math.round(v) + 's', i: true },
    { l: ui('bt_dyn'), y: raw.dynamic_range_db, r: ref.raw.dynamic_range_db, f: v => v.toFixed(1) + ' dB' },
    { l: ui('ref_m_mud'), y: raw.low_mid_ratio, r: ref.raw.low_mid_ratio, f: pct, s: 100 },
    { l: ui('ref_m_width'), y: raw.stereo_width, r: ref.raw.stereo_width, f: v => v.toFixed(2) },
    { l: ui('ref_m_punch'), y: raw.transient_strength, r: ref.raw.transient_strength, f: v => Math.round(v * 100) + '/100', s: 100, i: true },
    { l: ui('ref_m_lowend'), y: raw.kick_bass_overlap, r: ref.raw.kick_bass_overlap, f: pct, s: 100 },
  ].filter(x => typeof x.y === 'number' && typeof x.r === 'number') : []
  const dtxt = x => {
    const d = (x.y - x.r) * (x.s || 1)
    if (Math.abs(d) < (x.i ? 0.5 : 0.05)) return '='
    const a = Math.abs(d); return (d > 0 ? '+' : '−') + (x.i || a >= 10 ? String(Math.round(a)) : a.toFixed(1))
  }

  // energy curves overlaid — SVG, yours in red, reference in rule-grey
  const curves = ref && Array.isArray(raw.energy_curve) && Array.isArray(ref.raw.energy_curve)
    ? [ref.raw.energy_curve, raw.energy_curve] : null
  const linePath = arr => arr.map((v, i) =>
    `${i ? 'L' : 'M'}${(i / (arr.length - 1) * 400).toFixed(1)},${(60 - 3 - v * 52).toFixed(1)}`).join('')

  return (
    <section className="rule-t py-7" data-sec="ref">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <span className="lbl">{ui('ref_section')}</span>
        <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
        {ref && <span className="val text-[11px] text-ink2"><bdi>{ref.name}</bdi></span>}
      </div>
      <input ref={fileRef} type="file" accept="audio/*" hidden
             onChange={e => { const f = e.target.files?.[0]; if (f) uploadReference(f); e.target.value = '' }} />

      {measuring ? (
        <p className="text-[13.5px] text-ink2">{ui('ref_measuring')}</p>
      ) : !ref ? (
        <div>
          <p className="max-w-[52ch] text-[13.5px] leading-relaxed text-ink2">{ui('ref_hint')}</p>
          <button className="btn mt-3" onClick={() => fileRef.current?.click()}>{ui('ref_add')}</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="text-[13.5px]">{ui('ref_vs')} <b className="font-semibold"><bdi>{ref.name}</bdi></b></span>
            <button className="text-[12px] font-semibold text-ink2 underline decoration-rule underline-offset-4 hover:text-ink"
                    onClick={() => fileRef.current?.click()}>{ui('ref_swap')}</button>
            <button className="text-[12px] font-semibold text-ink2 underline decoration-rule underline-offset-4 hover:text-red"
                    onClick={clearReference}>{ui('ref_clear')}</button>
          </div>

          <table className="mt-4 w-full max-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="lbl">
                <th className="border-b border-ink pb-1.5 text-start font-semibold"></th>
                <th className="border-b border-ink pb-1.5 text-start font-semibold">{ui('bench_you')}</th>
                <th className="border-b border-ink pb-1.5 text-start font-semibold">{ui('ref_ref')}</th>
                <th className="border-b border-ink pb-1.5 text-start font-semibold">Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(x => (
                <tr key={x.l} className="border-b border-rule">
                  <td className="py-1.5 text-ink2">{x.l}</td>
                  <td className="val py-1.5 font-semibold">{x.f(x.y)}</td>
                  <td className="val py-1.5 text-ink2">{x.f(x.r)}</td>
                  <td className="val py-1.5">{dtxt(x)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {curves && (
            <figure className="mt-4 max-w-[560px]">
              <figcaption className="lbl mb-1">{ui('ref_curve')}</figcaption>
              <svg viewBox="0 0 400 60" className="block h-[64px] w-full" dir="ltr" aria-hidden>
                <path d={linePath(curves[0])} fill="none" stroke="var(--color-rule)" strokeWidth="1.3" />
                <path d={linePath(curves[1])} fill="none" stroke="var(--color-red)" strokeWidth="1.7" />
              </svg>
            </figure>
          )}
          <p className="mt-3 max-w-[62ch] text-[12px] leading-relaxed text-ink2">{ui('ref_note')(ref.name)}</p>
        </>
      )}
    </section>
  )
}
