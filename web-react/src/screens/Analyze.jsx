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
    <section className="mx-auto max-w-[720px] px-[clamp(18px,4vw,40px)] py-[clamp(36px,8vh,84px)]">
      {deskN >= 2 && (
        <button onClick={() => navigate('/library')}
                className="mb-6 block text-[13px] text-ink2 underline decoration-rule underline-offset-4 transition-colors hover:text-ink [&_b]:val [&_b]:text-ink"
                dangerouslySetInnerHTML={{ __html: ui('hello_back')(`<b>${deskN}</b>`) }} />
      )}

      <span className="lbl">{ui('hero_eyebrow')}</span>
      <T k="hero_h" as="h1" className="display mt-3 max-w-[18ch] text-[clamp(32px,5.4vw,58px)] font-medium leading-[1.16] [text-wrap:balance]" />
      <T k="hero_sub" as="p" className="mt-5 max-w-[52ch] text-[15.5px] leading-relaxed text-ink2" />

      {engineUp === false && <p role="alert" className="mt-6 border-s-2 border-red ps-4 text-[14px] font-medium text-red">{ui('rk_engine_down')}</p>}

      <div className="mt-9 flex flex-wrap items-center gap-4">
        <label className="btn cursor-pointer bg-ink text-paper hover:bg-ink/85" role="button" tabIndex={0}
               onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}>
          {ui('rk_pick')}
          <input ref={inputRef} type="file" accept="audio/*" multiple hidden
                 onChange={e => { routeFiles(e.target.files); e.target.value = '' }} />
        </label>
        <button className="btn" onClick={runDemo}>{ui('demo_btn')}</button>
        <span className="val text-[12px] text-ink2">{ui('drop_fmt')}</span>
      </div>
      <p className="mt-2 text-[12.5px] text-ink2">{ui('drop_multi')}</p>

      {/* genre + deep — the two honest knobs */}
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <span className="lbl me-1">{ui('genre_lbl')}</span>
        {GENRES.map(g => (
          <button key={g} type="button" onClick={() => setGenre(g)}
                  className={`border px-2.5 py-0.5 text-[12px] transition-colors ${g === genre ? 'border-ink bg-ink text-paper' : 'border-rule text-ink2 hover:border-ink hover:text-ink'}`}>
            {g === 'auto' ? ui('genre_auto') : g}
          </button>
        ))}
      </div>
      <label className="mt-4 flex max-w-[52ch] cursor-pointer items-baseline gap-2.5 text-[13px] text-ink2">
        <input type="checkbox" checked={deep} onChange={e => setDeep(e.target.checked)} className="translate-y-[1px] accent-[var(--color-red)]" />
        {ui('deep_lbl')}
      </label>

      <p className="rule-t mt-8 flex flex-wrap gap-x-6 gap-y-1 pt-4 text-[12px] text-ink2">
        <span>{ui('trust_accuracy')}</span><span>{ui('trust_private')}</span>
        <span>{ui('trust_account')}</span>
        <span className="val">{ui(deep ? 'trust_time_deep' : 'trust_time')}</span>
      </p>

      {/* what you get — the producer speaks, sentence by sentence */}
      <div className="rule-t mt-8 pt-5">
        <span className="lbl">{ui('preview_lbl')}</span>
        <div className="mt-3 max-w-[54ch] border border-rule bg-sheet p-4">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <span className="val text-[12px] text-ink2" dir="ltr">Nightdrive.wav</span>
            <span className="display text-[12px] font-medium text-blue">{ui('pv_who')}</span>
          </div>
          <T k="pv_m1" as="p" className="fade-seq text-[13.5px] leading-relaxed [&_b]:font-semibold [&_.chip]:val [&_.chip]:text-[12px] [&_.chip]:font-semibold" />
          <T k="pv_m2" as="p" className="fade-seq fd2 mt-2 text-[15px] font-medium leading-relaxed [&_b]:font-semibold [&_.chip]:val [&_.chip]:text-[13px] [&_.chip]:font-semibold [&_.chip.bad]:text-red" />
          <T k="pv_m3" as="p" className="fade-seq fd3 mt-2 text-[13.5px] leading-relaxed text-ink2" />
          <p className="fade-seq fd4 val mt-3 border-t border-rule pt-2 text-[11px] text-ink2">{ui('pv_foot')}</p>
        </div>
      </div>

      <p className="display mt-12 text-[15px] text-ink2">{ui('rk_empty_h')}</p>
    </section>
  )
}
