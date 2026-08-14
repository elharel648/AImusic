/** Loudness vs the reference corridor — Pro-L 2's idea: distance-to-target IS the axis.
 *  Fixed 12 LU span centered on the corridor. Tinted corridor, one 2px needle,
 *  hairline ticks every 1 LU, labels every 3. LTR instrument inside RTL prose. */
export default function LoudnessRule({ lufs, corridor = [-9, -7] }) {
  const [lo, hi] = corridor
  const mid = (lo + hi) / 2
  const min = mid - 6, max = mid + 6
  const x = v => `${((v - min) / (max - min)) * 100}%`
  const inside = lufs >= lo && lufs <= hi
  const delta = lufs < lo ? lo - lufs : lufs > hi ? lufs - hi : 0
  const prose = inside
    ? 'בתוך מסדרון הייחוס.'
    : lufs < lo
      ? `${delta.toFixed(1)} LU מתחת למסדרון הייחוס.`
      : `${delta.toFixed(1)} LU מעל מסדרון הייחוס.`

  const ticks = []
  for (let v = Math.ceil(min); v <= max; v++) ticks.push(v)

  return (
    <figure className="my-4">
      {/* producer speaks before the meter */}
      <figcaption className="mb-2 text-[13.5px] font-semibold">
        {prose} <span className="ms-2 font-normal text-ink2">המסדרון: <span className="val">{lo}…{hi} LUFS</span>, נמדד מ-673 שירים משוחררים.</span>
      </figcaption>

      <div dir="ltr" className="relative h-[62px] select-none">
        {/* baseline */}
        <span className="absolute inset-x-0 top-[34px] h-px bg-rule" aria-hidden />
        {/* ticks */}
        {ticks.map(v => (
          <span key={v} className="absolute top-[34px]" style={{ left: x(v) }}>
            <span className={`absolute bottom-0 block w-px bg-ink2/60 ${v % 3 === 0 ? 'h-[9px]' : 'h-[5px]'}`} />
            {v % 3 === 0 && (
              <span className="val absolute top-[3px] -translate-x-1/2 text-[9.5px] text-ink2">{v}</span>
            )}
          </span>
        ))}
        <span className="val absolute right-0 top-[48px] text-[9.5px] text-ink2">LUFS</span>

        {/* the corridor — a tinted band with its bounds printed at the edges */}
        <span className="absolute top-[16px] h-[18px] border-x border-ink/30 bg-ink/[.08]"
              style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} aria-hidden />

        {/* your needle */}
        <span className={`absolute top-[10px] h-[30px] w-[2px] ${inside ? 'bg-ink' : 'bg-red'}`}
              style={{ left: x(Math.min(Math.max(lufs, min), max)) }}>
          <span className={`val absolute -top-[10px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold ${inside ? 'text-ink' : 'text-red'}`}>
            {lufs} {!inside && (lufs < lo ? 'L' : 'H')}
          </span>
        </span>
      </div>
    </figure>
  )
}
