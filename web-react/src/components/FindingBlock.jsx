import Tag from './Tag.jsx'
import { useLang } from '../i18n/index.jsx'

const SEV = {
  good: { key: 'rk_sev_good', cls: 'text-ok' },
  warn: { key: 'rk_sev_warn', cls: 'text-red' },
  crit: { key: 'rk_sev_crit', cls: 'text-red' },
}
const CONF = { high: 'rk_conf_high', med: 'rk_conf_med', low: 'rk_conf_low' }

/* prose stays in the UI language; only the numeric tokens are LTR .val islands */
const rxLine = (rx, ui) => {
  if (!rx) return null
  if (rx.type === 'limiter')
    return <>{ui('rk_limiter')} · <span className="val">+{rx.gain_db} dB</span> · {ui('rk_ceiling')} <span className="val">{rx.ceiling_db} dBTP</span> · {ui('rk_target')} <span className="val">{rx.target_lufs} LUFS</span></>
  if (rx.type === 'eq_cut')
    return <>EQ · <span className="val">{rx.gain_db} dB</span> {ui('rk_around')} <span className="val">{rx.freq} Hz</span> · Q <span className="val">{rx.q}</span></>
  return null
}

/** One editorial finding — Swiss grammar: hairline rule, oversized margin
 *  numeral (same numeral as its timeline flag), claim in producer's voice,
 *  evidence visual, then a lab-report row: value · unit · reference · tag. */
export default function FindingBlock({ f, num, prio, selected, provenance, children }) {
  const { ui } = useLang()
  const sev = SEV[f.sev] || SEV.warn
  return (
    <article className={`rule-t grid grid-cols-[52px_1fr] gap-x-5 py-7 sm:grid-cols-[76px_1fr] sm:gap-x-7 ${selected ? 'border-t-red' : ''}`}>
      <div className={`val text-[38px] font-normal leading-none sm:text-[46px] ${prio || selected ? 'text-red' : 'text-rule'}`}>
        {num}
      </div>

      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[12.5px] font-bold">{f.k}</span>
          <span className={`text-[11.5px] font-semibold ${sev.cls}`}>{ui(sev.key)}</span>
          {prio && <span className="text-[11.5px] font-bold text-red">{ui('rk_prio_badge')}</span>}
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
            <summary>{ui('rk_why')}</summary>
            <div className="mt-2 max-w-[62ch] border-s border-rule ps-4 text-[13.5px] leading-relaxed text-ink2">
              {f.why?.slice(1).map(w => <p key={w} className="mb-1">{w}</p>)}
              {f.fix?.daw && <p className="mt-2 font-semibold text-ink">{ui('rk_what')(f.fix.daw)}</p>}
              {f.rx && rxLine(f.rx, ui) && (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
                  <span className="text-[12.5px] font-medium text-ink">{rxLine(f.rx, ui)}</span>
                  <Tag kind="read" />
                  {f.rx.conf && <span className="display text-[12px] text-blue">· {CONF[f.rx.conf] ? ui(CONF[f.rx.conf]) : f.rx.conf}</span>}
                </p>
              )}
              {f.fix?.suno && (
                <button className="val mt-2 block text-start text-[12px] text-ink2 underline decoration-rule underline-offset-4 hover:text-ink"
                        onClick={e => { navigator.clipboard?.writeText(f.fix.suno); e.target.textContent = `✓ ${ui('copied')}` }}>
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
