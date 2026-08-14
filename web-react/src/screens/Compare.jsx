import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { reportLink, downloadCard } from '../lib/share.js'

/** V2 — a REAL comparison between two analyzed reports. Honest even when the
 *  new version is worse: hero, verdict and colors all follow the measurement. */
export default function Compare() {
  const { ui, dir } = useLang()
  const { cmp, toast, isDemo, compareUpload, compareDemo } = useSession()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const data = useMemo(() => {
    if (!cmp) return null
    const { v1, v2 } = cmp
    const map1 = {}; (v1.findings || []).forEach(f => { map1[f.id] = f })
    const map2 = {}; (v2.findings || []).forEach(f => { map2[f.id] = f })
    // prescription follow-up: every v1 problem gets a verdict in v2
    const follow = (v1.findings || []).filter(f => f.sev === 'warn' || f.sev === 'crit').map(f1 => {
      const f2 = map2[f1.id]
      const state = (!f2 || f2.sev === 'good') ? 'fixed' : (f2.score > f1.score + 3 ? 'better' : 'still')
      return { k: f1.k, state }
    })
    // per-finding deltas by stable id
    const rows = []
    ;(v2.findings || []).forEach(f2 => { const f1 = map1[f2.id]; if (f1 && f1.score !== f2.score) rows.push({ k: f2.k, old: f1.score, neu: f2.score }) })
    rows.push({ k: ui('overall'), old: v1.overall, neu: v2.overall })
    const t1 = (v1.ai_signals || {}).count, t2 = (v2.ai_signals || {}).count
    if (t1 !== undefined && t2 !== undefined && t1 !== t2) rows.push({ k: ui('ai_row'), old: t1, neu: t2, lowGood: true })
    return { v1, v2, follow, rows, up: v2.overall - v1.overall }
  }, [cmp, ui])

  if (!data) {
    return (
      <section className="px-6 py-[18vh] text-center">
        <p className="text-[14.5px] text-ink2">{ui('rk_no_report')}</p>
        <button className="btn mt-6" onClick={() => navigate('/')}>{ui('rk_measure_btn')}</button>
      </section>
    )
  }
  const { v2, follow, rows, up } = data
  const FOLLOW = { fixed: ['✓', 'text-ok'], better: ['↑', 'text-ok'], still: ['✗', 'text-red'] }

  const share = async () => {
    try { await navigator.clipboard.writeText(await reportLink(v2)); toast(ui('toast_link')) }
    catch { downloadCard(v2, 'v2', ui, dir === 'rtl', () => toast(ui('card_dl'))) }
  }

  return (
    <section className="mx-auto max-w-[760px] px-[clamp(18px,4vw,40px)] py-[clamp(28px,6vh,56px)]">
      <span className="lbl">{ui('v2_eyebrow')}</span>
      <h1 className="display mt-2 max-w-[24ch] text-[clamp(24px,4vw,38px)] font-medium leading-[1.25] [text-wrap:balance] [&_b]:text-red"
          dangerouslySetInnerHTML={{ __html: up > 0 ? ui('v2_hero_up')(data.v1.overall, v2.overall) : up === 0 ? ui('v2_hero_flat')(v2.overall) : ui('v2_hero_down')(data.v1.overall, v2.overall) }} />
      <p className="mt-2 text-[13.5px] text-ink2">{ui('v2_sub')}</p>

      {/* prescription follow-up */}
      {follow.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1.5">
          {follow.map(f => (
            <span key={f.k} className="flex items-baseline gap-2 text-[13.5px]">
              <b className={`val ${FOLLOW[f.state][1]}`}>{FOLLOW[f.state][0]}</b>
              <span className="font-semibold">{f.k}</span>
              <i className="text-[12px] not-italic text-ink2">{ui('v2_' + f.state)}</i>
            </span>
          ))}
        </div>
      )}

      {/* deltas */}
      <div className="mt-6">
        {rows.map(d => {
          const better = d.lowGood ? d.old - d.neu : d.neu - d.old
          const sign = better >= 0 ? (d.lowGood ? '−' : '+') : (d.lowGood ? '+' : '−')
          return (
            <div key={d.k} className="rule-t grid grid-cols-[1fr_auto] items-baseline gap-x-6 py-2.5">
              <span className="text-[13.5px] font-semibold">
                {d.k}{d.lowGood && <small className="ms-2 font-normal text-ink2">{ui('lower_better')}</small>}
              </span>
              <span className="val text-[14px]">
                <span className="text-ink2">{d.old}</span>
                <span className="mx-2 text-ink2">→</span>
                <b className={better < 0 ? 'text-red' : ''}>{d.neu}</b>
                <span className={`ms-3 text-[12px] font-semibold ${better < 0 ? 'text-red' : 'text-ok'}`}>{sign}{Math.abs(better)}</span>
              </span>
            </div>
          )
        })}
      </div>

      {/* verdict — honest even when v2 is worse */}
      <div className={`mt-8 border-s-2 ps-4 ${up >= 0 ? 'border-ok' : 'border-red'}`}>
        <span className="lbl">{ui('v2_badge')}</span>
        <p className="display mt-1 max-w-[30ch] text-[clamp(18px,2.6vw,24px)] font-medium leading-snug">
          {up > 3 ? ui('v2_verdict_up') : up >= 0 ? ui('v2_verdict_flat') : ui('v2_verdict_down')}
        </p>
      </div>

      {/* this song's progress — v1 vs v2 bars */}
      <div className="mt-8">
        <span className="lbl">{ui('v2_progress')}</span>
        <div dir="ltr" className="mt-2 flex items-end gap-6">
          {[{ l: 'v1', s: data.v1.overall }, { l: 'v2', s: v2.overall, cur: true }].map(v => (
            <div key={v.l} className="text-center">
              <div className="val text-[13px] font-semibold">{v.s}</div>
              <div className={`mx-auto w-[34px] ${v.cur ? 'bg-red' : 'bg-rule'}`} style={{ height: Math.max(8, v.s) }} />
              <div className="val mt-1 text-[11px] text-ink2">{v.l}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 text-[13.5px] text-ink2">{ui('v2_keep')}</p>
      <input ref={fileRef} type="file" accept="audio/*" hidden
             onChange={e => { const f = e.target.files?.[0]; if (f) compareUpload(f); e.target.value = '' }} />
      <div className="mt-3 flex flex-wrap gap-3">
        <button className="btn bg-ink text-paper" onClick={() => navigate('/')}>{ui('v2_another')}</button>
        <button className="btn" onClick={() => isDemo.current ? compareDemo() : fileRef.current?.click()}>{ui('regen_upload')}</button>
        <button className="btn" onClick={share}>{ui('v2_share')}</button>
      </div>
    </section>
  )
}
