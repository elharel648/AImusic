import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useLang, T, LANGS, LANG_LABELS } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { GENRES } from '../lib/plugin-kb.js'
import { loadHistory } from '../lib/history.js'
import { baseSongName } from '../lib/report-utils.js'
import { demo as fetchDemo } from '../lib/api.js'

/* ═══════════════════════════════════════════════════════════════════════
   THE STAGE — the front door IS the show.
   A dark console world greets the artist: the live demo rack breathes with
   REAL numbers from /api/demo, the claim is set big, and the moment a track
   lands the lights come up and the measurement sheet prints on paper.
   Dark at the door, ink-on-paper inside — the contrast is the show.
   ═══════════════════════════════════════════════════════════════════════ */

const C = {
  bg: '#08090B', panel: '#101216', panel2: '#15181D', line: '#23272E',
  bone: '#C9CDD4', dim: '#6B7280', green: '#3DDC84', red: '#FF453A', amber: '#E3A455', purple: '#A78BFA',
}
const PANEL = {
  background: `linear-gradient(180deg, ${C.panel2}, ${C.panel})`,
  border: `1px solid ${C.line}`,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.045), inset 0 -1px 0 rgba(0,0,0,.6), 0 10px 30px rgba(0,0,0,.55)',
  borderRadius: 10,
}
const Engrave = ({ children, color = C.dim }) => (
  <span className="val text-[10px] font-semibold uppercase" style={{ color, letterSpacing: '.18em' }}>{children}</span>
)

/* the analyzing moment, staged dark — same honest pacing, cinematic room */
function StageProgress({ deep, kind }) {
  const { ui } = useLang()
  const { name, file } = useSession()
  const steps = ui('steps')
  const [done, setDone] = useState(0)
  const [peaks, setPeaks] = useState(null)

  useEffect(() => {
    const stepMs = (deep ? 55000 : 11500) / steps.length
    let i = 0, t
    const tick = () => {
      i += 1
      setDone(Math.min(i, steps.length - 1))
      if (i < steps.length - 1) t = setTimeout(tick, stepMs * (0.7 + Math.random() * 0.6))
    }
    t = setTimeout(tick, stepMs * (0.7 + Math.random() * 0.6))
    return () => clearTimeout(t)
  }, [deep, steps.length])

  useEffect(() => {
    const f = file.current
    if (!f || f.size > 40 * 1024 * 1024 || !window.AudioContext) return
    let dead = false
    f.arrayBuffer().then(buf => {
      const ac = new AudioContext()
      return ac.decodeAudioData(buf).finally(() => ac.close && ac.close())
    }).then(ab => {
      if (dead) return
      const ch = ab.getChannelData(0), N = 96, blk = Math.max(1, Math.floor(ch.length / N)), ps = []
      for (let i = 0; i < N; i++) { let mx = 0; for (let j = 0; j < blk; j += 127) { const v = Math.abs(ch[i * blk + j] || 0); if (v > mx) mx = v } ps.push(mx) }
      setPeaks(ps)
    }).catch(() => {})
    return () => { dead = true }
  }, [file])

  const top = peaks ? Math.max(...peaks, 0.01) : 1
  return (
    <div className="grid min-h-dvh place-items-center" style={{ background: C.bg }}>
      <div className="w-[min(600px,92vw)] px-6">
        <h1 className="display text-[clamp(24px,3.6vw,34px)] font-medium" style={{ color: C.bone }}>
          {ui(kind === 'v2' ? 'comparing' : 'listening')}
        </h1>
        <p className="val mt-1 truncate text-[13px]" style={{ color: C.dim }}>{name}</p>
        {peaks && (
          <div dir="ltr" className="mt-7 flex h-[64px] items-end gap-[2px]" aria-hidden>
            {peaks.map((p, i) => (
              <i key={i} className="wv-bar w-full" style={{ height: `${Math.max(4, p / top * 100)}%`, background: C.bone,
                 animationDelay: `${(i / peaks.length * (deep ? 50 : 9)).toFixed(2)}s` }} />
            ))}
          </div>
        )}
        <ol className="mt-8 space-y-2.5">
          {steps.map((s, i) => {
            const state = i < done ? 'done' : i === done ? 'active' : 'wait'
            return (
              <li key={s} className={`flex items-center gap-3 text-[14px] ${state === 'wait' ? 'opacity-30' : ''}`}
                  style={{ color: state === 'active' ? C.bone : C.dim }}>
                <span className="grid h-[18px] w-[18px] place-items-center border" style={{ borderColor: C.line }}>
                  {state === 'done' ? <span className="val" style={{ color: C.green }}>✓</span>
                    : state === 'active' ? <span className="spin" style={{ borderColor: C.dim, borderTopColor: 'transparent' }} aria-hidden /> : null}
                </span>
                <span className={state === 'active' ? 'font-semibold' : ''}>{s}</span>
              </li>
            )
          })}
        </ol>
        <p className="val mt-8 text-[10px] uppercase" style={{ color: C.dim, letterSpacing: '.18em' }}>
          A&R·AI · MEASUREMENT IN PROGRESS
        </p>
      </div>
    </div>
  )
}

