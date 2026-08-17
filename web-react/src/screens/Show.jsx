import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useLang } from '../i18n/index.jsx'
import { demo } from '../lib/api.js'
import { fmt } from '../lib/report-utils.js'

/* ═══════════════════════════════════════════════════════════════════════
   THE SHOW — /rack/show · taken to the edge.
   A full console floor: boot sequence, master dial, VU wall, finding
   modules, EQ scope, patch bay, calibration plaque, transport.
   One law survives the aesthetic: EVERY readout is piped live from
   /api/demo and /api/accuracy. Nothing on this floor is typed by hand.
   Panel engravings are hardware idiom (mono-caps, untranslated — the
   TRUE PEAK rule); prose arrives from the engine already localized.
   ═══════════════════════════════════════════════════════════════════════ */

const C = {
  bg: '#08090B', panel: '#101216', panel2: '#15181D', line: '#23272E',
  bone: '#C9CDD4', dim: '#6B7280', green: '#3DDC84', red: '#FF453A',
  purple: '#A78BFA', amber: '#E3A455',
}
const PANEL = {
  background: `linear-gradient(180deg, ${C.panel2}, ${C.panel})`,
  border: `1px solid ${C.line}`,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.045), inset 0 -1px 0 rgba(0,0,0,.6), 0 10px 30px rgba(0,0,0,.55)',
  borderRadius: 10,
}
const SCREW = { width: 7, height: 7, borderRadius: 99,
  background: 'radial-gradient(circle at 35% 30%, #3a4048, #0b0d10 70%)',
  boxShadow: 'inset 0 0 2px #000' }

const Screws = () => <>
  <span className="absolute left-2 top-2" style={SCREW} /><span className="absolute right-2 top-2" style={SCREW} />
  <span className="absolute bottom-2 left-2" style={SCREW} /><span className="absolute bottom-2 right-2" style={SCREW} />
</>
const Engrave = ({ children, color = C.dim }) => (
  <span className="val text-[10px] font-semibold uppercase" style={{ color, letterSpacing: '.18em' }}>{children}</span>
)

function Led({ on, color, flash }) {
  const reduce = useReducedMotion()
  return (
    <motion.span className="inline-block h-[9px] w-[9px] shrink-0 rounded-full"
      style={{ background: on ? color : '#22262c', boxShadow: on ? `0 0 8px ${color}, 0 0 2px ${color}` : 'inset 0 0 2px #000' }}
      animate={on && flash && !reduce ? { opacity: [1, .35, 1] } : { opacity: 1 }}
      transition={on && flash && !reduce ? { repeat: Infinity, duration: 1.1 } : {}} />
  )
}

function Toggle({ on, onFlip, label, color = C.green }) {
  return (
    <button onClick={onFlip} className="group flex flex-col items-center gap-2" aria-pressed={on}>
      <span className="relative block h-[46px] w-[24px] rounded-[5px]"
            style={{ background: 'linear-gradient(180deg,#1a1e24,#0c0e11)', border: `1px solid ${C.line}`,
                     boxShadow: 'inset 0 2px 6px rgba(0,0,0,.8)' }}>
        <motion.span className="absolute left-[3px] right-[3px] block h-[18px] rounded-[3px]"
          style={{ background: 'linear-gradient(180deg,#4a515b,#272c33)',
                   boxShadow: '0 2px 4px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.15)' }}
          animate={{ top: on ? 3 : 23 }} transition={{ type: 'spring', stiffness: 700, damping: 32 }} />
      </span>
      <span className="flex items-center gap-1.5">
        <Led on={on} color={color} />
        <Engrave color={on ? C.bone : C.dim}>{label}</Engrave>
      </span>
    </button>
  )
}

