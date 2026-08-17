import { useLang } from '../i18n/index.jsx'

/** Loudness vs the reference corridor — a printed VU: segmented meter cells
 *  fill to the MEASURED level (Pro-L 2's distance-to-target idea, set in the
 *  sheet's grammar). Fixed 12 LU span centered on the corridor; cells above
 *  the corridor's ceiling print in grease-red; one 2px needle carries the
 *  exact reading. Every cell is driven by raw.lufs — nothing invented. */
export default function LoudnessRule({ lufs, corridor = [-9, -7] }) {
  const { ui } = useLang()
  const [lo, hi] = corridor
  const mid = (lo + hi) / 2
  const min = mid - 6, max = mid + 6
  const x = v => `${((v - min) / (max - min)) * 100}%`
  const inside = lufs >= lo && lufs <= hi
  const delta = lufs < lo ? lo - lufs : lufs > hi ? lufs - hi : 0
  const prose = inside ? ui('rk_lr_in')
    : ui(lufs < lo ? 'rk_lr_below' : 'rk_lr_above')(delta.toFixed(1))

  // 36 meter cells across the span — a cell prints when the level reaches it
  const CELLS = 36
  const cellVal = i => min + (i + 0.5) * (max - min) / CELLS
  const ticks = []
  for (let v = Math.ceil(min); v <= max; v++) ticks.push(v)

  return (
    <figure className="my-4">
      {/* producer speaks before the meter */}
      <figcaption className="mb-2 text-[13.5px] font-semibold">
        {prose} <span className="ms-2 font-normal text-ink2">{ui('rk_lr_corrA')} <span className="val">{lo}…{hi} LUFS</span>{ui('rk_lr_corrB')(673)}</span>
      </figcaption>

      <div dir="ltr" className="relative h-[72px] select-none">
        {/* the corridor — a tinted band with hairline walls */}
        <span className="absolute top-[14px] h-[26px] border-x border-ink/40 bg-ink/[.07]"
              style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} aria-hidden />

        {/* segmented VU cells — filled up to the measured level */}
        <div className="absolute inset-x-0 top-[20px] flex h-[14px] gap-[2px]" aria-hidden>
          {Array.from({ length: CELLS }, (_, i) => {
            const v = cellVal(i)
            const lit = v <= lufs
            const over = v > hi
            return (
              <span key={i} className="h-full flex-1"
                    style={{
                      background: lit ? (over ? 'var(--color-red)' : 'var(--color-ink)') : 'var(--color-rule)',
                      opacity: lit ? (over ? 1 : .85) : .45,
                    }} />
            )
          })}
        </div>

        {/* tick ruler */}
        {ticks.map(v => (
          <span key={v} className="absolute top-[42px]" style={{ left: x(v) }}>
            <span className={`block w-px bg-ink2/60 ${v % 3 === 0 ? 'h-[8px]' : 'h-[4px]'}`} />
            {v % 3 === 0 && (
              <span className="val absolute top-[9px] -translate-x-1/2 text-[9.5px] text-ink2">{v}</span>
            )}
          </span>
        ))}
        <span className="val absolute right-0 top-[54px] text-[9.5px] text-ink2">LUFS</span>

        {/* your needle — the exact reading rides it */}
        <span className={`absolute top-[8px] h-[38px] w-[2px] ${inside ? 'bg-ink' : 'bg-red'}`}
              style={{ left: x(Math.min(Math.max(lufs, min), max)) }}>
          <span className={`val absolute -top-[9px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold ${inside ? 'text-ink' : 'text-red'}`}>
            {lufs}
          </span>
        </span>
      </div>
    </figure>
  )
}
