import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang, T } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import Masthead from '../components/Masthead.jsx'
import Verdict from '../components/Verdict.jsx'
import TapeStrip from '../components/TapeStrip.jsx'
import FindingBlock from '../components/FindingBlock.jsx'
import LoudnessRule from '../components/LoudnessRule.jsx'
import SpectrumPlot from '../components/SpectrumPlot.jsx'
import Texture from '../components/Texture.jsx'
import Platforms from '../components/Platforms.jsx'
import Tag from '../components/Tag.jsx'

const SEV_RANK = { crit: 0, warn: 1, good: 2 }

/** The measurement sheet — priority first, every conclusion pointing at its
 *  measured evidence (Bible laws 1–5 live here). */
export default function Report() {
  const { ui } = useLang()
  const { report: rep, name, busy, audio, measure, runDemo, selected, setSelected } = useSession()
  const navigate = useNavigate()
  const stripRef = useRef(null)
  const blockRefs = useRef({})

  if (!rep) {
    return (
      <section className="px-6 py-[18vh] text-center">
        <h1 className="display text-[clamp(26px,4.4vw,44px)] font-medium leading-tight">{ui('rk_empty_h')}</h1>
        <p className="mt-4 text-[14.5px] text-ink2">{ui('rk_no_report')}</p>
        <div className="mt-8 flex justify-center gap-4">
          <button className="btn bg-ink text-paper" onClick={() => navigate('/')}>{ui('rk_measure_btn')}</button>
          <button className="btn" onClick={runDemo}>{ui('demo_btn')}</button>
        </div>
      </section>
    )
  }

  const raw = rep._raw || {}
  const findings = [...(rep.findings || [])].sort((a, b) =>
    (SEV_RANK[a.sev] ?? 1) - (SEV_RANK[b.sev] ?? 1) || (a.score ?? 100) - (b.score ?? 100))
  const priorityId = findings.find(f => f.sev !== 'good')?.id
  const works = [...findings].filter(f => f.sev === 'good')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.headline

  const selectFinding = id => {
    setSelected(id)
    blockRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /* evidence visuals — each conclusion points at its measurement */
  const evidenceFor = f => {
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
            0:00–{Math.floor(raw.intro_sec / 60)}:{String(Math.round(raw.intro_sec % 60)).padStart(2, '0')}
          </button>
        </p>
      )
    return null
  }
  const provenanceFor = f =>
    f.id === 'Tempo'
      ? <span className="flex items-baseline gap-3"><Tag kind="measured" /><span className="text-[11px] text-ink2">{ui('rk_scale')} <Tag kind="est" /></span></span>
      : undefined

  return (
    <>
      <Masthead name={name} meta={rep.meta} busy={busy} report={rep} onPick={measure} />
      <div className={`mx-auto max-w-[920px] px-[clamp(18px,4vw,40px)] pb-16 transition-opacity duration-200 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        <Verdict rep={rep} works={works} />

        <div ref={stripRef} className="-mx-[clamp(18px,4vw,40px)] sm:mx-0">
          <TapeStrip raw={raw} name={name} audio={audio} selected={selected} onSelect={selectFinding} />
        </div>

        {/* findings — priority first, numbered like their timeline flags */}
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-baseline gap-3">
            <span className="lbl">{ui('rk_findings_hdr')}</span>
            <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
            <span className="flex items-baseline gap-4 text-[11px] text-ink2">
              <Tag kind="measured" /><Tag kind="est" /><Tag kind="model" /><Tag kind="read" />
            </span>
          </div>
          {findings.map((f, i) => (
            <div key={f.id} ref={el => { blockRefs.current[f.id] = el }}>
              <FindingBlock f={f} num={String(i + 1).padStart(2, '0')}
                            prio={f.id === priorityId} selected={selected === f.id}
                            provenance={provenanceFor(f)}>
                {evidenceFor(f)}
              </FindingBlock>
            </div>
          ))}
        </section>

        <Texture ai={rep.ai_signals} />
        <Platforms streaming={rep.streaming} />

        <footer className="rule-t flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-5 text-[12px] text-ink2">
          <span className="display text-[13px] font-bold text-ink">A&R·AI</span>
          <T k="rk_footer" as="span" />
          <span className="ms-auto val">{new Date().getFullYear()}</span>
        </footer>
      </div>
    </>
  )
}
