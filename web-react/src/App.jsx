import { useEffect, useRef, useState } from 'react'
import Masthead from './components/Masthead.jsx'
import Verdict from './components/Verdict.jsx'
import TapeStrip from './components/TapeStrip.jsx'
import FindingBlock from './components/FindingBlock.jsx'
import LoudnessRule from './components/LoudnessRule.jsx'
import SpectrumPlot from './components/SpectrumPlot.jsx'
import Texture from './components/Texture.jsx'
import Platforms from './components/Platforms.jsx'
import Tag from './components/Tag.jsx'

const SEV_RANK = { crit: 0, warn: 1, good: 2 }

export default function App() {
  const [rep, setRep] = useState(undefined)          // undefined = loading, null = engine offline
  const [name, setName] = useState('Nightdrive (דמו)')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(null)     // finding id ↔ timeline region
  const audioRef = useRef(null)
  const [audio, setAudio] = useState(null)
  const stripRef = useRef(null)
  const blockRefs = useRef({})

  useEffect(() => {
    fetch('/api/demo?lang=he').then(r => r.json()).then(setRep).catch(() => setRep(null))
  }, [])

  const analyzeFile = async f => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', f); fd.append('genre', 'auto'); fd.append('lang', 'he')
      const r = await fetch('/api/analyze', { method: 'POST', body: fd })
      if (!r.ok) throw new Error()
      setRep(await r.json()); setSelected(null)
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src) }
      const a = new Audio(URL.createObjectURL(f))
      audioRef.current = a; setAudio(a); setName(f.name)
    } catch { /* keep previous sheet */ }
    finally { setBusy(false) }
  }

  /* the whole window is the drop target */
  useEffect(() => {
    let depth = 0
    const enter = e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); if (++depth === 1) document.body.dataset.drag = '1' } }
    const over = e => { if (document.body.dataset.drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }
    const leave = () => { if (depth > 0 && --depth === 0) delete document.body.dataset.drag }
    const drop = e => {
      if (!document.body.dataset.drag) return
      e.preventDefault(); depth = 0; delete document.body.dataset.drag
      const f = e.dataTransfer.files?.[0]
      if (f) analyzeFile(f)
    }
    addEventListener('dragenter', enter); addEventListener('dragover', over)
    addEventListener('dragleave', leave); addEventListener('drop', drop)
    return () => { removeEventListener('dragenter', enter); removeEventListener('dragover', over)
      removeEventListener('dragleave', leave); removeEventListener('drop', drop) }
  }, [])

  const raw = rep?._raw || {}
  const findings = [...(rep?.findings || [])].sort((a, b) =>
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
          מסומן על הסרט —{' '}
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
      ? <span className="flex items-baseline gap-3"><Tag kind="measured" /><span className="text-[11px] text-ink2">סולם: <Tag kind="est" /></span></span>
      : undefined

  return (
    <div dir="rtl" className="min-h-dvh bg-paper text-ink">
      <Masthead name={name} meta={rep?.meta} busy={busy} report={rep} onPick={analyzeFile} />

      <main className={`mx-auto max-w-[920px] px-[clamp(18px,4vw,40px)] pb-16 transition-opacity duration-200 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        {rep === undefined && <p className="py-24 text-center text-[14px] text-ink2">טוען את הגיליון…</p>}

        {rep === null && (
          <section className="py-[18vh] text-center">
            <h1 className="display text-[clamp(30px,5vw,52px)] font-medium leading-tight">גרור שיר לכל מקום במסך.</h1>
            <p className="mt-4 text-[14.5px] text-ink2">המנוע המקומי לא זמין כרגע — הפעל את השרת ב-<span className="val">:8000</span> ורענן.</p>
          </section>
        )}

        {rep && (
          <>
            <Verdict rep={rep} works={works} />

            <div ref={stripRef} className="-mx-[clamp(18px,4vw,40px)] sm:mx-0">
              <TapeStrip raw={raw} name={name} audio={audio} selected={selected} onSelect={selectFinding} />
            </div>

            {/* findings — priority first, numbered like their timeline flags */}
            <section className="mt-10">
              <div className="mb-4 flex flex-wrap items-baseline gap-3">
                <span className="lbl">הממצאים · לפי עדיפות</span>
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
              <span>כל <span className="val text-ok">✓</span> נמדד מהאות עצמו. מה שלא נמדד — כתוב במפורש.</span>
              <span className="ms-auto val">{new Date().getFullYear()}</span>
            </footer>
          </>
        )}
      </main>

      {/* drop veil — paper, not glass */}
      <style>{`body[data-drag]::after{content:"שחרר.";position:fixed;inset:0;z-index:60;display:grid;place-items:center;
        font-family:var(--font-display);font-size:clamp(44px,8vw,96px);font-weight:500;color:var(--color-ink);
        background:color-mix(in srgb,var(--color-paper) 94%,transparent);outline:2px solid var(--color-ink);outline-offset:-14px}`}</style>
    </div>
  )
}
