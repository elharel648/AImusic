import { useRef, useState } from 'react'
import { useLang } from '../i18n/index.jsx'

const hz = f => f >= 1000 ? (f / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(f))

/** Tonal balance — your long-term curve vs the genre's quartile band (p25–p75,
 *  dashed median). One saturated line: yours. Hover reads band vs range. */
export default function TonalBalance({ tonal }) {
  const { ui } = useLang()
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(-1)
  if (!tonal) return null
  const { bands, freqs, genre, readout, note } = tonal
  const n = bands.length
  const W = 960, H = 210, padL = 40, padR = 12, padT = 14, padB = 24
  const X = i => padL + (W - padL - padR) * i / (n - 1)
  const all = [...bands, ...genre.p25, ...genre.p75]
  const lo = Math.min(...all) - 2, hi = Math.max(...all) + 2
  const Y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo))
  const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')
  const bandPath = path(genre.p75) + genre.p25.map((v, i, a) => `L${X(a.length - 1 - i).toFixed(1)},${Y(a[a.length - 1 - i]).toFixed(1)}`).join('') + 'Z'
  const grid = []
  for (let g = Math.ceil(lo / 6) * 6; g <= hi; g += 6) grid.push(g)
  const marks = [60, 250, 1000, 4000, 12000].map(f => {
    let bi = 0, bd = 1e9
    freqs.forEach((bf, i) => { const d = Math.abs(Math.log(bf / f)); if (d < bd) { bd = d; bi = i } })
    return [f, bi]
  })
  const onMove = e => {
    const r = wrapRef.current.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width * W
    setHover(Math.max(0, Math.min(n - 1, Math.round((fx - padL) / (W - padL - padR) * (n - 1)))))
  }

  return (
    <section className="rule-t py-7" data-sec="tonal">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <span className="lbl">{ui('tb_section')}</span>
        <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
        {genre.n && <span className="val text-[11px] text-ink2">n={genre.n}</span>}
      </div>

      {/* producer speaks before the plot */}
      <h3 className={`max-w-[56ch] text-[15px] font-semibold leading-snug ${readout.sev === 'warn' ? 'text-red' : ''}`}>
        {readout.text}
      </h3>

      <div ref={wrapRef} dir="ltr" className="relative mt-3 cursor-crosshair"
           onPointerMove={onMove} onPointerLeave={() => setHover(-1)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={ui('tb_section')}>
          {grid.map(g => (
            <g key={g}>
              <line x1={padL} x2={W - padR} y1={Y(g)} y2={Y(g)} stroke="var(--color-rule)" strokeWidth="1" opacity=".6" />
              <text x={padL - 6} y={Y(g) + 3} textAnchor="end" fontSize="9.5" fill="var(--color-ink2)" fontFamily="var(--font-mono)">{(g > 0 ? '+' : '') + g}</text>
            </g>
          ))}
          <path d={bandPath} fill="var(--color-ink)" opacity=".07" />
          <path d={path(genre.p50)} fill="none" stroke="var(--color-ink2)" strokeWidth="1" strokeDasharray="4 4" opacity=".6" />
          <path d={path(bands)} fill="none" stroke="var(--color-red)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover >= 0 && (
            <circle cx={X(hover)} cy={Y(bands[hover])} r="4.5" fill="var(--color-red)" stroke="var(--color-paper)" strokeWidth="2" />
          )}
          {marks.map(([f, bi]) => (
            <text key={f} x={X(bi)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink2)" fontFamily="var(--font-mono)">{hz(f)}</text>
          ))}
        </svg>
        {hover >= 0 && (
          <span className="val pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap bg-ink px-1.5 py-0.5 text-[10.5px] text-paper"
                style={{ left: `${(X(hover) / W) * 100}%` }}>
            {hz(freqs[hover])}Hz · {bands[hover] > 0 ? '+' : ''}{bands[hover]} dB · {ui('genre_lbl')}: {genre.p25[hover]}…{genre.p75[hover]}
          </span>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink2">{note}</p>
    </section>
  )
}
