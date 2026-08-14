// The player controller — one shared instrument for the tape strip, the
// finding cards and the priority button. Ported from web/index.html's
// sx*/gt*/fx* system: measured notes, loop-a-moment, guided tour, live A/B.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { sxMoments, sxConclusions, fixChainFromReport, fmt } from './report-utils.js'
import { fxEnsure, fxReset, fxSolo, fxMonoOn, fxApplyMoves } from './fx.js'

export function usePlayer({ rep, audio, ui, hasFile }) {
  const raw = rep?._raw || {}
  const dur = raw.duration_sec || 0
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [caption, setCaption] = useState(null)       // {text, sev, t0}
  const [activeIdx, setActiveIdx] = useState(-1)     // active note (loop/region)
  const [fxOn, setFxOn] = useState(null)             // 'band:250' | 'mono' | 'fix' | 'loop:<fid>' | null
  const [gtOn, setGtOn] = useState(false)
  const loopRef = useRef(null)
  const gtTimer = useRef(null)
  const surfRef = useRef(-1)                          // last self-surfaced note

  const notes = useMemo(() => {
    if (!rep) return []
    const ns = sxMoments(rep).map(m => ({ ...m }))
    if (dur && typeof raw.peak_moment_sec === 'number' && raw.peak_moment_sec > 0)
      ns.push({ t0: Math.max(0, raw.peak_moment_sec - 3), t1: Math.max(0, raw.peak_moment_sec - 3),
        sev: 'good', text: ui('gt_peak'), peakAt: raw.peak_moment_sec })
    return ns
  }, [rep, ui]) // eslint-disable-line react-hooks/exhaustive-deps

  const reads = useMemo(() => rep ? sxConclusions(raw, ui) : [], [rep, ui]) // eslint-disable-line react-hooks/exhaustive-deps
  const fixMoves = useMemo(() => rep ? fixChainFromReport(rep) : [], [rep])

  // transport state + loop cycling
  useEffect(() => {
    setT(0); setPlaying(false); setCaption(null); setActiveIdx(-1); setFxOn(null)
    loopRef.current = null; surfRef.current = -1
    if (!audio) return
    let raf = 0
    const paint = () => {
      const ct = audio.currentTime
      if (loopRef.current && ct > loopRef.current[1]) audio.currentTime = loopRef.current[0]
      setT(audio.currentTime)
      raf = requestAnimationFrame(paint)
    }
    const onPlay = () => { setPlaying(true); cancelAnimationFrame(raf); raf = requestAnimationFrame(paint) }
    const onPause = () => { setPlaying(false); cancelAnimationFrame(raf); setT(audio.currentTime) }
    const onTime = () => { if (audio.paused) setT(audio.currentTime) }
    audio.addEventListener('play', onPlay); audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onPause); audio.addEventListener('timeupdate', onTime)
    return () => { cancelAnimationFrame(raf)
      audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onPause); audio.removeEventListener('timeupdate', onTime) }
  }, [audio])

  const toggle = useCallback(() => {
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [audio])

  const say = useCallback(m => setCaption({ text: m.text, sev: m.sev || '', t0: m.t0 }), [])

  const clearSel = useCallback(() => {
    setActiveIdx(-1); surfRef.current = -1; loopRef.current = null; setFxOn(null)
  }, [])

  const gtStop = useCallback(() => {
    setGtOn(false); clearTimeout(gtTimer.current); loopRef.current = null; setCaption(null)
  }, [])

  const activate = useCallback((i, andPlay) => {
    const m = notes[i]; if (!m) return
    setActiveIdx(i); surfRef.current = i
    fxReset(); setFxOn(m.t0 !== m.t1 ? 'loop:' + (m.fid || i) : null)
    loopRef.current = (m.t0 !== m.t1) ? [m.t0, m.t1] : null
    say(m)
    if (audio) { audio.currentTime = m.t0; if (andPlay && audio.paused) toggle() }
  }, [notes, audio, say, toggle])

  const seekTo = useCallback(sec => {
    gtStop(); clearSel(); fxReset()
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(sec, (audio.duration || dur) - 0.2))
    if (audio.paused) toggle()
  }, [audio, dur, toggle, gtStop, clearSel])

  const loopFinding = useCallback((fid, t0, t1) => {
    const on = fxOn === 'loop:' + fid
    fxReset()
    if (on) { clearSel(); return }
    loopRef.current = [t0, t1]; setFxOn('loop:' + fid)
    const ni = notes.findIndex(m => Math.abs(m.t0 - t0) < 0.06)
    if (ni >= 0) { setActiveIdx(ni); surfRef.current = ni; say(notes[ni]) }
    if (audio) { audio.currentTime = t0; if (audio.paused) toggle() }
  }, [fxOn, notes, audio, say, toggle, clearSel])

  const soloBand = useCallback(f => {
    const key = 'band:' + f
    const on = fxOn === key
    if (!fxEnsure(audio)) return
    fxReset(); loopRef.current = null; setActiveIdx(-1)
    if (on) { setFxOn(null); return }
    fxSolo(f); setFxOn(key)
    if (audio.paused) toggle()
  }, [fxOn, audio, toggle])

  const monoToggle = useCallback(() => {
    const on = fxOn === 'mono'
    if (!fxEnsure(audio)) return
    fxReset(); loopRef.current = null; setActiveIdx(-1)
    if (on) { setFxOn(null); return }
    fxMonoOn(); setFxOn('mono')
    if (audio.paused) toggle()
  }, [fxOn, audio, toggle])

  const fixToggle = useCallback(() => {
    const on = fxOn === 'fix'
    if (!fxEnsure(audio)) return
    fxReset(); loopRef.current = null
    if (on) { setFxOn(null); return }
    fxApplyMoves(fixMoves); setFxOn('fix')
    if (audio.paused) toggle()
  }, [fxOn, audio, fixMoves, toggle])

  // guided tour — measured anchors only; any manual action hands back the wheel
  const gtStart = useCallback(() => {
    if (!audio || !rep) return
    const steps = []
    if (raw.intro_sec > 3) steps.push({ t: Math.max(0, raw.intro_sec - 3), d: 7, txt: ui('gt_intro') })
    notes.forEach((m, i) => { if (m.sev !== 'good') steps.push({ note: i, d: Math.min(9, Math.max(5, (m.t1 - m.t0) || 6)) }) })
    const pk = notes.findIndex(m => m.peakAt != null)
    if (pk >= 0) steps.push({ note: pk, d: 8 })
    if (!steps.length) return
    setGtOn(true)
    let i = 0
    const step = () => {
      if (!audio) return gtStop()
      if (i >= steps.length) {
        audio.pause(); loopRef.current = null
        say({ text: ui('gt_done'), sev: '' })
        setGtOn(false)
        gtTimer.current = setTimeout(() => setCaption(null), 5000)
        return
      }
      const s = steps[i++]
      if (s.note != null) activate(s.note, true)
      else {
        fxReset(); loopRef.current = null; setActiveIdx(-1)
        audio.currentTime = s.t
        if (audio.paused) toggle()
        say({ text: s.txt, sev: '' })
      }
      gtTimer.current = setTimeout(step, s.d * 1000)
    }
    step()
  }, [audio, rep, notes, ui, activate, say, toggle, gtStop]) // eslint-disable-line react-hooks/exhaustive-deps

  const gtToggle = useCallback(() => { gtOn ? gtStop() : gtStart() }, [gtOn, gtStop, gtStart])

  // SoundCloud grammar: notes surface as the playhead crosses them —
  // never over an explicit selection
  useEffect(() => {
    if (!audio || audio.paused || !dur || gtOn || activeIdx >= 0) return
    const c = notes.findIndex(m => t >= m.t0 - 1 && t <= (m.t0 === m.t1 ? m.t0 + 4 : m.t1))
    if (c !== surfRef.current) { surfRef.current = c; if (c >= 0) say(notes[c]) }
  }, [t, audio, dur, gtOn, activeIdx, notes, say])

  // keyboard grammar (W3C APG) — active while the report screen is mounted
  useEffect(() => {
    if (!audio) return
    const onKey = e => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return
      const d = audio.duration || 0; if (!d) return
      const seek = dd => { gtStop(); clearSel(); audio.currentTime = Math.max(0, Math.min(d - 0.2, audio.currentTime + dd)) }
      if (e.code === 'Space') { e.preventDefault(); gtStop(); toggle() }
      else if (e.key === 'ArrowRight') seek(5)
      else if (e.key === 'ArrowLeft') seek(-5)
      else if (e.key === 'PageUp') seek(15)
      else if (e.key === 'PageDown') seek(-15)
      else if (e.key === 'Home') { gtStop(); clearSel(); audio.currentTime = 0 }
      else if (e.key === 'Escape') { gtStop(); clearSel() }
      else if (/^[1-9]$/.test(e.key) && notes[+e.key - 1]) { gtStop(); activate(+e.key - 1, true) }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [audio, notes, toggle, activate, gtStop, clearSel])

  return {
    audio, t, dur, playing, caption, notes, reads, activeIdx, fxOn, gtOn, hasFile,
    fixMoves, fmt,
    toggle, seekTo, activate, loopFinding, soloBand, monoToggle, fixToggle, gtToggle,
    gtStop, clearSel, say,
  }
}
