import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
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
    <div dir="rtl" className="min-h-dvh bg-black">
      <Sidebar />

      {/* app column: header + scrollable content, offset for the fixed sidebar + dock */}
      <div className="flex min-h-dvh flex-col pb-[118px] lg:ms-[232px]">
        <Header trackName={trackName} busy={busy} report={rep} />

        <main className="mx-auto w-full max-w-[1060px] flex-1 px-[clamp(16px,3vw,32px)] py-7">
          {/* ── HERO: master score, anchored ── */}
          <section className="glasspanel toplight grid items-center gap-6 rounded-2xl border border-white/10 p-6 md:grid-cols-[auto_1fr]">
            <ScoreOrb compact score={rep.overall ?? 82} genre={(rep.meta?.genre || '—').toUpperCase()} />
            <div className="min-w-0">
              <div className="digits mb-2 text-[9px] uppercase tracking-[.26em] text-faint">Master score · producer's read</div>
              <p className="max-w-[42ch] text-[19px] leading-[1.55] text-ink [text-wrap:balance]">{rep.verdict}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/" className="rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] text-dim transition hover:border-white/25 hover:text-ink">
                  לדוח המלא ←
                </a>
              </div>
            </div>
          </section>

          {/* ── GRID: four instruments, two columns, anchored ── */}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <LufsMeter lufs={raw.lufs ?? -11.4} target={raw.norms?.lufs || [-9, -7]} read={f('Master')} />
            <MixDiagnostics bands={raw.tonal_bands || []} mudHz={raw.mud_peak_hz} read={f('Mix')} />
            <TempoCell bpm={rep.meta?.bpm ?? 124} keyName={keyShort} truePeak={raw.true_peak_db ?? -0.8} read={f('Tempo')} />
            <TextureScanner tells={rep.ai_signals?.tells || []} headline={rep.ai_signals?.headline} />
          </div>
        </main>

        <TransportDock curve={raw.energy_curve || []} duration={raw.duration_sec || 0}
                       audio={audio} trackName={trackName} />
      </div>

      {/* full-screen drop veil */}
      <style>{`body[data-drag]::after{content:"שחרר.";position:fixed;inset:0;z-index:60;display:grid;place-items:center;
        font-size:clamp(40px,7vw,84px);font-weight:650;letter-spacing:-.02em;color:var(--color-ink);
        background:color-mix(in srgb,#000 82%,transparent);backdrop-filter:blur(10px)}`}</style>
    </div>
  )
}