function ScoreDial({ score, tagRead }) {
  const reduce = useReducedMotion()
  const a = -135 + (score / 100) * 270
  const ticks = Array.from({ length: 28 }, (_, i) => -135 + i * 10)
  return (
    <div className="relative mx-auto h-[210px] w-[210px]">
      <div className="absolute inset-0 rounded-full"
           style={{ background: `repeating-conic-gradient(#2a2f36 0deg 3deg, #14171b 3deg 6deg)`,
                    boxShadow: '0 14px 34px rgba(0,0,0,.7), inset 0 2px 3px rgba(255,255,255,.06)' }} />
      <div className="absolute inset-[14px] rounded-full"
           style={{ background: 'radial-gradient(circle at 32% 26%, #1d2127, #0b0d10 75%)',
                    border: `1px solid ${C.line}`, boxShadow: 'inset 0 4px 18px rgba(0,0,0,.85)' }} />
      {ticks.map(t => (
        <span key={t} className="absolute left-1/2 top-1/2 h-[86px] w-px origin-bottom"
              style={{ transform: `translate(-50%,-100%) rotate(${t}deg)` }}>
          <span className="block h-[7px] w-px" style={{ background: t <= a ? C.green : '#333a42' }} />
        </span>
      ))}
      <motion.span className="absolute left-1/2 top-1/2 h-[74px] w-[3px] origin-bottom rounded"
        style={{ background: C.green, boxShadow: `0 0 10px ${C.green}` }}
        initial={{ rotate: -135, x: '-50%', y: '-100%' }}
        animate={{ rotate: reduce ? a : [-135, a] }}
        transition={{ type: 'spring', stiffness: 60, damping: 14, delay: .3 }} />
      <div className="absolute inset-0 grid place-items-center">
        <div className="mt-10 text-center">
          <div className="val text-[46px] font-semibold leading-none" style={{ color: C.bone, textShadow: `0 0 18px rgba(61,220,132,.35)` }}>{score}</div>
          <div className="val text-[10px]" style={{ color: C.dim }}>/100</div>
          <div className="display mt-1 text-[10.5px]" style={{ color: C.purple }}>{tagRead}</div>
        </div>
      </div>
    </div>
  )
}

/* small analog needle meter — DR / WIDTH / LRA, all measured */
function MiniMeter({ label, val, max, unit }) {
  const reduce = useReducedMotion()
  const frac = Math.max(0, Math.min(1, val / max))
  const a = -60 + frac * 120
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[44px] w-[76px] overflow-hidden rounded-t-[38px]"
           style={{ background: '#0b0d10', border: `1px solid ${C.line}`, borderBottom: 'none',
                    boxShadow: 'inset 0 3px 10px rgba(0,0,0,.8)' }}>
        {[-60, -30, 0, 30, 60].map(t => (
          <span key={t} className="absolute bottom-0 left-1/2 h-[38px] w-px origin-bottom"
                style={{ transform: `translateX(-50%) rotate(${t}deg)` }}>
            <span className="block h-[6px] w-px" style={{ background: '#3a414b' }} />
          </span>
        ))}
        <motion.span className="absolute bottom-0 left-1/2 h-[34px] w-[2px] origin-bottom"
          style={{ background: C.amber, boxShadow: `0 0 6px ${C.amber}` }}
          initial={{ rotate: -60, x: '-50%' }} animate={{ rotate: reduce ? a : [-60, a] }}
          transition={{ type: 'spring', stiffness: 70, damping: 13, delay: .5 }} />
      </div>
      <span className="val text-[11px] font-semibold" style={{ color: C.bone }}>{val}<small style={{ color: C.dim }}> {unit}</small></span>
      <Engrave>{label}</Engrave>
    </div>
  )
}

