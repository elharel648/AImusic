import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang, T } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { GENRES } from '../lib/plugin-kb.js'
import { loadHistory } from '../lib/history.js'
import { baseSongName } from '../lib/report-utils.js'

/** Honest progress: paced to the REAL expected pipeline time (~11.5s normal,
 *  ~55s deep), last step holds until the API answers. Waveform = the reward. */
function Progress({ deep, kind }) {
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
    <section className="mx-auto max-w-[560px] px-6 py-[14vh]">
      <h1 className="display text-[clamp(24px,3.6vw,34px)] font-medium">{ui(kind === 'v2' ? 'comparing' : 'listening')}</h1>
      <p className="val mt-1 truncate text-[13px] text-ink2">{name}</p>

      {peaks && (
        <div dir="ltr" className="mt-7 flex h-[54px] items-end gap-[2px]" aria-hidden>
          {peaks.map((p, i) => (
            <i key={i} className="wv-bar w-full bg-ink"
               style={{ height: `${Math.max(4, p / top * 100)}%`, animationDelay: `${(i / peaks.length * (deep ? 50 : 9)).toFixed(2)}s` }} />
          ))}
        </div>
      )}

      <ol className="mt-8 space-y-2.5">
        {steps.map((s, i) => {
          const state = i < done ? 'done' : i === done ? 'active' : 'wait'
          return (
            <li key={s} className={`flex items-center gap-3 text-[14px] transition-opacity ${state === 'wait' ? 'opacity-35' : ''}`}>
              <span className="grid h-[18px] w-[18px] place-items-center border border-ink text-[11px]">
                {state === 'done' ? <span className="val text-ok">✓</span>
                  : state === 'active' ? <span className="spin" aria-hidden /> : null}
              </span>
              <span className={state === 'active' ? 'font-semibold' : ''}>{s}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default function Analyze() {
  const { ui } = useLang()
  const { routeFiles, runDemo, busy, busyKind, deep, setDeep, genre, setGenre, engineUp } = useSession()
  const navigate = useNavigate()
  const inputRef = useRef(null)

  // the desk greets returning artists (recognition — Bible Vol. II)
  const deskN = useMemo(() =>
    new Set(loadHistory().filter(e => e && e.rep).map(e => baseSongName(e.name) || e.name)).size, [])

  if (busy) return <Progress deep={deep} kind={busyKind} />

  return (
    <section className="mx-auto max-w-[1060px] px-[clamp(18px,4vw,40px)] py-[clamp(32px,7vh,72px)]">
      {deskN >= 2 && (
        <button onClick={() => navigate('/library')}
                className="rise mb-8 block text-[13px] text-ink2 underline decoration-rule underline-offset-4 transition-colors hover:text-ink [&_b]:val [&_b]:text-ink"
                dangerouslySetInnerHTML={{ __html: ui('hello_back')(`<b>${deskN}</b>`) }} />
      )}

      <div className="grid items-start gap-x-14 gap-y-12 lg:grid-cols-[1fr_380px]">
        {/* ── the claim ── */}
        <div>
          <span className="lbl rise">{ui('hero_eyebrow')}</span>
          <T k="hero_h" as="h1" className="rise r1 display mt-3 max-w-[16ch] text-[clamp(34px,5.2vw,60px)] font-medium leading-[1.12] [text-wrap:balance]" />
          <T k="hero_sub" as="p" className="rise r2 mt-5 max-w-[48ch] text-[15.5px] leading-relaxed text-ink2" />

          {engineUp === false && <p role="alert" className="mt-6 border-s-2 border-red ps-4 text-[14px] font-medium text-red">{ui('rk_engine_down')}</p>}

          <div className="rise r3 mt-9 flex flex-wrap items-center gap-4">
            <label className="btn cursor-pointer bg-ink !px-6 !py-2.5 text-paper hover:bg-ink/85" role="button" tabIndex={0}
                   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}>
              {ui('rk_pick')}
              <input ref={inputRef} type="file" accept="audio/*" multiple hidden
                     onChange={e => { routeFiles(e.target.files); e.target.value = '' }} />
            </label>
            <button className="btn" onClick={runDemo}>{ui('demo_btn')}</button>
          </div>
          <p className="rise r3 val mt-3 text-[12px] text-ink2">{ui('drop_fmt')}</p>
          <p className="rise r3 mt-1 text-[12.5px] text-ink2">{ui('drop_multi')}</p>

          {/* the console row — the two honest knobs, printed controls */}
          <div className="rise r4 rule-t mt-8 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="lbl me-1">{ui('genre_lbl')}</span>
              {GENRES.map(g => (
                <button key={g} type="button" onClick={() => setGenre(g)}
                        className={`press px-2 py-0.5 text-[12px] transition-colors ${g === genre ? 'border border-ink bg-ink text-paper' : 'text-ink2 underline-offset-4 hover:text-ink hover:underline hover:decoration-rule'}`}>
                  {g === 'auto' ? ui('genre_auto') : g}
                </button>
              ))}
            </div>
            <label className="mt-4 flex max-w-[52ch] cursor-pointer items-baseline gap-2.5 text-[13px] text-ink2">
              <input type="checkbox" checked={deep} onChange={e => setDeep(e.target.checked)} className="translate-y-[1px] accent-[var(--color-red)]" />
              {ui('deep_lbl')}
            </label>
            <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-ink2">
              <button onClick={() => navigate('/accuracy')}
                      className="underline decoration-rule underline-offset-4 transition-colors hover:text-ink">
                {ui('trust_accuracy')} →
              </button>
              <span>{ui('trust_private')}</span>
              <span>{ui('trust_account')}</span>
              <span className="val">{ui(deep ? 'trust_time_deep' : 'trust_time')}</span>
            </p>
          </div>
        </div>

        {/* ── the proof: a specimen sheet, tape and all ── */}
        <aside className="rise r2 border border-ink bg-sheet">
          <div className="flex items-baseline gap-3 border-b border-rule px-4 py-2.5">
            <span className="lbl">{ui('preview_lbl')}</span>
            <span className="val ms-auto text-[11px] text-ink2" dir="ltr">Nightdrive.wav</span>
          </div>
          {/* mini tape — the product's signature, printed small */}
          <div dir="ltr" className="relative flex h-[46px] items-end gap-[2px] border-b border-ink bg-tape px-3 pb-1 pt-2" aria-hidden>
            {SPEC_BARS.map((v, i) => (
              <i key={i} className="spec-bar w-full bg-bone"
                 style={{ height: `${v}%`, opacity: i < 21 ? 1 : .45, animationDelay: `${(i % 7) * .35}s` }} />
            ))}
            <span className="absolute inset-y-0 w-[2px] bg-red" style={{ left: '70%' }} />
          </div>
          <div className="p-4">
            <p className="display mb-2 text-[12px] font-medium text-blue">{ui('pv_who')}</p>
            <T k="pv_m1" as="p" className="fade-seq text-[13.5px] leading-relaxed [&_b]:font-semibold [&_.chip]:val [&_.chip]:text-[12px] [&_.chip]:font-semibold" />
            <T k="pv_m2" as="p" className="fade-seq fd2 mt-2 text-[15px] font-medium leading-relaxed [&_b]:font-semibold [&_.chip]:val [&_.chip]:text-[13px] [&_.chip]:font-semibold [&_.chip.bad]:text-red" />
            <T k="pv_m3" as="p" className="fade-seq fd3 mt-2 text-[13.5px] leading-relaxed text-ink2" />
            <p className="fade-seq fd4 val mt-3 border-t border-rule pt-2 text-[11px] text-ink2">{ui('pv_foot')}</p>
          </div>
        </aside>
      </div>

      <p className="rise r4 display mt-14 text-center text-[15px] text-ink2">{ui('rk_empty_h')}</p>
    </section>
  )
}

/* the specimen strip — a fixed, deterministic shape (design, not data: it lives
   on a demo sheet and claims nothing about any real track) */
const SPEC_BARS = [12, 18, 14, 22, 30, 26, 38, 46, 42, 58, 66, 61, 74, 70, 82, 78, 88, 84, 92, 86, 90, 72, 72, 64, 58, 52, 44, 38, 30, 22]
