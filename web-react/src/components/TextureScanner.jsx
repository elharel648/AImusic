import Unit from './Unit.jsx'

/** TEXTURE SCAN — human↔AI spectrum with the marker at the MEASURED tell count.
    Honesty rule: never a fabricated probability — the chips name real measured tells. */
export default function TextureScanner({ tells = [], headline = '' }) {
  const x = Math.min(96, 8 + tells.length * 30)
  return (
    <Unit area="scan" label="Texture scan · ML" led="var(--color-ml)" read={headline}>
      <div className="flex flex-col gap-3">
        <div dir="ltr"
             className="hairline relative h-2.5 rounded-md"
             style={{ background: 'linear-gradient(90deg, rgba(61,245,166,.13), var(--color-panel2) 45%, rgba(167,139,250,.13))' }}>
          <i className="absolute -top-[5px] h-5 w-[2.5px] rounded transition-[left] duration-1000"
             style={{ left: `${x}%`, background: 'var(--color-ml)', boxShadow: '0 0 14px var(--color-ml)' }} />
        </div>
        <div dir="ltr" className="digits flex justify-between text-[8.5px] uppercase tracking-[.2em] text-faint">
          <span>Human range</span><span>AI range</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tells.length === 0 ? (
            <span className="digits rounded-md px-2 py-[3px] text-[9px] text-sig"
                  style={{ border: '1px solid rgba(61,245,166,.35)', background: 'rgba(61,245,166,.13)' }}>
              אפס סימנים
            </span>
          ) : tells.map((t, i) => (
            <span key={i} className="digits rounded-md px-2 py-[3px] text-[9px] text-ml"
                  style={{ border: '1px solid rgba(167,139,250,.35)', background: 'rgba(167,139,250,.13)' }}>
              {t.t}{t.pct ? ` · ${t.pct}%` : ''}
            </span>
          ))}
        </div>
      </div>
    </Unit>
  )
}
