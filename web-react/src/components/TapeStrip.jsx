import { useMemo, useRef, useState } from 'react'
import { useLang, T } from '../i18n/index.jsx'
import { fmt } from '../lib/report-utils.js'

/** THE TAPE STRIP — the sheet's one dark element, the product's core instrument.
 *  Lanes (Logic grammar): numbered pins · energy · chapter regions · ruler.
 *  Below: producer captions, measured conclusions, guided tour, fix preview.
 *  Anchors are measured only — never an invented "drop". Strip is LTR always. */
export default function TapeStrip({ rep, name, player, selected, onSelect }) {
  const { ui } = useLang()
  const raw = rep?._raw || {}
  const dur = raw.duration_sec || 0
  const curve = (raw.energy_curve && raw.energy_curve.length > 7) ? raw.energy_curve : []
  const intro = raw.intro_sec
  const norms = (raw.norms && raw.norms.intro_sec) || null
  const introLate = !!(norms && (intro || 0) > norms[1])
  const laneRef = useRef(null)
  const [hover, setHover] = useState(null)
  const { audio, t, playing, caption, notes, reads, activeIdx, gtOn, fixMoves, hasFile } = player

  const X = sec => `${(sec / Math.max(dur, 1)) * 100}%`

  // pins: moments within ~2.6% collapse into ONE counted pin; clicking cycles
  const pinGroups = useMemo(() => {
    const groups = []
    notes.forEach((m, i) => {
      if (!dur) return
      const mid = ((m.peakAt != null ? m.peakAt : (m.t0 + m.t1) / 2) / dur) * 100
      const g = groups.find(g => Math.abs(g.mid - mid) < 2.6)
      if (g) { g.idx.push(i); g.mid = (g.mid * (g.idx.length - 1) + mid) / g.idx.length }
      else groups.push({ mid, idx: [i], cur: 0 })
    })
    return groups
  }, [notes, dur])

  const seekFromEvent = e => {
    if (!audio || !dur) return
    player.gtStop()
    const r = laneRef.current.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const tt = f * dur
    const mi = notes.findIndex(m => m.t0 !== m.t1 && tt >= m.t0 && tt <= m.t1)
    if (mi >= 0) { player.activate(mi, true); return }   // clicking a measured moment loops it
    player.clearSel()
    audio.currentTime = f * (audio.duration || dur)
    if (audio.paused) player.toggle()
  }
  const onMove = e => {
    if (!dur) return
    const r = laneRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left))
    const tt = dur * x / r.width
    const m = notes.find(m => tt >= m.t0 && tt <= (m.t0 === m.t1 ? m.t0 + 2 : m.t1))
    const text = m ? `${m.text} · ${fmt(tt)}`
      : `${fmt(tt)} · ${(intro > 3 && tt < intro) ? ui('lg_intro') : ui('lg_body')}`
    setHover({ x, text, insight: !!m })
  }

  const chapters = intro > 3 && dur
    ? [{ id: 'Intro', label: ui('lg_intro'), t0: 0, t1: intro, late: introLate },
       { id: null, label: ui('lg_body'), t0: intro, t1: dur }]
    : []

  const activeNote = notes[activeIdx]
  const region = activeNote && activeNote.t0 !== activeNote.t1 ? activeNote : null
  const SEV_TAPE = { crit: 'bg-red text-paper', warn: 'bg-red/80 text-paper', good: 'bg-ok text-paper' }

  return (
    <section dir="ltr" className="border-y border-ink bg-tape text-bone">
      <div className="relative px-4 pt-2 sm:px-6">

        {/* pin lane — numbered measured moments (keyboard: 1–9) */}
        <div className="relative h-[24px]">
          {pinGroups.map((g, gi) => {
            const sev = g.idx.some(i => notes[i].sev === 'crit') ? 'crit'
              : g.idx.some(i => notes[i].sev === 'warn') ? 'warn' : 'good'
            const on = g.idx.includes(activeIdx)
            return (
              <button key={gi} type="button"
                      style={{ left: `${Math.max(1.5, Math.min(98.5, g.mid))}%` }}
                      aria-label={g.idx.map(i => (i + 1) + ' · ' + notes[i].text).join(' | ')}
                      onClick={e => { e.stopPropagation(); player.gtStop(); player.activate(g.idx[g.cur++ % g.idx.length], true) }}
                      className={`val absolute top-[2px] grid h-[18px] min-w-[18px] -translate-x-1/2 place-items-center px-1 text-[10px] font-semibold transition-transform ${SEV_TAPE[sev]} ${on ? 'scale-125' : 'opacity-85 hover:opacity-100'}`}>
                {g.idx.length > 1 ? '×' + g.idx.length : g.idx[0] + 1}
              </button>
            )
          })}
        </div>

        {/* energy lane — the measured curve, printed */}
        <div ref={laneRef} className="relative h-[72px] cursor-crosshair"
             onPointerDown={seekFromEvent} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${Math.max(curve.length, 1)} 64`} preserveAspectRatio="none"
               className="block h-full w-full" aria-hidden>
            {curve.map((v, i) => (
              <rect key={i} x={i + 0.12} width="0.76" y={64 - Math.max(v * 60, 1.5)}
                    height={Math.max(v * 60, 1.5)}
                    fill="var(--color-bone)" opacity={dur && (i + 0.5) / curve.length <= t / dur ? '1' : '.5'} />
            ))}
          </svg>

          {/* the active note's span / selected Intro finding */}
          {region && (
            <span className={`pointer-events-none absolute inset-y-0 border-x ${region.sev === 'good' ? 'border-ok bg-ok/20' : 'border-red bg-red/20'}`}
                  style={{ left: X(region.t0), width: `calc(${X(region.t1)} - ${X(region.t0)})` }} aria-hidden />
          )}
          {!region && selected === 'Intro' && intro != null && (
            <span className="pointer-events-none absolute inset-y-0 border-x border-red bg-red/20"
                  style={{ left: 0, width: X(intro) }} aria-hidden />
          )}

          {/* hover hairline + producer-first tooltip */}
          {hover && (
            <>
              <span className="pointer-events-none absolute inset-y-0 w-px bg-bone/60" style={{ left: hover.x }} aria-hidden />
              <span className={`val pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 text-[10px] ${hover.insight ? 'bg-red text-paper' : 'bg-bone text-tape'}`}
                    style={{ left: Math.max(60, Math.min((laneRef.current?.clientWidth || 200) - 60, hover.x)) }}>
                {hover.text}
              </span>
            </>
          )}

          {/* playhead — information; moves under reduced motion too */}
          {dur > 0 && (
            <span className="pointer-events-none absolute inset-y-0 w-[2px] bg-red"
                  style={{ left: X(t) }} aria-hidden />
          )}
        </div>

        {/* chapter lane — regions from measured anchors only */}
        {chapters.length > 0 && (
          <div className="relative mt-[6px] h-[18px]">
            {chapters.map(c => (
              <button key={c.label} title={`${c.label} · ${fmt(c.t0)}`}
                      onClick={() => c.id ? onSelect?.(c.id) : player.seekTo(c.t0)}
                      style={{ left: `calc(${X(c.t0)} + 1px)`, width: `calc(${X(c.t1 - c.t0)} - 2px)` }}
                      className={`absolute inset-y-0 overflow-hidden whitespace-nowrap text-[10px] font-semibold transition-colors
                        ${c.late ? 'bg-red/25 text-bone' : c.id && selected === c.id ? 'bg-red/30 text-bone' : 'bg-bone/[.14] text-bone/70 hover:bg-bone/25 hover:text-bone'}`}>
                {c.label} <small className="val opacity-70">{fmt(c.t0)}</small>
              </button>
            ))}
          </div>
        )}

        {/* ruler — 5 quiet ticks, always LTR */}
        <div className="relative mt-[2px] h-[16px]">
          {dur > 0 && [0, .25, .5, .75].map(f => (
            <span key={f} className="absolute top-0" style={{ left: `${f * 100}%` }}>
              <span className="block h-[4px] w-px bg-bone/40" />
              <span className="val absolute top-[4px] text-[9px] text-bone/50">{fmt(f * dur)}</span>
            </span>
          ))}
          {dur > 0 && <span className="val absolute right-0 top-[4px] text-[9px] text-bone/50">{fmt(dur)}</span>}
        </div>
      </div>

      {/* transport — printed on the strip */}
      <div className="flex items-center gap-3 border-t border-bone/15 px-4 py-2.5 sm:gap-4 sm:px-6">
        <button onClick={() => { player.gtStop(); player.toggle() }} disabled={!audio}
                title={audio ? '' : ui('rk_need_audio')}
                className="grid h-[34px] w-[34px] shrink-0 place-items-center border border-bone/40 text-bone transition-colors enabled:hover:border-bone enabled:hover:bg-bone/10 disabled:opacity-30">
          {playing
            ? <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor" aria-label={ui('rk_pause')}><rect width="3.6" height="12" /><rect x="7.4" width="3.6" height="12" /></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-label={ui('rk_play')}><path d="M1 0l11 6-11 6z" /></svg>}
        </button>
        <span className="val shrink-0 text-[12px] text-bone/80">{fmt(t)} / {fmt(dur)}</span>
        <span dir="auto" className="min-w-0 flex-1 truncate font-mono text-[12px] text-bone/50">{name}</span>
        {audio && notes.length > 0 && (
          <button onClick={player.gtToggle}
                  className={`shrink-0 border px-2.5 py-1 text-[11px] font-semibold transition-colors ${gtOn ? 'border-red bg-red text-paper' : 'border-bone/40 text-bone/80 hover:border-bone hover:text-bone'}`}>
            <span className={`me-1.5 inline-block h-[6px] w-[6px] rounded-full ${gtOn ? 'bg-paper' : 'bg-red'}`} aria-hidden />
            {ui('gt_btn')}
          </button>
        )}
      </div>

      {/* producer caption — the tour / active note speaks here */}
      {caption && (
        <div dir="auto" className={`border-t border-bone/15 px-4 py-2 text-[12.5px] sm:px-6 ${caption.sev === 'crit' ? 'text-red' : caption.sev === 'good' ? 'text-ok' : 'text-bone/90'}`}>
          {typeof caption.t0 === 'number' && <span className="val me-2 text-bone/50">{fmt(caption.t0)}</span>}
          {caption.text}
        </div>
      )}

      {/* measured conclusions — click to hear from that point */}
      {reads.length > 0 && (
        <div dir="auto" className="grid gap-x-6 gap-y-1 border-t border-bone/15 px-4 py-2.5 sm:grid-cols-2 sm:px-6">
          {reads.map(([sev, html, tt], i) => {
            const inner = (
              <>
                <span className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${sev === 'warn' ? 'bg-red' : 'bg-ok'}`} aria-hidden />
                {tt != null && <span className="val shrink-0 text-[10.5px] text-bone/50">{fmt(tt)}</span>}
                <span className="[&_b]:font-semibold [&_b]:text-bone" dangerouslySetInnerHTML={{ __html: html }} />
              </>
            )
            return tt != null && audio ? (
              <button key={i} type="button" onClick={() => player.seekTo(tt)}
                      className="flex items-start gap-2 text-start text-[12px] leading-relaxed text-bone/75 transition-colors hover:text-bone">
                {inner}
              </button>
            ) : (
              <div key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-bone/75">{inner}</div>
            )
          })}
        </div>
      )}

      {/* hear the fix — the prescription's corrective EQ, live on the track */}
      {hasFile && audio && fixMoves.length > 0 && (
        <div dir="auto" className="flex flex-wrap items-center gap-3 border-t border-bone/15 px-4 py-2.5 sm:px-6">
          <button onClick={player.fixToggle}
                  className={`border px-2.5 py-1 text-[11px] font-semibold transition-colors ${player.fxOn === 'fix' ? 'border-ok bg-ok text-paper' : 'border-bone/40 text-bone/80 hover:border-bone hover:text-bone'}`}>
            ▸ {ui('fixprev')}
          </button>
          <span className="val text-[10.5px] text-bone/50">
            {ui('fixprev_note')} — {fixMoves.map(m => `${m.g} dB @ ${m.f} Hz`).join(' · ')}
          </span>
        </div>
      )}

      {/* transport hides its meaning when the format can't play in this browser */}
      {!audio && (
        <T k="rk_need_audio" as="div" className="border-t border-bone/15 px-4 py-2 text-[11.5px] text-bone/40 sm:px-6" />
      )}
    </section>
  )
}
