import { useEffect, useRef, useState } from 'react'

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** THE TAPE STRIP — the sheet's one dark element, and the product's core instrument.
 *  Three lanes (Logic grammar): point flags · energy · chapter regions.
 *  Anchors are measured only: intro_sec, peak_moment_sec, duration. Never an invented "drop".
 *  The strip is LTR always — time does not mirror in Hebrew (Material bidi). */
export default function TapeStrip({ raw = {}, name, audio, selected, onSelect }) {
  const dur = raw.duration_sec || 0
  const curve = raw.energy_curve || []
  const intro = raw.intro_sec
  const peak = raw.peak_moment_sec
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const laneRef = useRef(null)

  useEffect(() => {
    setT(0); setPlaying(false)
    if (!audio) return
    let raf = 0
    const loop = () => { setT(audio.currentTime); raf = requestAnimationFrame(loop) }
    const onPlay = () => { setPlaying(true); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop) }
    const onPause = () => { setPlaying(false); cancelAnimationFrame(raf); setT(audio.currentTime) }
    const onTime = () => { if (audio.paused) setT(audio.currentTime) }
    audio.addEventListener('play', onPlay); audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onPause); audio.addEventListener('timeupdate', onTime)
    return () => { cancelAnimationFrame(raf)
      audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onPause); audio.removeEventListener('timeupdate', onTime) }
  }, [audio])

  const seek = sec => {
    const s = Math.max(0, Math.min(sec, dur))
    if (audio) audio.currentTime = s
    setT(s)
  }
  const seekFromEvent = e => {
    const r = laneRef.current.getBoundingClientRect()
    seek(((e.clientX - r.left) / r.width) * dur)
  }
  const toggle = () => { if (!audio) return; audio.paused ? audio.play() : audio.pause() }

  const X = sec => `${(sec / Math.max(dur, 1)) * 100}%`
  const minuteMarks = []
  for (let m = 0; m * 60 < dur; m++) minuteMarks.push(m * 60)

  const chapters = intro
    ? [{ id: 'Intro', label: 'אינטרו', t0: 0, t1: intro }, { id: null, label: 'גוף', t0: intro, t1: dur }]
    : []

  return (
    <section dir="ltr" className="border-y border-ink bg-tape text-bone">
      <div className="relative px-4 pt-3 sm:px-6">

        {/* flag lane — measured point anchors only */}
        <div className="relative h-[24px]">
          {peak != null && dur > 0 && (
            <button onClick={() => seek(peak)} style={{ left: X(peak) }}
                    className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-bone/80 transition-colors hover:text-bone">
              <span className="val">▾</span> שיא <span className="val">{fmt(peak)}</span>
            </button>
          )}
          {intro != null && dur > 0 && (
            <button onClick={() => onSelect?.('Intro')} style={{ left: X(intro) }}
                    className={`val absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold transition-colors ${selected === 'Intro' ? 'text-red' : 'text-bone/80 hover:text-bone'}`}>
              ▾ {fmt(intro)}
            </button>
          )}
        </div>

        {/* energy lane — the measured curve, printed */}
        <div ref={laneRef} className="relative h-[72px] cursor-crosshair" onPointerDown={seekFromEvent}>
          <svg viewBox={`0 0 ${Math.max(curve.length, 1)} 64`} preserveAspectRatio="none"
               className="block h-full w-full" aria-hidden>
            {curve.map((v, i) => (
              <rect key={i} x={i + 0.12} width="0.76" y={64 - Math.max(v * 60, 1.5)}
                    height={Math.max(v * 60, 1.5)} fill="var(--color-bone)" opacity=".82" />
            ))}
          </svg>

          {/* selected finding's span lights the whole column */}
          {selected === 'Intro' && intro != null && (
            <span className="pointer-events-none absolute inset-y-0 border-x border-red bg-red/20"
                  style={{ left: 0, width: X(intro) }} aria-hidden />
          )}

          {/* playhead — information; moves even under reduced motion */}
          {dur > 0 && (
            <span className="pointer-events-none absolute inset-y-0 w-[2px] bg-red"
                  style={{ left: X(t) }} aria-hidden />
          )}
        </div>

        {/* chapter lane — regions from measured anchors, YouTube-style gaps */}
        {chapters.length > 0 && (
          <div className="relative mt-[6px] h-[18px]">
            {chapters.map(c => (
              <button key={c.label}
                      onClick={() => c.id ? onSelect?.(c.id) : seek(c.t0)}
                      style={{ left: `calc(${X(c.t0)} + 1px)`, width: `calc(${X((c.t1 - c.t0))} - 2px)` }}
                      className={`absolute inset-y-0 overflow-hidden text-[10px] font-semibold transition-colors
                        ${c.id && selected === c.id ? 'bg-red/30 text-bone' : 'bg-bone/[.14] text-bone/70 hover:bg-bone/25 hover:text-bone'}`}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* ruler */}
        <div className="relative mt-[2px] h-[16px]">
          {minuteMarks.map(s => (
            <span key={s} className="absolute top-0" style={{ left: X(s) }}>
              <span className="block h-[4px] w-px bg-bone/40" />
              <span className="val absolute top-[4px] text-[9px] text-bone/50">{fmt(s)}</span>
            </span>
          ))}
          {dur > 0 && <span className="val absolute right-0 top-[4px] text-[9px] text-bone/50">{fmt(dur)}</span>}
        </div>
      </div>

      {/* transport — printed on the strip, not floating anywhere */}
      <div className="flex items-center gap-4 border-t border-bone/15 px-4 py-2.5 sm:px-6">
        <button onClick={toggle} disabled={!audio}
                title={audio ? '' : 'גרור קובץ שמע כדי להאזין'}
                className="grid h-[34px] w-[34px] place-items-center border border-bone/40 text-bone transition-colors enabled:hover:border-bone enabled:hover:bg-bone/10 disabled:opacity-30">
          {playing
            ? <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor" aria-label="עצור"><rect width="3.6" height="12" /><rect x="7.4" width="3.6" height="12" /></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-label="נגן"><path d="M1 0l11 6-11 6z" /></svg>}
        </button>
        <span className="val text-[12px] text-bone/80">{fmt(t)} / {fmt(dur)}</span>
        <span dir="auto" className="min-w-0 flex-1 truncate font-mono text-[12px] text-bone/50">{name}</span>
        <span className="val hidden text-[10px] text-bone/40 sm:block">TAPE · 96pt RMS</span>
      </div>
    </section>
  )
}