/* compact live rack — REAL demo numbers breathe at the door */
function DemoRack() {
  const { ui } = useLang()
  const { lang } = useLang()
  const reduce = useReducedMotion()
  const [rep, setRep] = useState(null)
  useEffect(() => { fetchDemo(lang).then(setRep).catch(() => {}) }, [lang])
  if (!rep) return <div className="h-[300px]" style={PANEL} />
  const raw = rep._raw || {}, m = rep.meta || {}
  const corridor = raw.norms?.lufs || [-9, -7]
  const mid = (corridor[0] + corridor[1]) / 2, min = mid - 6, max = mid + 6
  const X = v => Math.max(0, Math.min(1, (v - min) / (max - min)))
  const a = -135 + (rep.overall / 100) * 270
  return (
    <div className="relative px-5 py-5" style={PANEL}>
      <div className="flex items-baseline justify-between">
        <Engrave>LIVE DEMO · {rep.filename || 'Nightdrive'}</Engrave>
        <span className="val text-[10px]" style={{ color: C.green }}>● /api/demo</span>
      </div>

      <div className="mt-4 flex items-center gap-6">
        {/* the dial — real 73, spring needle */}
        <div className="relative h-[128px] w-[128px] shrink-0">
          <div className="absolute inset-0 rounded-full"
               style={{ background: 'repeating-conic-gradient(#2a2f36 0deg 3deg, #14171b 3deg 6deg)', boxShadow: '0 10px 24px rgba(0,0,0,.7)' }} />
          <div className="absolute inset-[9px] rounded-full"
               style={{ background: 'radial-gradient(circle at 32% 26%, #1d2127, #0b0d10 75%)', border: `1px solid ${C.line}` }} />
          <motion.span className="absolute left-1/2 top-1/2 h-[46px] w-[2.5px] origin-bottom rounded"
            style={{ background: C.green, boxShadow: `0 0 8px ${C.green}` }}
            initial={{ rotate: -135, x: '-50%', y: '-100%' }}
            animate={{ rotate: reduce ? a : [-135, a] }}
            transition={{ type: 'spring', stiffness: 60, damping: 14, delay: .4 }} />
          <div className="absolute inset-0 grid place-items-center">
            <div className="mt-7 text-center">
              <div className="val text-[26px] font-semibold leading-none" style={{ color: C.bone }}>{rep.overall}</div>
              <div className="display text-[9px]" style={{ color: C.purple }}>{ui('tag_read')}</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {[[m.bpm, 'BPM'], [m.key, 'KEY'], [raw.lufs, 'LUFS']].map(([v, u]) => (
            <div key={u} className="flex items-baseline justify-between border-b pb-1" style={{ borderColor: C.line }}>
              <Engrave>{u}</Engrave>
              <span className="val text-[15px] font-semibold" style={{ color: C.green, textShadow: `0 0 8px rgba(61,220,132,.4)` }}>{v}</span>
            </div>
          ))}
          {/* mini VU with the real corridor — meters read LTR, always */}
          <div dir="ltr" className="relative flex h-[14px] gap-[2px]" aria-hidden>
            {Array.from({ length: 30 }, (_, i) => {
              const v = min + (i + .5) * 12 / 30
              const lit = v <= raw.lufs
              const col = v > corridor[1] ? C.red : (v >= corridor[0] ? C.amber : C.green)
              return <motion.span key={i} className="h-full flex-1 rounded-[1px]"
                       style={{ background: lit ? col : '#1b1f25' }}
                       initial={reduce ? {} : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: .5 + i * .02 }} />
            })}
            <span className="pointer-events-none absolute -inset-y-[2px] rounded-sm"
                  style={{ left: `${X(corridor[0]) * 100}%`, width: `${(X(corridor[1]) - X(corridor[0])) * 100}%`, border: `1px dashed ${C.amber}77` }} />
          </div>
        </div>
      </div>

      <p dir="auto" className="display mt-4 border-t pt-3 text-[13.5px] leading-relaxed" style={{ color: C.bone, borderColor: C.line }}>
        {rep.verdict}
      </p>
      <div className="mt-2 flex items-baseline justify-between">
        <Link to="/show" className="val text-[10px] underline" style={{ color: C.amber }}>FULL SHOW →</Link>
        <span className="val text-[9.5px]" style={{ color: C.dim }}><bdi dir="auto">{ui('ft_honest')}</bdi></span>
      </div>
    </div>
  )
}

