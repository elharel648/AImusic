import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang, T } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { usePlayer } from '../lib/usePlayer.js'
import { findingSpans, fmt } from '../lib/report-utils.js'
import Masthead from '../components/Masthead.jsx'
import Verdict from '../components/Verdict.jsx'
import TapeStrip from '../components/TapeStrip.jsx'
import FindingBlock from '../components/FindingBlock.jsx'
import LoudnessRule from '../components/LoudnessRule.jsx'
import SpectrumPlot from '../components/SpectrumPlot.jsx'
import Texture from '../components/Texture.jsx'
import Platforms from '../components/Platforms.jsx'
import Tag from '../components/Tag.jsx'
import Telemetry from '../components/Telemetry.jsx'
import Bench from '../components/Bench.jsx'
import TonalBalance from '../components/TonalBalance.jsx'
import RefTrack from '../components/RefTrack.jsx'
import Arsenal from '../components/Arsenal.jsx'
import PromptBox from '../components/PromptBox.jsx'
import Regen from '../components/Regen.jsx'
import { Patterns, VdiffBanner, ProgressStrip, LabelMoment } from '../components/DeskIntel.jsx'

const SEV_RANK = { crit: 0, warn: 1, good: 2 }

/** The measurement sheet — the full studio. Basic mode tells ONE story
 *  (verdict → weakness → hear → fix → regenerate); pro opens every drawer. */
