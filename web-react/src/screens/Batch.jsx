import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { baseSongName } from '../lib/report-utils.js'

/** Batch — two very different desks share this screen: versions of ONE song
 *  get the shoot-out (per-axis leads); a folder of DIFFERENT songs gets the
 *  A&R demo-day ranking. Every axis is a real measurement. */
export default function Batch() {
  const { ui } = useLang()
  const { batch, openBatchItem } = useSession()
  const navigate = useNavigate()

  const view = useMemo(() => {
    if (!batch?.items) return null
    const items = batch.items
    const demoDay = new Set(items.map(it => baseSongName(it.file.name))).size > 1
    const name = f => f.name.replace(/\.[^.]+$/, '')
    if (demoDay) {
      const sorted = [...items].sort((a, b) => b.rep.overall - a.rep.overall)
      return { demoDay, items: sorted, name, heroHTML: ui('bt_demos_hero')(name(sorted[0].file)) }
    }
    const stScore = it => { const s = it.rep.streaming; return s ? s.checks.filter(c => c.ok).length - s.platforms.filter(p => p.mode === 'quiet').length : -99 }
    const axes = [
      { lbl: ui('overall'), fmt: it => it.rep.overall, score: it => it.rep.overall },
      { lbl: 'LUFS', fmt: it => it.rep._raw.lufs, score: it => { const n = it.rep._raw.norms.lufs; return -Math.abs(it.rep._raw.lufs - (n[0] + n[1]) / 2) } },
      { lbl: ui('bt_intro'), fmt: it => Math.round(it.rep._raw.intro_sec) + 's',
        score: it => { const [lo, hi] = it.rep._raw.norms.intro_sec, v = it.rep._raw.intro_sec; return (v >= lo && v <= hi) ? 0 : -Math.min(Math.abs(v - lo), Math.abs(v - hi)) } },
      { lbl: ui('bt_dyn'), fmt: it => it.rep._raw.dynamic_range_db + ' dB', score: it => it.rep._raw.dynamic_range_db },
      { lbl: ui('ai_row'), fmt: it => (it.rep.ai_signals || {}).count || 0, score: it => -((it.rep.ai_signals || {}).count || 0) },
      { lbl: ui('bt_stream'), fmt: it => { const s = it.rep.streaming; return s ? s.checks.filter(c => c.ok).length + '/' + s.checks.length : '—' }, score: stScore },
    ]
    const leads = axes.map(ax => { const sc = items.map(ax.score); const best = Math.max(...sc); return sc.map(s => s === best) })
    const credit = items.map((_, i) => leads.reduce((a, l) => a + (l[i] ? 1 : 0), 0))
    let win = 0; items.forEach((it, i) => { if (credit[i] > credit[win] || (credit[i] === credit[win] && it.rep.overall > items[win].rep.overall)) win = i })
    return { demoDay, items, axes, leads, win, name, heroHTML: ui('bt_hero')(name(items[win].file), credit[win], axes.length) }
  }, [batch, ui])

  if (!batch) {
    return (
      <section className="px-6 py-[18vh] text-center">
        <p className="text-[14.5px] text-ink2">{ui('drop_multi')}</p>
        <button className="btn mt-6" onClick={() => navigate('/')}>{ui('rk_measure_btn')}</button>
      </section>
    )
  }

  const flags = it => {
    const r = it.rep, raw = r._raw || {}, out = []
    const aiN = (r.ai_signals || {}).count || 0
    if (aiN) out.push([`${ui('fl_ai')} ×${aiN}`, r.ai_signals.level === 'crit'])
    if (raw.clipping) out.push([ui('fl_clip'), true])
    if ((r.streaming && r.streaming.platforms || []).some(p => p.mode === 'quiet')) out.push([ui('fl_quiet'), false])
    return out.length ? out : [[ui('fl_clean'), null]]
  }

  return (
    <section className="mx-auto max-w-[920px] px-[clamp(18px,4vw,40px)] py-[clamp(28px,6vh,56px)]">
      <span className="lbl">{ui(view?.demoDay ? 'bt_demos_eyebrow' : 'bt_eyebrow')}</span>

      {/* honest progress — one row per file, sequential */}
      {!batch.items && (
        <>
          <h1 className="display mt-2 text-[clamp(22px,3.4vw,32px)] font-medium">
            {ui('bt_analyzing')(batch.done + 1, batch.total)}
          </h1>
          <div className="mt-6 max-w-[560px]">
            {batch.rows.map((r, i) => (
              <div key={i} className={`rule-t flex items-center gap-3 py-2.5 text-[13.5px] ${r.state === 'wait' ? 'opacity-40' : ''}`}>
                <span className="grid h-[18px] w-[18px] place-items-center border border-ink text-[11px]">
                  {r.state === 'done' ? <span className="val text-ok">✓</span>
                    : r.state === 'fail' ? <span className="val text-red">✕</span>
                    : r.state === 'run' ? <span className="spin" aria-hidden /> : null}
                </span>
                <bdi className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{r.name}</bdi>
                {r.overall != null && <span className="val text-[13px] font-semibold">{r.overall}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {view && (
        <>
          <h1 className="display mt-2 max-w-[26ch] text-[clamp(22px,3.4vw,32px)] font-medium leading-[1.25] [&_b]:text-red"
              dangerouslySetInnerHTML={{ __html: view.heroHTML }} />
          <p className="mt-2 text-[13.5px] text-ink2">{ui(view.demoDay ? 'bt_demos_sub' : 'bt_sub')}</p>

          <div className="mt-6 overflow-x-auto">
            {view.demoDay ? (
              <table className="w-full border-collapse text-[13px]">
                <thead><tr className="lbl">
                  <th className="border-b border-ink pb-1.5 pe-3 text-start font-semibold">#</th>
                  <th className="border-b border-ink pb-1.5 pe-3 text-start font-semibold">{ui('bt_track')}</th>
                  <th className="border-b border-ink pb-1.5 pe-3 text-start font-semibold">{ui('overall')}</th>
                  <th className="border-b border-ink pb-1.5 pe-3 text-start font-semibold">{ui('bt_genre')}</th>
                  <th className="border-b border-ink pb-1.5 pe-3 text-start font-semibold">BPM · KEY</th>
                  <th className="border-b border-ink pb-1.5 pe-3 text-start font-semibold">LUFS</th>
                  <th className="border-b border-ink pb-1.5 pe-3 text-start font-semibold"></th>
                  <th className="border-b border-ink pb-1.5 text-start font-semibold"></th>
                </tr></thead>
                <tbody>
                  {view.items.map((it, i) => {
                    const m = it.rep.meta || {}, raw = it.rep._raw || {}
                    return (
                      <tr key={i} className={`border-b border-rule ${i === 0 ? 'bg-sheet' : ''}`}>
                        <td className="val py-2 pe-3">{i + 1}</td>
                        <td className="py-2 pe-3 font-semibold"><bdi>{view.name(it.file)}</bdi>{i === 0 && <span className="val ms-1 text-red">★</span>}</td>
                        <td className={`val py-2 pe-3 ${i === 0 ? 'font-semibold text-red' : ''}`}>{it.rep.overall}</td>
                        <td className="py-2 pe-3 text-ink2">{m.genre || '—'}</td>
                        <td className="val py-2 pe-3" dir="ltr">{m.bpm || '—'} · {m.key || '—'}</td>
                        <td className="val py-2 pe-3" dir="ltr">{raw.lufs != null ? raw.lufs : '—'}</td>
                        <td className="py-2 pe-3">
                          {flags(it).map(([t, crit], j) => (
                            <span key={j} className={`me-1.5 text-[11px] font-semibold ${crit === true ? 'text-red' : crit === null ? 'text-ok' : 'text-ink2'}`}>{t}</span>
                          ))}
                        </td>
                        <td className="py-2"><button className="btn !py-0.5 text-[11.5px]" onClick={() => openBatchItem(it)}>{ui('bt_open')}</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead><tr className="lbl">
                  <th className="border-b border-ink pb-1.5 pe-3 text-start font-semibold">{ui('bt_ver')}</th>
                  {view.axes.map(a => <th key={a.lbl} className="border-b border-ink pb-1.5 pe-3 text-start font-semibold">{a.lbl}</th>)}
                  <th className="border-b border-ink pb-1.5 text-start font-semibold"></th>
                </tr></thead>
                <tbody>
                  {view.items.map((it, i) => (
                    <tr key={i} className={`border-b border-rule ${i === view.win ? 'bg-sheet' : ''}`}>
                      <td className="py-2 pe-3 font-semibold"><bdi>{view.name(it.file)}</bdi>{i === view.win && <span className="val ms-1 text-red">★</span>}</td>
                      {view.axes.map((a, j) => (
                        <td key={j} className={`val py-2 pe-3 ${view.leads[j][i] ? 'font-semibold text-red' : 'text-ink2'}`} dir="ltr">{a.fmt(it)}</td>
                      ))}
                      <td className="py-2"><button className="btn !py-0.5 text-[11.5px]" onClick={() => openBatchItem(it)}>{ui('bt_open')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-3 max-w-[70ch] text-[12px] leading-relaxed text-ink2">{ui(view.demoDay ? 'bt_demos_note' : 'bt_note')}</p>
          <button className="btn mt-6" onClick={() => navigate('/')}>{ui('bt_again')}</button>
        </>
      )}
    </section>
  )
}
