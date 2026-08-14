import Tag from './Tag.jsx'

const SEV = {
  good: { word: 'תקין', cls: 'text-ok' },
  warn: { word: 'לתשומת לב', cls: 'text-red' },
  crit: { word: 'בעיה', cls: 'text-red' },
}

/* Hebrew prose stays RTL; only the numeric tokens are LTR .val islands */
const rxLine = rx => {
  if (!rx) return null
  if (rx.type === 'limiter')
    return <>לימיטר · <span className="val">+{rx.gain_db} dB</span> · תקרה <span className="val">{rx.ceiling_db} dBTP</span> · יעד <span className="val">{rx.target_lufs} LUFS</span></>
  if (rx.type === 'eq_cut')
    return <>EQ · <span className="val">{rx.gain_db} dB</span> סביב <span className="val">{rx.freq} Hz</span> · Q <span className="val">{rx.q}</span></>
  return null
}
const CONF = { high: 'ביטחון גבוה', med: 'ביטחון בינוני', low: 'ביטחון נמוך' }

/** One editorial finding — Swiss grammar: hairline rule, oversized margin
 *  numeral (same numeral as its timeline flag), claim in producer's voice,
 *  evidence visual, then a lab-report row: value · unit · reference · tag. */
export default function FindingBlock({ f, num, prio, selected, provenance, children }) {
  const sev = SEV[f.sev] || SEV.warn
  return (
    <article className={`rule-t grid grid-cols-[52px_1fr] gap-x-5 py-7 sm:grid-cols-[76px_1fr] sm:gap-x-7 ${selected ? 'border-t-red' : ''}`}>
      <div className={`val text-[38px] font-normal leading-none sm:text-[46px] ${prio || selected ? 'text-red' : 'text-rule'}`}>
        {num}
      </div>

      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[12.5px] font-bold">{f.k}</span>
          <span className={`text-[11.5px] font-semibold ${sev.cls}`}>{sev.word}</span>
          {prio && <span className="text-[11.5px] font-bold text-red">העדיפות</span>}
        </div>

        <h3 className="max-w-[52ch] text-[17.5px] font-semibold leading-snug [text-wrap:balance]">{f.headline}</h3>
        {f.why?.[0] && <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-ink2">{f.why[0]}</p>}

        {children}

        {/* lab row */}
        {f.measure?.length > 0 && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-7 gap-y-1.5">
            {f.measure.map(([v, label]) => (
              <span key={label} className="text-[12.5px] text-ink2">
                <span className="val text-[13.5px] font-semibold text-ink">{v}</span> {label}
              </span>
            ))}
            <span className="ms-auto">{provenance ?? <Tag kind="measured" />}</span>
          </div>
        )}

        {(f.why?.length > 1 || f.fix) && (
          <details className="fold mt-3">
            <summary>למה זה משנה, ומה לעשות</summary>
            <div className="mt-2 max-w-[62ch] border-s border-rule ps-4 text-[13.5px] leading-relaxed text-ink2">
              {f.why?.slice(1).map(w => <p key={w} className="mb-1">{w}</p>)}
              {f.fix?.daw && <p className="mt-2 font-semibold text-ink">מה לעשות — {f.fix.daw}</p>}
              {f.rx && rxLine(f.rx) && (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
                  <span className="text-[12.5px] font-medium text-ink">{rxLine(f.rx)}</span>
                  <Tag kind="read" />
                  {f.rx.conf && <span className="display text-[12px] text-blue">· {CONF[f.rx.conf] || f.rx.conf}</span>}
                </p>
              )}
              {f.fix?.suno && (
                <button className="val mt-2 block text-start text-[12px] text-ink2 underline decoration-rule underline-offset-4 hover:text-ink"
                        onClick={e => { navigator.clipboard?.writeText(f.fix.suno); e.target.textContent = '✓ הועתק' }}>
                  {f.fix.suno}
                </button>
              )}
            </div>
          </details>
        )}
      </div>
    </article>
  )
}
