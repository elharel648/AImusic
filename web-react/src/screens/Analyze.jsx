import { useEffect, useRef, useState } from 'react'
import { useLang, T } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'

/** Honest progress: the checklist is paced to the REAL expected pipeline time
 *  (~11.5s normal, ~55s deep) and the last step holds spinning until the API
 *  actually answers. The waveform is the reward — the user's actual audio. */
function Progress({ deep }) {
  const { ui } = useLang()
  const { name, file } = useSession()
  const steps = ui('steps')
  const [done, setDone] = useState(0)          // steps sealed so far
  const [peaks, setPeaks] = useState(null)

  useEffect(() => {
    const stepMs = (deep ? 55000 : 11500) / steps.length
    let i = 0, t
    const tick = () => {
      i += 1
      setDone(Math.min(i, steps.length - 1))   // last step never self-seals — the API seals it
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
      <h1 className="display text-[clamp(24px,3.6vw,34px)] font-medium">{ui('listening')}</h1>
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
  const { measure, runDemo, busy, error, deep, setDeep, engineUp } = useSession()
  const inputRef = useRef(null)

  if (busy) return <Progress deep={deep} />

  return (
    <section className="mx-auto max-w-[720px] px-[clamp(18px,4vw,40px)] py-[clamp(40px,9vh,96px)]">
      <span className="lbl">{ui('hero_eyebrow')}</span>
      <T k="hero_h" as="h1" className="display mt-3 max-w-[18ch] text-[clamp(32px,5.4vw,58px)] font-medium leading-[1.16] [text-wrap:balance]" />
      <T k="hero_sub" as="p" className="mt-5 max-w-[52ch] text-[15.5px] leading-relaxed text-ink2" />

      {error && <p role="alert" className="mt-6 border-s-2 border-red ps-4 text-[14px] font-medium text-red">{error}</p>}
      {engineUp === false && <p className="mt-6 text-[14px] text-ink2">{ui('rk_engine_down')}</p>}

      <div className="mt-9 flex flex-wrap items-center gap-4">
        <label className="btn cursor-pointer bg-ink text-paper hover:bg-ink/85" role="button" tabIndex={0}
               onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}>
          {ui('rk_pick')}
          <input ref={inputRef} type="file" accept="audio/*" hidden
                 onChange={e => e.target.files?.[0] && measure(e.target.files[0])} />
        </label>
        <button className="btn" onClick={runDemo}>{ui('demo_btn')}</button>
        <span className="val text-[12px] text-ink2">{ui('drop_fmt')}</span>
      </div>

      <label className="mt-6 flex max-w-[52ch] cursor-pointer items-baseline gap-2.5 text-[13px] text-ink2">
        <input type="checkbox" checked={deep} onChange={e => setDeep(e.target.checked)} className="translate-y-[1px] accent-[var(--color-red)]" />
        {ui('deep_lbl')}
      </label>

      <p className="rule-t mt-10 flex flex-wrap gap-x-6 gap-y-1 pt-4 text-[12px] text-ink2">
        <span>{ui('trust_accuracy')}</span><span>{ui('trust_private')}</span>
        <span>{ui(deep ? 'trust_time_deep' : 'trust_time')}</span>
      </p>

      <p className="display mt-14 text-[15px] text-ink2">{ui('rk_empty_h')}</p>
    </section>
  )
}
