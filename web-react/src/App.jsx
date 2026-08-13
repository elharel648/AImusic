import { useEffect, useRef, useState } from 'react'
import ScoreOrb from './components/ScoreOrb.jsx'
import LufsMeter from './components/LufsMeter.jsx'
import MixDiagnostics from './components/MixDiagnostics.jsx'
import TextureScanner from './components/TextureScanner.jsx'
import TempoCell from './components/TempoCell.jsx'
import TransportDock from './components/TransportDock.jsx'

/* The brief's exact stats — the fallback when the live engine isn't reachable. */
const MOCK = {
  overall: 82,
  verdict: 'השיר שלך חזק — הוא היה שורד האזנה ראשונה בלייבל. החולשה הכי גדולה היא המאסטר.',
  meta: { genre: 'melodic techno', bpm: 124, key: 'A minor' },
  findings: [
    { id: 'Master', headline: 'המאסטר שקט — ‎-11.4 LUFS, חלש יותר מרוב השירים המשוחררים.' },
    { id: 'Mix', headline: 'יש הצטברות של בוץ בטווח הנמוך-אמצע סביב 250 Hz.' },
    { id: 'Tempo', headline: '124 BPM ב-A minor — בדיוק בז\'אנר.' },
  ],
  ai_signals: { headline: 'סימן אחד שמזוהה לרוב עם הפקת AI.',
    tells: [{ t: 'המרקם אחיד בצורה חריגה', pct: 99 }] },
  _raw: { lufs: -11.4, true_peak_db: -0.8, duration_sec: 238, mud_peak_hz: 250,
    norms: { lufs: [-9, -7] }, energy_curve: [], tonal_bands: [] },
}

export default function App() {
  const [rep, setRep] = useState(MOCK)
  const [trackName, setTrackName] = useState('Nightdrive (demo)')
  const [busy, setBusy] = useState(false)
  const audioRef = useRef(null)
  const [audio, setAudio] = useState(null)

  useEffect(() => {
    fetch('/api/demo?lang=he').then(r => r.json()).then(setRep).catch(() => {})
  }, [])

  /* the whole window is the drop target — drop a real track, every meter re-renders */
  useEffect(() => {
    let depth = 0
    const enter = (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); if (++depth === 1) document.body.dataset.drag = '1' } }
    const over = (e) => { if (document.body.dataset.drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }
    const leave = () => { if (depth > 0 && --depth === 0) delete document.body.dataset.drag }
    const drop = async (e) => {
      if (!document.body.dataset.drag) return
      e.preventDefault(); depth = 0; delete document.body.dataset.drag
      const f = e.dataTransfer.files?.[0]
      if (!f) return
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('file', f); fd.append('genre', 'auto'); fd.append('lang', 'he')
        const r = await fetch('/api/analyze', { method: 'POST', body: fd })
        if (!r.ok) throw new Error()
        setRep(await r.json())
        if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src) }
        const a = new Audio(URL.createObjectURL(f))
        audioRef.current = a; setAudio(a); setTrackName(f.name)
      } catch { /* keep previous state */ }
      finally { setBusy(false) }
    }
    addEventListener('dragenter', enter); addEventListener('dragover', over)
    addEventListener('dragleave', leave); addEventListener('drop', drop)
    return () => { removeEventListener('dragenter', enter); removeEventListener('dragover', over)
      removeEventListener('dragleave', leave); removeEventListener('drop', drop) }
  }, [])

  const raw = rep._raw || {}
  const f = (id) => (rep.findings || []).find(x => x.id === id)?.headline || ''
  const keyShort = (rep.meta?.key || '—').replace(' minor', 'm').replace(' major', '')

  return (
    <div dir="rtl" className="flex min-h-dvh flex-col pb-[118px]">
      <header className="flex items-center justify-between px-[clamp(20px,4vw,54px)] pt-[22px]">
        <span className="digits text-xs tracking-[.34em] text-dim"><b className="font-semibold text-ink">A&R</b>·AI — RACK · REACT</span>
        <span className="digits inline-flex items-center gap-2 text-[9px] uppercase tracking-[.22em] text-faint">
          <i className="h-1.5 w-1.5 rounded-full bg-sig shadow-[0_0_10px_var(--color-sig)]" />
          {busy ? 'מקשיב…' : 'גרור שיר לכל מקום'}
        </span>
      </header>

      <main className="mx-auto grid w-[min(1180px,100%)] flex-1 items-stretch gap-[clamp(14px,2vw,26px)] px-[clamp(20px,4vw,54px)] py-[clamp(18px,4vh,44px)]
                       max-[980px]:[grid-template-areas:'orb'_'master'_'mix'_'scan'_'tempo'] max-[980px]:grid-cols-1
                       [grid-template-areas:'master_orb_mix'_'scan_orb_tempo'] [grid-template-columns:1fr_minmax(300px,380px)_1fr]">
        <LufsMeter lufs={raw.lufs ?? -11.4} target={raw.norms?.lufs || [-9, -7]} read={f('Master')} />
        <ScoreOrb score={rep.overall ?? 82} genre={(rep.meta?.genre || '—').toUpperCase()} verdict={rep.verdict} />
        <MixDiagnostics bands={raw.tonal_bands || []} mudHz={raw.mud_peak_hz} read={f('Mix')} />
        <TextureScanner tells={rep.ai_signals?.tells || []} headline={rep.ai_signals?.headline} />
        <TempoCell bpm={rep.meta?.bpm ?? 124} keyName={keyShort} truePeak={raw.true_peak_db ?? -0.8} read={f('Tempo')} />
      </main>

      <TransportDock curve={raw.energy_curve || []} duration={raw.duration_sec || 0}
                     audio={audio} trackName={trackName} />

      {/* full-screen drop veil */}
      <style>{`body[data-drag]::after{content:"שחרר.";position:fixed;inset:0;z-index:60;display:grid;place-items:center;
        font-size:clamp(40px,7vw,84px);font-weight:650;letter-spacing:-.02em;color:var(--color-ink);
        background:color-mix(in srgb,var(--color-bg) 82%,transparent);backdrop-filter:blur(10px)}`}</style>
    </div>
  )
}
