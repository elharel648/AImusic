import Tag from './Tag.jsx'
import { useLang } from '../i18n/index.jsx'

/** Production signature — honest tells, each a measured percentile against the
 *  human corpus, drawn on a 0–100 rule. An indication, never a verdict. */
export default function Texture({ ai, bare = false }) {
  const { ui } = useLang()
  if (!ai?.tells?.length) return null
  return (
    <section className={bare ? '' : 'rule-t py-7'}>
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        {!bare && <span className="lbl">{ui('rk_tx_title')}</span>}
        <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
        {ai.benchmark?.n && (
          <span className="text-[11.5px] text-ink2">
            {ui('rk_tx_benchA')} <span className="val font-semibold text-ink">{ai.benchmark.n.toLocaleString()}</span> {ui('rk_tx_benchB')}
          </span>
        )}
      </div>

      <h3 className="text-[16.5px] font-semibold">{ai.headline}</h3>

      {ai.tells.map(tell => (
        <figure key={tell.t} className="mt-4">
          <figcaption className="mb-1.5 flex flex-wrap items-baseline gap-x-4 text-[13.5px]">
            <b className="font-semibold">{tell.t}</b>
            {typeof tell.pct === 'number' && (
              <span className="text-ink2">{ui('rk_tx_pctA')} <span className="val font-semibold text-red">{tell.pct}</span> {ui('rk_tx_pctB')}</span>
            )}
            <span className="ms-auto"><Tag kind="measured" /></span>
          </figcaption>

          {typeof tell.pct === 'number' && (
            <div dir="ltr" className="relative h-[26px] select-none">
              <span className="absolute inset-x-0 top-[11px] h-px bg-rule" aria-hidden />
              {[0, 25, 50, 75, 100].map(p => (
                <span key={p} className="absolute top-[11px]" style={{ left: `${p}%` }}>
                  <span className="block h-[6px] w-px -translate-y-full bg-ink2/50" />
                  <span className="val absolute top-[2px] -translate-x-1/2 text-[9px] text-ink2">{p}</span>
                </span>
              ))}
              <span className="absolute top-[2px] h-[19px] w-[2px] bg-red"
                    style={{ left: `${Math.min(tell.pct, 100)}%` }} aria-hidden />
            </div>
          )}

          {tell.d && (
            <details className="fold mt-1">
              <summary>{ui('rk_tx_what')}</summary>
              <p className="mt-1 max-w-[62ch] border-s border-rule ps-4 text-[13px] leading-relaxed text-ink2">{tell.d}</p>
            </details>
          )}
        </figure>
      ))}

      {ai.note && <p className="mt-4 max-w-[70ch] text-[12.5px] leading-relaxed text-ink2">{ai.note}</p>}
    </section>
  )
}