export default function Report() {
  const { ui } = useLang()
  const session = useSession()
  const { report: rep, name, busy, audio, selected, setSelected,
          rmode, setRmode, file, isDemo, deepRerun, toast } = session
  const navigate = useNavigate()
  const stripRef = useRef(null)
  const blockRefs = useRef({})
  // consume the stage→sheet flag exactly once per mount (StrictMode-safe)
  const lightsRef = useRef(null)
  if (lightsRef.current === null) {
    lightsRef.current = !!session.justFinished.current
    session.justFinished.current = false
  }
  const player = usePlayer({ rep, audio, ui, hasFile: !!file.current })

  const raw = rep?._raw || {}
  const pro = rmode !== 'basic'

  const findings = useMemo(() => [...(rep?.findings || [])].sort((a, b) =>
    (SEV_RANK[a.sev] ?? 1) - (SEV_RANK[b.sev] ?? 1) || (a.score ?? 100) - (b.score ?? 100)), [rep])
  const priorityId = findings.find(f => f.sev !== 'good')?.id
  // confidence before criticism — best good finding opens (never Character)
  const works = useMemo(() => [...findings].filter(f => f.sev === 'good' && f.id !== 'Character')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.headline, [findings])
  // the essentials hierarchy: ONE primary finding · other attention items as a
  // quiet list · confirmations as one-liners (never five equal cards)
  const prioFinding = findings.find(f => f.sev !== 'good')
  const attnRest = findings.filter(f => f.sev !== 'good' && f !== prioFinding)
  const goods = findings.filter(f => f.sev === 'good')

  // the priority's "hear the problem" anchor — weakest finding, measured spot
  const prio = useMemo(() => {
    if (!rep) return null
    const w = [...(rep.findings || [])].sort((a, b) => (a.score ?? 100) - (b.score ?? 100))[0]
    if (!w || w.sev === 'good') return null
    if (w.id === 'Intro' && raw.intro_sec > 3) return { t: raw.intro_sec, label: fmt(raw.intro_sec) }
    if (['Master', 'Dynamics', 'Clipping', 'Punch'].includes(w.id) && typeof raw.peak_moment_sec === 'number') {
      const t = Math.max(0, raw.peak_moment_sec - 4); return { t, label: fmt(t) }
    }
    const sp = findingSpans(rep, w.id)
    if (sp) return { span: sp[0], label: `${fmt(sp[0][0])}–${fmt(sp[0][1])}`, fid: w.id }
    return null
  }, [rep]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!rep) {
    return (
      <section className="px-6 py-[18vh] text-center">
        <h1 className="display text-[clamp(26px,4.4vw,44px)] font-medium leading-tight">{ui('rk_empty_h')}</h1>
        <p className="mt-4 text-[14.5px] text-ink2">{ui('rk_no_report')}</p>
        <div className="mt-8 flex justify-center gap-4">
          <button className="btn bg-ink text-paper" onClick={() => navigate('/')}>{ui('rk_measure_btn')}</button>
          <button className="btn" onClick={session.runDemo}>{ui('demo_btn')}</button>
        </div>
      </section>
    )
  }

  const selectFinding = id => {
    setSelected(id)
    blockRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const evidenceFor = f => {
    if (f.id === 'Tonal' && rep.tonal)
      return <TonalBalance tonal={rep.tonal} embedded />
    if (f.id === 'Master' && raw.lufs != null)
      return <LoudnessRule lufs={raw.lufs} corridor={raw.norms?.lufs || [-9, -7]} />
    if (f.id === 'Mix' && raw.tonal_bands?.length)
      return <SpectrumPlot bands={raw.tonal_bands}
        mud={f.sev !== 'good' ? { lo: 200, hi: 350, label: `200–350 Hz · ${Math.round((raw.low_mid_ratio || 0) * 100)}%` } : null} />
    if (f.id === 'Intro' && raw.intro_sec != null)
      return (
        <p className="mt-2 text-[13px] text-ink2">
          {ui('rk_marked')}{' '}
          <button className="val font-semibold text-red underline decoration-red/40 underline-offset-4"
                  onClick={() => { setSelected('Intro'); stripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>
            0:00–{fmt(raw.intro_sec)}
          </button>
        </p>
      )
    return null
  }
  const provenanceFor = f =>
    f.id === 'Tempo'
      ? <span className="flex items-baseline gap-3"><Tag kind="measured" /><span className="text-[11px] text-ink2">{ui('rk_scale')} <Tag kind="est" /></span></span>
      : undefined

  // section nav — wayfinding for the long report (pro mode)
  const navItems = [
    ['bench', ui('bench_section'), !!(raw.norms && (raw.norms.bpm || raw.norms.lufs))],
    ['tonal', ui('tb_section'), !!rep.tonal],
    ['ref', ui('ref_nav'), true],
    ['findings', ui('full_read'), true],
    ['ai', 'AI', !!rep.ai_signals],
    ['stream', ui('bt_stream'), !!rep.streaming],
    ['prompt', 'Prompt', !!(rep.prompt || rep.suno_prompt)],
  ].filter(([, , on]) => on)
  const jumpTo = sec => document.querySelector(`[data-sec="${sec}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // the vocal card is live — deep re-run this exact file on the spot
  const vocalLive = () => {
    if (file.current && !isDemo.current) {
      const ds = rep.deep_status
      if (ds === 'ran') {
        const vc = blockRefs.current['Vocal']
        if (!vc) { toast(ui('deep_fail'), true); return }
        toast(ui('deep_done'))
        vc.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      if (ds === 'no_vocals') { toast(ui('deep_novoc'), true); return }
      deepRerun()
      return
    }
    session.setDeep(true); navigate('/')
  }

  return (
    <>
      {/* the lights come up over the freshly printed sheet (once, after analysis) */}
      {lightsRef.current && <div className="lights-up" aria-hidden />}
      <Masthead name={name} meta={rep.meta} busy={busy} report={rep} onPick={session.measure} />
      <div key={rep.overall + name} className={`mx-auto max-w-[920px] px-[clamp(18px,4vw,40px)] pb-16 transition-opacity duration-200 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="rise">
          <Verdict rep={rep} works={works} prio={prio} compact={!pro} onHear={p => {
            if (!audio) return
            if (p.span) player.loopFinding(p.fid, p.span[0], p.span[1])
            else player.seekTo(p.t)
            stripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }} />
        </div>

        {/* one story or the whole studio — a quiet tab pair, not a control panel */}
        <div className="rise r1 mb-6 flex items-baseline gap-5 border-b border-rule text-[13px] font-semibold">
          {[['basic', ui('mode_basic')], ['pro', ui('mode_pro')]].map(([m, label]) => (
            <button key={m} onClick={() => setRmode(m)}
                    className={`press -mb-px border-b-2 pb-1.5 transition-colors ${(m === 'pro') === pro ? 'border-red text-ink' : 'border-transparent text-ink2 hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>

        <VdiffBanner rep={rep} fname={name} />
        {pro && !isDemo.current && <ProgressStrip fname={name} />}
        {pro && <Patterns rep={rep} />}

        {pro && (
          <div ref={stripRef} className="rise r2 -mx-[clamp(18px,4vw,40px)] mt-5 sm:mx-0">
            <TapeStrip rep={rep} name={name} player={player} selected={selected} onSelect={selectFinding} slim={false} />
          </div>
        )}

        {pro && <Telemetry rep={rep} />}
        {pro && <Bench rep={rep} />}
        {pro && <TonalBalance tonal={rep.tonal} />}
        {pro && <RefTrack rep={rep} />}

        {/* ESSENTIALS: one primary finding with its evidence — nothing competes.
            THE STUDIO: every finding, numbered, with the full lab. */}
        {!pro ? (
          <section className="rise r3 mt-8" data-sec="findings">
            {prioFinding && (
              <div ref={el => { blockRefs.current[prioFinding.id] = el }}
                   className="slip p-5 sm:p-6">
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="text-[12px] font-bold text-red">{ui('fix_one')}</span>
                  <span className="h-px flex-1 bg-rule" aria-hidden />
                </div>
                <FindingBlock f={prioFinding} num="01" prio bare selected={selected === prioFinding.id}
                              provenance={provenanceFor(prioFinding)} rep={rep} player={player}>
                  {evidenceFor(prioFinding)}
                </FindingBlock>
              </div>
            )}

            {/* hear it — the tape right under the claim (verdict → weakness → hear) */}
            <div ref={stripRef} className="-mx-[clamp(18px,4vw,40px)] mt-4 sm:mx-0">
              <TapeStrip rep={rep} name={name} player={player} selected={selected} onSelect={selectFinding} slim />
            </div>

            {/* other attention items — names, not cards; the studio holds the lab */}
            {attnRest.length > 0 && (
              <div className="rule-t mt-2 pt-4">
                <span className="lbl">{ui('rk_sev_warn')}</span>
                {attnRest.map(f => (
                  <button key={f.id} onClick={() => { setRmode('pro'); setSelected(f.id) }}
                          className="group mt-2 flex w-full items-baseline gap-3 text-start">
                    <span className="val text-[12px] font-semibold text-red">→</span>
                    <span className="text-[13.5px] font-semibold group-hover:text-red">{f.k}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink2">{f.headline}</span>
                  </button>
                ))}
              </div>
            )}

            {/* confirmations — quiet one-liners, never five equal cards */}
            {goods.length > 0 && (
              <div className="rule-t mt-4 pt-4">
                <span className="lbl">{ui('works_lbl')}</span>
                <div className="mt-2 grid gap-x-10 gap-y-1.5 md:grid-cols-2">
                  {goods.map(f => (
                    <p key={f.id} className="flex items-baseline gap-2.5 text-[13px] leading-snug text-ink2">
                      <span className="val font-semibold text-ok">✓</span>
                      <span className="min-w-0">{f.headline}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <button className="btn mt-6 w-full" onClick={() => setRmode('pro')}>
              {ui('show_full')(Math.max(0, rep.findings.length - 1))}
            </button>
          </section>
        ) : (
          <section className="rise r3 mt-8" data-sec="findings">
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
              <span className="lbl">{ui('full_read')}</span>
              <span className="val text-[11px] text-ink2">{ui('findings_n')(rep.findings.length)}</span>
              <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
              <span className="flex items-baseline gap-4 text-[11px] text-ink2">
                <Tag kind="measured" /><Tag kind="est" /><Tag kind="model" /><Tag kind="read" />
              </span>
            </div>
            {findings.map((f, i) => (
              <div key={f.id} ref={el => { blockRefs.current[f.id] = el }}>
                <FindingBlock f={f} num={String(i + 1).padStart(2, '0')}
                              prio={f.id === priorityId} selected={selected === f.id}
                              provenance={provenanceFor(f)} rep={rep} player={player}>
                  {evidenceFor(f)}
                </FindingBlock>
              </div>
            ))}
          </section>
        )}

        {pro && <Arsenal rep={rep} />}
        {pro && <div data-sec="ai"><Texture ai={rep.ai_signals} /></div>}
        {pro && <div data-sec="stream"><Platforms streaming={rep.streaming} /></div>}
        {pro && <LabelMoment rep={rep} />}

        <PromptBox rep={rep} chips={pro} />
        <Regen rep={rep} name={name} />

        {/* vocal critique — live: deep re-runs THIS track on the spot (full studio) */}
        {pro && (
          <section className="rule-t py-6">
            <div className="mb-2 flex items-baseline gap-3">
              <span className="lbl">{ui('whats_new')}</span>
              <span className="h-px flex-1 bg-rule" aria-hidden />
              <span className="val text-[10.5px] font-semibold text-ok">● {ui('live_badge')}</span>
            </div>
            <button onClick={vocalLive} className="group block w-full text-start">
              <T k="lock_vocal" as="span"
                 className="block text-[14px] font-semibold leading-snug transition-colors group-hover:text-red [&_small]:mt-0.5 [&_small]:block [&_small]:text-[12.5px] [&_small]:font-normal [&_small]:text-ink2" />
            </button>
          </section>
        )}

        <footer className="rule-t flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-5 text-[12px] text-ink2">
          <span className="display text-[13px] font-bold text-ink">A&R·AI</span>
          <T k="rk_footer" as="span" />
          <span className="ms-auto val">{new Date().getFullYear()}</span>
        </footer>
      </div>

      {/* floating section nav — pro mode wayfinding */}
      {pro && navItems.length > 2 && (
        <nav aria-label="report sections"
             className="fixed bottom-4 start-1/2 z-40 hidden -translate-x-1/2 flex-wrap gap-1 border border-ink bg-sheet px-2 py-1.5 shadow-sm md:flex rtl:translate-x-1/2">
          {navItems.map(([sec, label]) => (
            <button key={sec} onClick={() => jumpTo(sec)}
                    className="px-2 py-0.5 text-[11.5px] font-semibold text-ink2 transition-colors hover:text-ink">
              {label}
            </button>
          ))}
        </nav>
      )}
    </>
  )
}