/* boot sequence — every line a REAL fact from /api/accuracy */
function Boot({ acc, onDone }) {
  const reduce = useReducedMotion()
  const lines = useMemo(() => {
    const l = ['A&R·AI MEASUREMENT CONSOLE']
    const hits = acc?.corpus?.hits || {}
    const nPop = hits.pop, nEdm = hits.edm
    if (nPop) l.push(`LOADING GENRE NORMS · POP n=${nPop.toLocaleString()} · EDM n=${nEdm?.toLocaleString()}`)
    if (acc?.tempo) l.push(`TEMPO ENGINE CALIBRATED · ${acc.tempo.accuracy1}% ACC1 · n=${acc.tempo.n}`)
    if (acc?.key?.edm) l.push(`KEY PROFILES LOADED · ${acc.key.edm.exact}% EXACT · GIANTSTEPS n=${acc.key.edm.n}`)
    l.push('ALL READOUTS LIVE · NOTHING INVENTED')
    return l
  }, [acc])
  const [n, setN] = useState(reduce ? lines.length : 0)
  useEffect(() => {
    if (reduce) { const t = setTimeout(onDone, 400); return () => clearTimeout(t) }
    if (n >= lines.length) { const t = setTimeout(onDone, 650); return () => clearTimeout(t) }
    const t = setTimeout(() => setN(n + 1), n === 0 ? 420 : 520)
    return () => clearTimeout(t)
  }, [n, lines.length, onDone, reduce])
  return (
    <motion.div className="fixed inset-0 z-50 grid cursor-pointer place-items-center" style={{ background: C.bg }}
                onClick={onDone} exit={{ opacity: 0 }} transition={{ duration: .45 }}>
      <div className="val w-[min(560px,90vw)] space-y-2 text-[12px]" style={{ color: C.green }}>
        {lines.slice(0, n + 1).map((l, i) => (
          <motion.p key={l} initial={{ opacity: 0 }} animate={{ opacity: i === 0 ? 1 : .9 }}
                    style={i === 0 ? { color: C.bone, fontSize: 15, letterSpacing: '.2em' } : {}}>
            <span style={{ color: C.dim }}>▸ </span>{l}
          </motion.p>
        ))}
        <motion.span className="inline-block h-[13px] w-[7px]" style={{ background: C.green }}
                     animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: .8 }} />
      </div>
    </motion.div>
  )
}

const SEV_LED = { crit: C.red, warn: C.red, good: C.green }

