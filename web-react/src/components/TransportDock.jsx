import { useEffect, useRef, useState } from 'react'

/** THE DOCK — transport pinned to the floor: glowing waveform, click-to-seek, timecodes. */
export default function TransportDock({ curve = [], duration = 0, audio = null, trackName = '—' }) {
  const cvRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)

  useEffect(() => {
    let raf
    const draw = () => {
      const cv = cvRef.current
      if (cv) {
        const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1
        cv.width = w * dpr; cv.height = h * dpr
        const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, h)
        const n = curve.length || 96, bw = w / n
        const prog = audio && duration ? audio.currentTime / duration : 0
        for (let i = 0; i < n; i++) {
          const v = curve[i] ?? 0.08
          const bh = Math.max(2, v * (h - 8))
          c.fillStyle = (i + 0.5) / n <= prog ? '#3DF5A6' : 'rgba(237,239,242,.22)'
          c.fillRect(i * bw, h - bh, Math.max(1.2, bw - 2), bh)
        }
        if (audio) setT(audio.currentTime)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [curve, duration, audio])

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const toggle = () => {
    if (!audio) return
    if (audio.paused) { audio.play(); setPlaying(true) } else { audio.pause(); setPlaying(false) }
  }
  const seek = (e) => {
    if (!audio || !duration) return
    const r = e.currentTarget.getBoundingClientRect()
    audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration
    if (audio.paused) toggle()
  }

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[.07] px-[clamp(20px,4vw,54px)] pb-4 pt-3.5 backdrop-blur-xl"
            style={{ background: 'color-mix(in srgb, var(--color-bg) 78%, transparent)' }}>
      <div className="mx-auto flex max-w-[1180px] items-center gap-4">
        <button onClick={toggle} disabled={!audio} aria-label="נגן / השהה"
                className="hairline-2 grid h-[46px] w-[46px] flex-shrink-0 place-items-center rounded-full bg-panel transition
                           enabled:hover:border-sig enabled:hover:shadow-[0_0_18px_-6px_var(--color-sig)] enabled:active:scale-95 disabled:opacity-35">
          {playing
            ? <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
            : <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        <div dir="ltr" onClick={seek} className="relative h-14 flex-1 cursor-pointer">
          <canvas ref={cvRef} className="absolute inset-0 h-full w-full"
                  style={{ filter: 'drop-shadow(0 0 9px rgba(61,245,166,.28))' }} />
        </div>
        <span dir="ltr" className="digits min-w-[96px] flex-shrink-0 text-center text-[11.5px] text-dim">
          {fmt(t)} / {fmt(duration)}
        </span>
        <span dir="ltr" className="digits max-w-[190px] flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] tracking-[.1em] text-faint">
          {trackName}
        </span>
      </div>
      <div className="digits pt-2.5 text-center text-[9.5px] uppercase tracking-[.2em] text-faint">
        כל מספר על המסך — <b className="text-dim">נמדד</b>. הציון והספים — קריאת מפיק.
      </div>
    </footer>
  )
}
