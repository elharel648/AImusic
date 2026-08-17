import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang, T } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { usePlayer } from '../lib/usePlayer.js'
import { findingSpans, fmt, bidiHTML } from '../lib/report-utils.js'
import Masthead from '../components/Masthead.jsx'
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

/** One numbered section of the report document — `01 / THE BOTTOM LINE`.
 *  The numbering is real structure: the reading order of an A&R review. */
function Sec({ num, label, meta, sec, children }) {
  return (
    <section className="pt-[clamp(44px,7vh,72px)]" data-sec={sec}>
      <div className="mb-6 flex items-baseline gap-3 border-b border-rule pb-2">
        <span className="val text-[11px] font-semibold text-red">{num}</span>
        <span className="lbl">{label}</span>
        <span className="flex-1" />
        {meta}
      </div>
      {children}
    </section>
  )
}

/** The A&R report — an editorial document: verdict, priorities, evidence,
 *  the full technical lab, release checks, tools. Everything present; the
 *  hierarchy does the work (brief: "We listened", not "we calculated"). */
export default function Report() {
  const { ui, dir } = useLang()
  const session = useSession()
  const { report: rep, name, busy, audio, selected, setSelected, file, isDemo, deepRerun, toast } = session
  const navigate = useNavigate()
  const stripRef = useRef(null)
  const blockRefs = useRef({})
  const lightsRef = useRef(null)
  if (lightsRef.current === null) {
    lightsRef.current = !!session.justFinished.current
    session.justFinished.current = false
  }
  const player = usePlayer({ rep, audio, ui, hasFile: !!file.current })

  const raw = rep?._raw || {}
  const findings = useMemo(() => [...(rep?.findings || [])].sort((a, b) =>
    (SEV_RANK[a.sev] ?? 1) - (SEV_RANK[b.sev] ?? 1) || (a.score ?? 100) - (b.score ?? 100)), [rep])
  const priorityId = findings.find(f => f.sev !== 'good')?.id
  const attention = findings.filter(f => f.sev !== 'good')
  const top3 = attention.slice(0, 3)
  const goods = findings.filter(f => f.sev === 'good')

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

  const scrollToFinding = id => {
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

  // dynamic numbering — sections that lack data don't leave a hole in the count
  let n = 0
  const num = () => String(++n).padStart(2, '0')

  return (
    <>
      {lightsRef.current && <div className="lights-up" aria-hidden />}
      <Masthead name={name} meta={rep.meta} busy={busy} report={rep} onPick={session.measure} />
      <div key={rep.overall + name} className={`mx-auto max-w-[880px] px-[clamp(18px,4vw,40px)] pb-20 transition-opacity duration-200 ${busy ? 'pointer-events-none opacity-50' : ''}`}>

        {/* ── 01 · THE BOTTOM LINE ── */}
        <Sec num={num()} label={ui('rk2_bottom')} sec="verdict"
             meta={<span className="display text-[12px] text-blue">{ui('tag_read')}</span>}>
          <div className="rise flex flex-wrap items-start gap-x-12 gap-y-6">
            <div className="shrink-0">
              <span className="lbl">{ui('rk2_score')}</span>
              <div className="val mt-1 text-[56px] font-semibold leading-none">
                {rep.overall}<span className="text-[19px] font-normal text-ink2"> / 100</span>
              </div>
            </div>
            <div className="min-w-[260px] flex-1">
              <p className="display max-w-[28ch] text-[clamp(21px,3vw,30px)] font-medium leading-[1.35] [text-wrap:balance]">
                {rep.verdict}
              </p>
              {rep.priority && (
                <p className="mt-3 max-w-[62ch] border-s-2 border-red ps-4 text-[14px] leading-relaxed"
                   dangerouslySetInnerHTML={{ __html: bidiHTML(rep.priority, dir) }} />
              )}
            </div>
          </div>
          <VdiffBanner rep={rep} fname={name} />
          {!isDemo.current && <ProgressStrip fname={name} />}
          <Patterns rep={rep} />
        </Sec>

        {/* ── 02 · WHAT I'D FIX FIRST ── */}
        {top3.length > 0 && (
          <Sec num={num()} label={ui('rk2_fixfirst')} sec="priorities">
            {top3.map((f, i) => (
              <div key={f.id} className={`grid grid-cols-[44px_1fr] gap-x-5 py-4 sm:grid-cols-[56px_1fr] ${i > 0 ? 'rule-t' : ''}`}>
                <span className="val text-[19px] font-semibold text-red">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-[12.5px] font-bold">{f.k}</span>
                    <span className="text-[11px] font-semibold text-red">{ui('rk_sev_warn')}</span>
                  </div>
                  <h3 className="mt-0.5 max-w-[54ch] text-[16px] font-semibold leading-snug"
                      dangerouslySetInnerHTML={{ __html: bidiHTML(f.headline, dir) }} />
                  {f.measure?.[0] && (
                    <p className="val mt-1 text-[12.5px] text-ink2">
                      {f.measure[0][0]} · {f.measure[0][1]} · <span className="text-ok">{ui('tag_measured')}</span>
                    </p>
                  )}
                  {f.fix?.daw && (
                    <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-ink2">
                      <span className="lbl me-2">{ui('rk2_action')}</span>
                      <span dangerouslySetInnerHTML={{ __html: bidiHTML(f.fix.daw, dir) }} />
                    </p>
                  )}
                  <button onClick={() => scrollToFinding(f.id)}
                          className="mt-1.5 text-[12px] font-semibold text-ink2 underline decoration-rule underline-offset-4 hover:text-ink">
                    {ui('rk_why')} ↓
                  </button>
                </div>
              </div>
            ))}
          </Sec>
        )}

        {/* ── 03 · WHAT ALREADY WORKS ── */}
        <Sec num={num()} label={ui('rk2_works')} sec="works">
          <div className="grid gap-x-10 gap-y-2 md:grid-cols-2">
            {goods.map(f => (
              <p key={f.id} className="flex items-baseline gap-2.5 text-[13.5px] leading-snug">
                <span className="val font-semibold text-ok">✓</span>
                <span className="min-w-0 text-ink2" dangerouslySetInnerHTML={{ __html: bidiHTML(f.headline, dir) }} />
              </p>
            ))}
            {raw.clipping === false && (
              <p className="flex items-baseline gap-2.5 text-[13.5px] leading-snug">
                <span className="val font-semibold text-ok">✓</span>
                <span className="text-ink2">{ui('rk2_noclip')}</span>
              </p>
            )}
            {rep.meta?.duration && (
              <p className="flex items-baseline gap-2.5 text-[13.5px] leading-snug">
                <span className="val font-semibold text-ok">✓</span>
                <span className="text-ink2"><span className="val">{rep.meta.duration}</span></span>
              </p>
            )}
          </div>
        </Sec>

        {/* ── 04 · LISTEN & ANALYZE ── */}
        <Sec num={num()} label={ui('rk2_listen')} sec="listen">
          <div ref={stripRef} className="-mx-[clamp(18px,4vw,40px)] sm:mx-0">
            <TapeStrip rep={rep} name={name} player={player} selected={selected} onSelect={scrollToFinding} />
          </div>
          <div className="mt-4"><Telemetry rep={rep} /></div>
        </Sec>

        {/* ── 05 · TONAL BALANCE ── */}
        {rep.tonal && (
          <Sec num={num()} label={ui('tb_section')} sec="tonal"
               meta={rep.tonal.genre?.n ? <span className="val text-[11px] text-ink2">n={rep.tonal.genre.n}</span> : null}>
            <TonalBalance tonal={rep.tonal} bare />
          </Sec>
        )}

        {/* ── 06 · REFERENCE COMPARISON ── */}
        <Sec num={num()} label={ui('ref_section')} sec="ref">
          <p className="mb-4 max-w-[60ch] text-[13px] leading-relaxed text-ink2">{ui('rk2_ref_sub')}</p>
          <RefTrack rep={rep} bare />
        </Sec>

        {/* ── 07 · TECHNICAL FINDINGS ── */}
        <Sec num={num()} label={ui('rk2_tech')} sec="tech"
             meta={<span className="flex items-baseline gap-4 text-[11px] text-ink2">
               <Tag kind="measured" /><Tag kind="est" /><Tag kind="model" /><Tag kind="read" />
             </span>}>
          <Bench rep={rep} />
          <div className="mt-2">
            {findings.map((f, i) => (
              <div key={f.id} ref={el => { blockRefs.current[f.id] = el }}>
                <FindingBlock f={f} num={String(i + 1).padStart(2, '0')}
                              prio={f.id === priorityId} selected={selected === f.id}
                              provenance={provenanceFor(f)} rep={rep} player={player}>
                  {evidenceFor(f)}
                </FindingBlock>
              </div>
            ))}
          </div>
          <Arsenal rep={rep} />
        </Sec>

        {/* ── 08 · BEFORE YOU RELEASE ── */}
        {rep.streaming && (
          <Sec num={num()} label={ui('rk2_release')} sec="stream">
            <Platforms streaming={rep.streaming} bare />
          </Sec>
        )}

        {/* ── 09 · PRODUCTION SIGNATURE ── */}
        {rep.ai_signals?.tells?.length > 0 && (
          <Sec num={num()} label={ui('rk_tx_title')} sec="signature">
            <Texture ai={rep.ai_signals} bare />
            <LabelMoment rep={rep} />
          </Sec>
        )}

        {/* ── 10 · VOCAL REVIEW ── */}
        <Sec num={num()} label={ui('whats_new')} sec="vocal"
             meta={<span className="val text-[10.5px] font-semibold text-ok">● {ui('live_badge')}</span>}>
          <button onClick={vocalLive} className="group block w-full text-start">
            <T k="lock_vocal" as="span"
               className="block max-w-[62ch] text-[14px] font-semibold leading-snug transition-colors group-hover:text-red [&_small]:mt-0.5 [&_small]:block [&_small]:text-[12.5px] [&_small]:font-normal [&_small]:text-ink2" />
          </button>
        </Sec>

        {/* ── 11 · WANT TO TRY A VARIATION? ── */}
        <Sec num={num()} label={ui('rk2_variation')} sec="variation">
          <PromptBox rep={rep} chips bare />
          {/* the closing direction — a recap, not a promise */}
          {top3.length > 0 && (
            <div className="mt-8 border-s-2 border-ink ps-5">
              <p className="display text-[clamp(17px,2.4vw,22px)] font-medium">{ui('rk2_cta')}</p>
              <div className="mt-2 space-y-1">
                {top3.map((f, i) => (
                  <p key={f.id} className="text-[13.5px] text-ink2">
                    <span className="val me-2 font-semibold text-red">{String(i + 1).padStart(2, '0')}</span>{f.k}
                  </p>
                ))}
              </div>
            </div>
          )}
          <Regen rep={rep} name={name} />
        </Sec>

        <footer className="rule-t mt-16 flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-5 text-[12px] text-ink2">
          <span className="display text-[13px] font-bold text-ink">A&R·AI</span>
          <T k="rk_footer" as="span" />
          <span className="ms-auto val">{new Date().getFullYear()}</span>
        </footer>
      </div>
    </>
  )
}