export default function Show() {
  const { ui, lang } = useLang()
  const [rep, setRep] = useState(undefined)
  const [acc, setAcc] = useState(null)
  const [booted, setBooted] = useState(false)
  const [zones, setZones] = useState(true)
  const [mudOn, setMudOn] = useState(true)
  const [scan, setScan] = useState(false)
  const [sweep, setSweep] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => { demo(lang).then(setRep).catch(() => setRep(null)) }, [lang])
  useEffect(() => { fetch('/api/accuracy').then(r => r.json()).then(setAcc).catch(() => {}) }, [])

  const raw = rep?._raw || {}
  const m = rep?.meta || {}
  const corridor = raw.norms?.lufs || [-9, -7]
  const tpOk = rep?.streaming?.checks?.[0]?.ok
  const worstTell = (rep?.ai_signals?.tells || []).find(t => typeof t.pct === 'number')
  const dur = raw.duration_sec || 0

  const vu = useMemo(() => {
    if (raw.lufs == null) return null
    const mid = (corridor[0] + corridor[1]) / 2, min = mid - 6, max = mid + 6
    return { min, max, X: v => Math.max(0, Math.min(1, (v - min) / (max - min))), cells: 48 }
  }, [raw.lufs, corridor])

  const eq = useMemo(() => {
    const b = raw.tonal_bands; if (!b?.length) return null
    const W = 560, H = 150, lo = Math.min(...b) - 2, hi = Math.max(...b) + 2
    const X = i => (i / (b.length - 1)) * W
    const Y = v => 12 + (H - 24) * (1 - (v - lo) / (hi - lo))
    const fx = f => Math.log(f / 30) / Math.log(16000 / 30)
    return { W, H, d: b.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(''),
             mud: [fx(200) * W, fx(350) * W], marks: [[60, fx(60) * W], [250, fx(250) * W], ['1k', fx(1000) * W], ['4k', fx(4000) * W], ['12k', fx(12000) * W]] }
  }, [raw.tonal_bands])

  if (rep === undefined) return (
    <div className="grid min-h-dvh place-items-center" style={{ background: C.bg }}>
      <p className="val text-[13px]" style={{ color: C.dim }}>POWERING CONSOLE…</p>
    </div>
  )
  if (rep === null) return (
    <div className="grid min-h-dvh place-items-center" style={{ background: C.bg }}>
      <p className="text-[14px]" style={{ color: C.bone }}>{ui('rk_engine_down')}</p>
    </div>
  )

  return (
    <div dir="ltr" className="min-h-dvh pb-28" style={{ background: `radial-gradient(1100px 500px at 70% -10%, #11151b, transparent), ${C.bg}` }}>
      <AnimatePresence>{!booted && <Boot acc={acc} onDone={() => setBooted(true)} />}</AnimatePresence>

      <div className="mx-auto max-w-[1060px] px-[clamp(14px,3vw,32px)] pt-6">

        {/* ── RACK 1 · masthead + measured readouts ── */}
        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4" style={PANEL}>
          <Screws />
          <div>
            <div className="display text-[19px] font-bold" style={{ color: C.bone }}>A&R·AI</div>
            <Engrave>MEASUREMENT CONSOLE · SHOW</Engrave>
          </div>
          <div className="val text-[13px]" style={{ color: C.dim }}>
            <bdi style={{ color: C.bone }}>{rep.filename || 'Nightdrive'}</bdi> · {m.duration}
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-5">
            {[[m.bpm, 'BPM'], [m.key, 'KEY'], [raw.key_confidence != null ? Math.round(raw.key_confidence * 100) + '%' : null, 'KEY CONF']].filter(([v]) => v != null).map(([v, u]) => (
              <div key={u} className="px-3 py-1.5 text-center" style={{ background: '#07130c', border: `1px solid ${C.line}`, borderRadius: 6, boxShadow: 'inset 0 2px 8px rgba(0,0,0,.8)' }}>
                <div className="val text-[17px] font-semibold" style={{ color: C.green, textShadow: `0 0 10px rgba(61,220,132,.5)` }}>{v}</div>
                <Engrave>{u}</Engrave>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <Led on color={tpOk ? C.green : C.red} flash={!tpOk} />
              <Engrave color={tpOk ? C.dim : C.red}>{raw.true_peak_db} dBTP</Engrave>
            </div>
          </div>
        </div>

        {/* the producer speaks before the engineer — even on the show floor */}
        <p dir="auto" className="display mx-1 my-6 max-w-[42ch] text-[clamp(19px,2.6vw,26px)] font-medium leading-snug" style={{ color: C.bone }}>
          {rep.verdict}
        </p>

        {/* ── RACK 2 · master dial + VU + analog trio ── */}
        <div className="grid gap-5 md:grid-cols-[300px_1fr]">
          <div className="relative px-5 py-6" style={PANEL}>
            <Screws />
            <Engrave>MASTER BUS · OVERALL</Engrave>
            <div className="mt-3"><ScoreDial score={rep.overall} tagRead={ui('tag_read')} /></div>
          </div>

          <div className="relative flex flex-col justify-between gap-4 px-6 py-5" style={PANEL}>
            <Screws />
            <div>
              <div className="flex items-baseline justify-between">
                <Engrave>LOUDNESS · ✓</Engrave>
                <span className="val text-[22px] font-semibold" style={{ color: C.bone, textShadow: '0 0 14px rgba(201,205,212,.25)' }}>
                  {raw.lufs} <small className="text-[11px]" style={{ color: C.dim }}>LUFS</small>
                </span>
              </div>
              {vu && (
                <div className="relative mt-2">
                  <div className="flex h-[30px] gap-[3px]">
                    {Array.from({ length: vu.cells }, (_, i) => {
                      const v = vu.min + (i + .5) * 12 / vu.cells
                      const lit = v <= raw.lufs
                      const inZone = v >= corridor[0] && v <= corridor[1]
                      const col = v > corridor[1] ? C.red : inZone ? C.amber : C.green
                      return (
                        <motion.span key={i} className="h-full flex-1 rounded-[1px]"
                          style={{ background: lit ? col : '#1b1f25', boxShadow: lit ? `0 0 6px ${col}66` : 'none' }}
                          initial={reduce ? {} : { scaleY: 0 }} animate={{ scaleY: 1 }}
                          transition={{ delay: .25 + i * .012, duration: .18 }} />
                      )
                    })}
                  </div>
                  {zones && (
                    <div className="pointer-events-none absolute -inset-y-1 rounded-sm"
                         style={{ left: `${vu.X(corridor[0]) * 100}%`, width: `${(vu.X(corridor[1]) - vu.X(corridor[0])) * 100}%`,
                                  border: `1px dashed ${C.amber}88` }}>
                      <span className="val absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px]" style={{ color: C.amber }}>
                        TARGET {corridor[0]}…{corridor[1]}
                      </span>
                    </div>
                  )}
                  <div className="val mt-1.5 flex justify-between text-[9px]" style={{ color: C.dim }}>
                    <span>{vu.min}</span><span>{(vu.min + vu.max) / 2}</span><span>{vu.max}</span>
                  </div>
                </div>
              )}
            </div>
            {/* the analog trio — every needle earns its angle from a measurement */}
            <div className="flex flex-wrap items-end justify-around gap-3 border-t pt-3" style={{ borderColor: C.line }}>
              {raw.dynamic_range_db != null && <MiniMeter label="DYN RANGE" val={raw.dynamic_range_db} max={16} unit="dB" />}
              {raw.stereo_width != null && <MiniMeter label="ST WIDTH" val={raw.stereo_width} max={1.2} unit="" />}
              {raw.lra != null && <MiniMeter label="LRA" val={raw.lra} max={12} unit="LU" />}
            </div>
          </div>
        </div>

        {/* ── RACK 3 · finding modules — five instruments, five verdicts ── */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(rep.findings || []).map((f, i) => (
            <motion.div key={f.id} className="relative px-3.5 py-3" style={PANEL}
              initial={reduce ? {} : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .15 + i * .07 }}>
              <div className="flex items-center justify-between gap-2">
                <Engrave color={C.bone}>{f.k}</Engrave>
                <Led on color={SEV_LED[f.sev] || C.amber} flash={f.sev === 'crit'} />
              </div>
              <div className="val mt-1.5 text-[21px] font-semibold leading-none"
                   style={{ color: f.sev === 'good' ? C.green : C.red, textShadow: `0 0 10px ${(f.sev === 'good' ? C.green : C.red)}55` }}>
                {f.score}
              </div>
              <div className="display mt-0.5 text-[9.5px]" style={{ color: C.purple }}>{ui('tag_read')}</div>
              <p dir="auto" className="mt-1.5 text-[11px] leading-snug" style={{ color: C.dim }}>{f.headline}</p>
            </motion.div>
          ))}
        </div>

        {/* ── RACK 4 · EQ scope + console ── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_240px]">
          <div className="relative px-6 py-5" style={PANEL}>
            <Screws />
            <div className="flex items-baseline justify-between">
              <Engrave>EQ SPECTRUM · 30 Hz – 16 kHz</Engrave>
              {mudOn && raw.low_mid_ratio != null && (
                <motion.span className="val text-[11px] font-semibold" style={{ color: C.red }}
                  animate={reduce ? {} : { opacity: [1, .55, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                  ⚠ {Math.round(raw.low_mid_ratio * 100)}% · 200–350 Hz
                </motion.span>
              )}
            </div>
            {eq && (
              <svg viewBox={`0 0 ${eq.W} ${eq.H}`} className="mt-2 block w-full">
                {[0, .25, .5, .75, 1].map(f => (
                  <line key={f} x1={0} x2={eq.W} y1={12 + f * (eq.H - 24)} y2={12 + f * (eq.H - 24)} stroke={C.line} strokeWidth=".7" />
                ))}
                {eq.marks.map(([t, x]) => (
                  <text key={t} x={x} y={eq.H - 1} textAnchor="middle" fontSize="8.5" fill={C.dim} fontFamily="ui-monospace">{t}</text>
                ))}
                {mudOn && (
                  <rect x={eq.mud[0]} width={eq.mud[1] - eq.mud[0]} y="6" height={eq.H - 18}
                        fill={C.red} opacity=".12" stroke={C.red} strokeOpacity=".5" strokeDasharray="3 3" />
                )}
                <path d={eq.d} fill="none" stroke={C.green} strokeWidth="2" strokeLinejoin="round"
                      style={{ filter: `drop-shadow(0 0 6px ${C.green}aa)` }} />
              </svg>
            )}
            <p dir="auto" className="mt-1 text-[12.5px]" style={{ color: C.dim }}>
              {(rep.findings || []).find(f => f.id === 'Mix')?.headline}
            </p>
          </div>

          <div className="relative flex flex-col gap-5 px-5 py-5" style={PANEL}>
            <Screws />
            <Engrave>CONSOLE</Engrave>
            <div className="flex justify-around">
              <Toggle on={zones} onFlip={() => setZones(z => !z)} label="TARGET" color={C.amber} />
              <Toggle on={mudOn} onFlip={() => setMudOn(v => !v)} label="MUD" color={C.red} />
              <Toggle on={scan} onFlip={() => setScan(s => !s)} label="AI SCAN" color={C.purple} />
            </div>
            {scan && worstTell && (
              <div>
                <div className="flex items-baseline justify-between">
                  <Engrave color={C.purple}>TEXTURE</Engrave>
                  <span className="val text-[11px]" style={{ color: C.purple }}>P{worstTell.pct}</span>
                </div>
                <div className="mt-1 h-[8px] overflow-hidden rounded-sm" style={{ background: '#1b1f25' }}>
                  <motion.div className="h-full" style={{ background: C.purple, boxShadow: `0 0 8px ${C.purple}` }}
                    initial={{ width: 0 }} animate={{ width: `${worstTell.pct}%` }} transition={{ duration: reduce ? 0 : .9 }} />
                </div>
                <p dir="auto" className="mt-1.5 text-[11px] leading-relaxed" style={{ color: C.dim }}>{worstTell.t}</p>
              </div>
            )}
            <div className="mt-auto space-y-1.5">
              <Engrave>RX CHAIN</Engrave>
              {(rep.findings || []).filter(f => f.rx).slice(0, 2).map(f => (
                <div key={f.id} className="val flex items-center justify-between text-[11px]" style={{ color: C.bone }}>
                  <span>{f.rx.type === 'limiter' ? 'PRO-L 2' : 'PRO-Q 3'}</span>
                  <Led on color={C.green} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RACK 5 · patch bay — where the track lands on every platform ── */}
        {rep.streaming?.platforms?.length > 0 && (
          <div className="relative mt-5 px-6 py-5" style={PANEL}>
            <Screws />
            <Engrave>PATCH BAY · STREAMING NORMALIZATION</Engrave>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              {rep.streaming.platforms.map(p => {
                const bad = p.mode === 'quiet'
                return (
                  <div key={p.name} className="flex flex-col items-center gap-1.5">
                    {/* the jack socket */}
                    <span className="grid h-[34px] w-[34px] place-items-center rounded-full"
                          style={{ background: 'radial-gradient(circle at 35% 30%, #2b3138, #0b0d10 70%)', border: `1px solid ${C.line}`,
                                   boxShadow: 'inset 0 2px 6px rgba(0,0,0,.9)' }}>
                      <Led on color={bad ? C.red : C.green} flash={bad} />
                    </span>
                    <span className="val text-[10.5px] font-semibold" style={{ color: C.bone }}>{p.name}</span>
                    <span className="val text-[10px]" style={{ color: bad ? C.red : C.dim }}>
                      {p.mode === 'down' ? `−${Math.abs(p.delta).toFixed(1)} LU` : p.mode === 'up' ? `+${Math.abs(p.delta).toFixed(1)} LU` : bad ? `−${p.gap} dB` : '0'}
                    </span>
                  </div>
                )
              })}
            </div>
            <p dir="auto" className="mt-3 text-[12px]" style={{ color: C.dim }}>{rep.streaming.headline}</p>
          </div>
        )}

        {/* ── the calibration plaque — the one thing no competitor dares engrave ── */}
        {acc?.tempo && (
          <div className="relative mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 py-4"
               style={{ ...PANEL, background: 'linear-gradient(180deg,#1a1e24,#12151a)' }}>
            <Screws />
            <Engrave color={C.bone}>CALIBRATION CERTIFICATE</Engrave>
            <span className="val text-[12px]" style={{ color: C.green }}>TEMPO {acc.tempo.accuracy1}% ACC1 <small style={{ color: C.dim }}>n={acc.tempo.n}</small></span>
            {acc.key?.edm && <span className="val text-[12px]" style={{ color: C.green }}>KEY {acc.key.edm.exact}% EXACT <small style={{ color: C.dim }}>n={acc.key.edm.n}</small></span>}
            <span className="val text-[10px]" style={{ color: C.dim }}>GIANTSTEPS GROUND TRUTH</span>
            <Link to="/accuracy" className="val text-[10px] underline" style={{ color: C.amber }}>FULL ERROR RATES →</Link>
          </div>
        )}

        <p className="val mt-6 text-center text-[10px]" style={{ color: C.dim }}>
          EVERY READOUT ON THIS CONSOLE IS PIPED LIVE FROM /api/demo + /api/accuracy · <bdi dir="auto">{ui('ft_honest')}</bdi>
          {' · '}<Link to="/report" className="underline" style={{ color: C.bone }}><bdi dir="auto">{ui('rk_nav_report')}</bdi> →</Link>
        </p>
      </div>

      {/* ── RACK 6 · transport with measured anchors ── */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-[1060px] px-[clamp(14px,3vw,32px)] pb-4">
          <div className="relative flex items-center gap-4 px-5 py-3" style={{ ...PANEL, borderRadius: 12 }}>
            <Screws />
            <button onClick={() => setSweep(s => !s)} aria-label="demo sweep"
                    className="press grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
                    style={{ background: 'radial-gradient(circle at 32% 28%, #3b424b, #14171b 75%)',
                             border: `1px solid ${C.line}`, boxShadow: '0 4px 10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.12)' }}>
              {sweep
                ? <span className="flex gap-[3px]"><i className="h-[12px] w-[3.5px]" style={{ background: C.bone }} /><i className="h-[12px] w-[3.5px]" style={{ background: C.bone }} /></span>
                : <span className="ml-[3px] h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent" style={{ borderLeftColor: C.bone }} />}
            </button>
            <div className="relative h-[38px] min-w-0 flex-1 overflow-visible">
              <div className="flex h-full items-end gap-[2px]">
                {(raw.energy_curve || []).map((v, i) => (
                  <span key={i} className="w-full rounded-[1px]" style={{ height: `${Math.max(4, v * 100)}%`, background: '#3a414b' }} />
                ))}
              </div>
              {/* measured anchors: intro end + peak moment */}
              {dur > 0 && raw.intro_sec > 3 && (
                <span className="absolute inset-y-0 w-px" style={{ left: `${raw.intro_sec / dur * 100}%`, background: `${C.amber}99` }}>
                  <span className="val absolute -top-3 -translate-x-1/2 text-[8.5px]" style={{ color: C.amber }}>INTRO {fmt(raw.intro_sec)}</span>
                </span>
              )}
              {dur > 0 && typeof raw.peak_moment_sec === 'number' && (
                <span className="absolute inset-y-0 w-px" style={{ left: `${raw.peak_moment_sec / dur * 100}%`, background: `${C.green}99` }}>
                  <span className="val absolute -top-3 -translate-x-1/2 text-[8.5px]" style={{ color: C.green }}>PEAK {fmt(raw.peak_moment_sec)}</span>
                </span>
              )}
              {sweep && !reduce && (
                <motion.span className="absolute inset-y-0 w-[2px]" style={{ background: C.red, boxShadow: `0 0 8px ${C.red}` }}
                  initial={{ left: '0%' }} animate={{ left: '100%' }}
                  transition={{ duration: 14, ease: 'linear', repeat: Infinity }} />
              )}
            </div>
            <span className="val hidden shrink-0 text-[11px] sm:block" style={{ color: C.dim }}>{fmt(dur)} · DEMO SWEEP</span>
          </div>
        </div>
      </div>
    </div>
  )
}