export default function Stage() {
  const { ui, lang, setLang } = useLang()
  const { routeFiles, runDemo, busy, busyKind, deep, setDeep, genre, setGenre, engineUp } = useSession()
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const deskN = useMemo(() =>
    new Set(loadHistory().filter(e => e && e.rep).map(e => baseSongName(e.name) || e.name)).size, [])

  // the stage owns the room: html ground goes dark while it's on
  useEffect(() => {
    const prev = document.documentElement.style.background
    document.documentElement.style.background = C.bg
    return () => { document.documentElement.style.background = prev }
  }, [])

  // the stage is its own world (outside the Shell) — it needs its own drop target
  useEffect(() => {
    let depth = 0
    const enter = e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); if (++depth === 1) document.body.dataset.dragdark = '1' } }
    const over = e => { if (document.body.dataset.dragdark) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }
    const leave = () => { if (depth > 0 && --depth === 0) delete document.body.dataset.dragdark }
    const drop = e => {
      if (!document.body.dataset.dragdark) return
      e.preventDefault(); depth = 0; delete document.body.dataset.dragdark
      if (!busy) routeFiles(e.dataTransfer.files)
    }
    addEventListener('dragenter', enter); addEventListener('dragover', over)
    addEventListener('dragleave', leave); addEventListener('drop', drop)
    return () => {
      removeEventListener('dragenter', enter); removeEventListener('dragover', over)
      removeEventListener('dragleave', leave); removeEventListener('drop', drop)
      delete document.body.dataset.dragdark
    }
  }, [routeFiles, busy])

  if (busy) return <StageProgress deep={deep} kind={busyKind} />

  return (
    <div className="min-h-dvh pb-16"
         style={{ background: `radial-gradient(1100px 520px at 72% -12%, #12161c, transparent), ${C.bg}` }}>
      {/* stage nav — minimal, bone on black */}
      <nav className="mx-auto flex max-w-[1120px] flex-wrap items-baseline gap-x-6 gap-y-2 px-[clamp(16px,3vw,36px)] pt-6">
        <span className="display text-[20px] font-bold" style={{ color: C.bone }}>A&R·AI</span>
        <Engrave>MEASUREMENT CONSOLE</Engrave>
        <span className="ms-auto flex items-center gap-5 text-[12.5px]">
          <Link to="/report" className="font-semibold hover:underline" style={{ color: C.dim }}>{ui('rk_nav_report')}</Link>
          <Link to="/library" className="font-semibold hover:underline" style={{ color: C.dim }}>{ui('hist_title')}</Link>
          <Link to="/accuracy" className="font-semibold hover:underline" style={{ color: C.dim }}>{ui('rk_acc_title')}</Link>
          <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language"
                  className="border bg-transparent px-1.5 py-0.5 text-[11.5px]"
                  style={{ borderColor: C.line, color: C.bone, background: C.panel }}>
            {LANGS.map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
        </span>
      </nav>

      <div className="mx-auto mt-[clamp(28px,7vh,72px)] grid max-w-[1120px] items-center gap-x-16 gap-y-12 px-[clamp(16px,3vw,36px)] lg:grid-cols-[1.1fr_420px]">
        {/* ── the claim ── */}
        <div>
          {/* Hebrew prose never wears the mono's clothes — sans, quiet amber */}
          <span className="text-[12.5px] font-semibold" style={{ color: C.amber }}>{ui('hero_eyebrow')}</span>
          <T k="hero_h" as="h1"
             className="display mt-4 max-w-[16ch] text-[clamp(36px,5.6vw,66px)] font-medium leading-[1.1] [text-wrap:balance] [&_.grad]:text-[#FF6B57]"
             style={{ color: C.bone }} />
          <T k="hero_sub" as="p" className="mt-5 max-w-[46ch] text-[16px] leading-relaxed [&_b]:font-semibold [&_b]:text-[#E8EAEe]"
             style={{ color: C.dim }} />

          {engineUp === false && <p role="alert" className="mt-5 text-[14px] font-semibold" style={{ color: C.red }}>{ui('rk_engine_down')}</p>}

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <label role="button" tabIndex={0}
                   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
                   className="press cursor-pointer px-7 py-3 text-[15px] font-bold"
                   style={{ background: '#F4F1EA', color: '#1B1917', borderRadius: 3, boxShadow: '0 6px 22px rgba(244,241,234,.14)' }}>
              {ui('rk_pick')}
              <input ref={inputRef} type="file" accept="audio/*" multiple hidden
                     onChange={e => { routeFiles(e.target.files); e.target.value = '' }} />
            </label>
            <button onClick={runDemo} className="press px-5 py-3 text-[13.5px] font-semibold"
                    style={{ border: `1px solid ${C.line}`, color: C.bone, borderRadius: 3 }}>
              {ui('demo_btn')}
            </button>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-3 text-[11.5px]" style={{ color: C.dim }}>
            <span className="val">{ui('drop_fmt')}</span>
            <span>{ui('drop_multi')}</span>
          </p>

          {/* console row */}
          <div className="mt-8 border-t pt-5" style={{ borderColor: C.line }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="me-1 text-[11.5px] font-semibold" style={{ color: C.dim }}>{ui('genre_lbl')}</span>
              {GENRES.map(g => (
                <button key={g} type="button" onClick={() => setGenre(g)}
                        className="press px-2.5 py-0.5 text-[12px] font-medium transition-colors"
                        style={g === genre
                          ? { background: C.bone, color: '#111', borderRadius: 2 }
                          : { color: C.dim }}>
                  {g === 'auto' ? ui('genre_auto') : g}
                </button>
              ))}
            </div>
            <label className="mt-3 flex max-w-[52ch] cursor-pointer items-baseline gap-2.5 text-[13px]" style={{ color: C.dim }}>
              <input type="checkbox" checked={deep} onChange={e => setDeep(e.target.checked)} className="translate-y-[1px] accent-[#FF453A]" />
              {ui('deep_lbl')}
            </label>
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[12px]" style={{ color: C.dim }}>
              <button onClick={() => navigate('/accuracy')} className="underline underline-offset-4 hover:opacity-80" style={{ color: C.amber }}>
                {ui('trust_accuracy')} →
              </button>
              <span>{ui('trust_private')}</span>
              <span>{ui('trust_account')}</span>
              <span>{ui(deep ? 'trust_time_deep' : 'trust_time')}</span>
            </p>
            {deskN >= 2 && (
              <button onClick={() => navigate('/library')}
                      className="mt-3 block text-[12.5px] underline underline-offset-4 hover:opacity-80 [&_b]:val"
                      style={{ color: C.dim }}
                      dangerouslySetInnerHTML={{ __html: ui('hello_back')(`<b>${deskN}</b>`) }} />
            )}
          </div>
        </div>

        {/* ── the proof: the live rack ── */}
        <DemoRack />
      </div>

      <p className="display mt-16 text-center text-[15px]" style={{ color: C.dim }}>{ui('rk_empty_h')}</p>

      {/* dark drop veil */}
      <style>{`body[data-dragdark]::after{content:"${ui('drop_release')}";position:fixed;inset:0;z-index:70;display:grid;place-items:center;
        font-family:var(--font-display);font-size:clamp(44px,8vw,96px);font-weight:500;color:#F4F1EA;
        background:rgba(8,9,11,.93);outline:2px solid #F4F1EA;outline-offset:-14px}`}</style>
    </div>
  )
}
