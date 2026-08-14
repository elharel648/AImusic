import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyze, demo, health, MAX_UPLOAD } from './lib/api.js'
import { saveHistoryEntry } from './lib/history.js'
import { useLang } from './i18n/index.jsx'

const Ctx = createContext(null)

export function SessionProvider({ children }) {
  const { lang, ui } = useLang()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [deep, setDeep] = useState(false)
  const [error, setError] = useState(null)
  const [engineUp, setEngineUp] = useState(null)   // null = unknown yet
  const [audio, setAudio] = useState(null)
  const [selected, setSelected] = useState(null)   // finding id ↔ timeline region
  const audioRef = useRef(null)
  const fileRef = useRef(null)                     // current File — for the waveform reveal

  useEffect(() => { health().then(setEngineUp) }, [])

  const attachAudio = f => {
    if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src) }
    if (!f) { audioRef.current = null; setAudio(null); return }
    const a = new Audio(URL.createObjectURL(f))
    audioRef.current = a; setAudio(a)
  }

  const finish = (rep, trackName, f) => {
    setReport(rep); setName(trackName); attachAudio(f); setSelected(null)
    navigate('/report')
    return rep
  }

  const measure = async f => {
    setError(null)
    if (f.size > MAX_UPLOAD) { setError(ui('err_toobig')); return }
    fileRef.current = f
    setBusy(true); setName(f.name); navigate('/')
    try {
      const rep = await analyze(f, { genre: 'auto', lang, deep })
      saveHistoryEntry(f.name, rep)   // real analyses only — the demo never lands on the desk
      finish(rep, f.name.replace(/\.[^.]+$/, ''), f)
    } catch (err) {
      setError(err instanceof TypeError ? ui('err_network') : String(err))
    } finally { setBusy(false) }
  }

  const runDemo = async () => {
    setError(null); setBusy(true); fileRef.current = null
    try { finish(await demo(lang), 'Nightdrive (demo)', null) }
    catch { setError(ui('err_network')) }
    finally { setBusy(false) }
  }

  // reopen from the desk — no audio file after a reload, the strip renders without transport
  const openEntry = e => {
    if (!e?.rep) return
    setError(null); fileRef.current = null
    finish(e.rep, e.name, null)
  }

  const value = useMemo(() => ({
    report, name, busy, error, engineUp, audio, deep, setDeep, selected, setSelected,
    file: fileRef, measure, runDemo, openEntry,
  }), [report, name, busy, error, engineUp, audio, deep, selected, lang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession outside SessionProvider')
  return ctx
}
