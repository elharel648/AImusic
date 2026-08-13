import Unit from './Unit.jsx'

/** MASTERING VU — measured level vs target tick on one glowing bar (-24…-6). */
export default function LufsMeter({ lufs = -11.4, target = [-9, -7], read = '' }) {
  const pct = (v) => Math.max(0, Math.min(100, ((v + 24) / 18) * 100))
  return (
    <Unit area="master" label="Mastering · LUFS" read={read}>
      <div dir="ltr">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="digits text-[30px] font-semibold"
                style={{ textShadow: '0 0 18px rgba(61,245,166,.45)' }}>
            {lufs.toFixed(1)}
          </span>
          <span className="digits text-[11px] text-faint">TARGET {target[0]}…{target[1]}</span>
        </div>
        <div className="hairline relative h-2.5 overflow-visible rounded-md bg-panel2">
          <i className="absolute inset-y-0 left-0 rounded-md transition-[width] duration-1000"
             style={{
               width: `${pct(lufs)}%`,
               background: 'linear-gradient(90deg, rgba(61,245,166,.55), var(--color-sig))',
               boxShadow: '0 0 14px rgba(61,245,166,.5)',
             }} />
          <em className="absolute -inset-y-1 w-[2px] rounded bg-ink opacity-90"
              style={{ left: `${pct(target[0])}%` }} />
        </div>
        <div className="digits mt-2 flex justify-between text-[8.5px] tracking-[.14em] text-faint">
          <span>-24</span><span>-14</span><span>-6</span>
        </div>
      </div>
    </Unit>
  )
}
