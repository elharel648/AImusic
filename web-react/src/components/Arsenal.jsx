import { useRef } from 'react'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { SUITES, SUITE_SEED, RX_ORDER } from '../lib/plugin-kb.js'
import { KB_BY_NAME, normPl, resolveRxPlugin } from '../lib/report-utils.js'

/** Your tools — the personal plugin arsenal. Prescriptions resolve to what
 *  you actually own; suite quick-picks seed the arsenal with stock tools. */
export default function Arsenal({ rep }) {
  const { ui } = useLang()
  const { arsenal, addPlugins, removePlugin, setSuite } = useSession()
  const inputRef = useRef(null)
  const chainTypes = RX_ORDER.filter(t => (rep.findings || []).some(f => f.rx && f.rx.type === t))

  return (
    <div className="rule-t py-5" data-sec="arsenal">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="lbl">{ui('rx_suite')}</span>
        {arsenal.map(v => {
          const known = !!KB_BY_NAME[normPl(v)]
          return (
            <span key={v} title={known ? '' : ui('ars_unknown')}
                  className={`flex items-center gap-1.5 border px-2 py-0.5 text-[12px] ${known ? 'border-rule' : 'border-dashed border-ink2 text-ink2'}`}>
              {!known && <span className="val text-[10px]">?</span>}
              <span dir="ltr">{v}</span>
              <button type="button" aria-label="remove" onClick={() => removePlugin(v)}
                      className="val text-ink2 hover:text-red">×</button>
            </span>
          )
        })}
        <input ref={inputRef} type="text" autoComplete="off" spellCheck="false" enterKeyHint="done"
               placeholder={ui('ars_ph')} dir="ltr"
               className="min-w-[220px] flex-1 border-b border-rule bg-transparent px-1 py-1 text-[13px] outline-none placeholder:text-ink2/60 focus:border-ink"
               onKeyDown={e => {
                 if (e.key === 'Enter' || e.key === ',') {
                   e.preventDefault()
                   if (e.target.value.trim()) { addPlugins(e.target.value); e.target.value = '' }
                 }
               }}
               onBlur={e => { if (e.target.value.trim()) { addPlugins(e.target.value); e.target.value = '' } }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {Object.entries(SUITES).map(([k, name]) => (
          <button key={k} type="button"
                  onClick={() => { setSuite(k); addPlugins(SUITE_SEED[k].join(',')) }}
                  className="press border border-rule px-2 py-0.5 text-[11.5px] text-ink2 transition-colors hover:border-ink hover:text-ink">
            {name}
          </button>
        ))}
      </div>
      {/* the chain — order of operations across this report's prescriptions */}
      {chainTypes.length >= 2 && <ChainLine types={chainTypes} />}
    </div>
  )
}

function ChainLine({ types }) {
  const { ui } = useLang()
  const { arsenal, suite } = useSession()
  return (
    <p className="val mt-3 text-[12px] text-ink2">
      <span className="lbl me-2">{ui('rx_chain')}</span>
      {types.map((t, i) => (
        <span key={t}>
          {i > 0 && <span className="mx-1.5 opacity-60">→</span>}
          <b className="font-semibold text-ink">{resolveRxPlugin(t, arsenal, suite).name}</b>
        </span>
      ))}
    </p>
  )
}
