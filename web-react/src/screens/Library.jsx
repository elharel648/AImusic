import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { loadHistory, clearHistory } from '../lib/history.js'

/** Your desk — every real analysis, newest first, LED-readout tiles + the
 *  channel-meter sparkline. Two-step clear, no window.confirm. */
export default function Library() {
  const { ui, lang } = useLang()
  const { openEntry } = useSession()
  const navigate = useNavigate()
  const [h, setH] = useState(loadHistory)
  const [armed, setArmed] = useState(false)
  const armT = useRef(null)

  const fmtDate = ts => {
    try { return new Date(ts).toLocaleDateString(lang, { month: 'short', day: 'numeric' }) }
    catch { return new Date(ts).toLocaleDateString() }
  }
  const clear = () => {
    if (armed) { clearTimeout(armT.current); setArmed(false); clearHistory(); setH([]) }
    else { setArmed(true); armT.current = setTimeout(() => setArmed(false), 3000) }
  }

  return (
    <section className="mx-auto max-w-[920px] px-[clamp(18px,4vw,40px)] py-[clamp(28px,6vh,56px)]">
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="display text-[clamp(24px,3.6vw,34px)] font-medium">{ui('hist_title')}</h1>
        <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
        {h.length > 0 && (
          <button onClick={clear}
                  className={`text-[12px] font-semibold underline decoration-rule underline-offset-4 ${armed ? 'text-red' : 'text-ink2 hover:text-ink'}`}>
            {ui(armed ? 'rk_lib_confirm' : 'hist_clear')}
          </button>
        )}
      </div>
      <p className="text-[13px] text-ink2">{ui('rk_lib_sub')}</p>

      {h.length === 0 && (
        <div className="py-[12vh] text-center">
          <p className="display text-[clamp(20px,3vw,28px)] text-ink2">{ui('hist_empty')}</p>
          <button className="btn mt-6" onClick={() => navigate('/')}>{ui('rk_measure_btn')}</button>
        </div>
      )}

      {h.length > 1 && (
        <div dir="ltr" className="mt-6 flex h-[42px] items-end gap-[4px]" aria-hidden>
          {h.map((e, i) => (
            <span key={e.ts} className={i === h.length - 1 ? 'bg-red' : 'bg-rule'}
                  style={{ width: 6, height: `${Math.max(7, e.overall)}%` }} />
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...h].reverse().map(e => {
          const bits = [
            e.lufs != null ? `${e.lufs} LUFS` : '', e.bpm ? `${e.bpm} BPM` : '',
            e.key || '', e.aiCount != null ? `AI ${e.aiCount}` : '',
          ].filter(Boolean).join(' · ')
          return (
            <button key={e.ts} disabled={!e.rep} onClick={() => openEntry(e)}
                    className="group border border-rule bg-sheet p-4 text-start transition-colors enabled:hover:border-ink disabled:cursor-default">
              <span className="flex items-baseline gap-2">
                <span className="val text-[30px] leading-none text-ink">{e.overall}</span>
                <span className="val text-[12px] text-ink2">/100</span>
                <span className="display ms-auto text-[11px] text-blue">{ui('tag_read')}</span>
              </span>
              <span className={`mt-2 block truncate border-t border-rule pt-2 text-[14px] font-semibold ${e.rep ? 'group-hover:text-red' : ''}`}>
                <bdi>{e.name}</bdi>
              </span>
              <span className="block text-[12px] text-ink2">{fmtDate(e.ts)}{e.genre ? ` · ${e.genre}` : ''}</span>
              {bits && <span className="val block text-[11.5px] text-ink2">{bits}</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
