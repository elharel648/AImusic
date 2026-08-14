import { useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { RX_PLUG } from '../lib/plugin-kb.js'
import { resolveRxPlugin, rxParamsFor, wtGet, wtStepHTML } from '../lib/report-utils.js'
import Tag from './Tag.jsx'

const CONF = { high: 'rk_conf_high', med: 'rk_conf_med', low: 'rk_conf_low' }

/** The mix prescription — measured params rendered for the plugin the artist
 *  actually owns (arsenal > suite > free pick, honestly noted), plus a real
 *  per-plugin walkthrough with the rx values injected. */
export default function Prescription({ rx }) {
  const { ui, lang } = useLang()
  const { arsenal, suite } = useSession()
  const [open, setOpen] = useState(false)
  if (!rx || !RX_PLUG[rx.type]) return null
  const res = resolveRxPlugin(rx.type, arsenal, suite)
  const wt = wtGet(res.name, rx.type, lang)
  const rows = rxParamsFor(rx.type, res.name, rx)

  return (
    <div className="mt-3 border border-rule bg-sheet p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-3">
        <span className="lbl">{ui('rx_title')}</span>
        <Tag kind="read" />
        {rx.conf && <span className="display text-[12px] text-blue">· {CONF[rx.conf] ? ui(CONF[rx.conf]) : rx.conf}</span>}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5">
        <span className="text-[12.5px] text-ink2">Plugin <b className="ms-1 font-semibold text-ink">{res.name}</b></span>
        {rows.map(([k, v]) => (
          <span key={k} className="text-[12.5px] text-ink2">{k} <b className="val ms-1 font-semibold text-ink">{v}</b></span>
        ))}
      </div>
      {res.missing && <p className="mt-1.5 text-[12px] text-red">{ui('rx_missing')} <b>{res.name}</b></p>}
      <p className="mt-1.5 text-[12px] text-ink2">{ui('rx_start')}</p>
      {wt && (
        <div className="mt-2">
          <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
                  className="text-[12.5px] font-semibold text-ink2 transition-colors hover:text-ink">
            <span className="val text-red">{open ? '−' : '+'}</span> {ui('wt_btn')}
          </button>
          {open && (
            <ol className="ms-4 mt-1.5 list-decimal space-y-1 text-[13px] leading-relaxed text-ink2 [&_b]:val [&_b]:font-semibold [&_b]:text-ink">
              {wt.map((s, i) => <li key={i} dangerouslySetInnerHTML={{ __html: wtStepHTML(s, rx) }} />)}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
