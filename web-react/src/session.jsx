import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyze, demo, health, MAX_UPLOAD } from './lib/api.js'
import { saveHistoryEntry } from './lib/history.js'
import { addRef, clearRefs } from './lib/reference.js'
import { matchPlugin, normPl } from './lib/report-utils.js'
import { parseSharedHash } from './lib/share.js'
import { fxReset } from './lib/fx.js'
import { useLang } from './i18n/index.jsx'

const Ctx = createContext(null)
const pref = (k, d) => localStorage.getItem(k) ?? d

export function SessionProvider({ children }) {
  const { lang, ui } = useLang()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyKind, setBusyKind] = useState('report')          // 'report' | 'v2'
  const [engineUp, setEngineUp] = useState(null)
  const [audio, setAudio] = useState(null)
  const [selected, setSelected] = useState(null)
  const [toasts, setToasts] = useState([])
  const [cmp, setCmp] = useState(null)                        // {v1, v2} for /compare
  const [batch, setBatch] = useState(null)                    // {rows:[{name,state,overall}], items} for /batch
  const [refTick, setRefTick] = useState(0)                   // reference changed → re-render

  // preferences — same localStorage keys as web/index.html
  const [deep, _setDeep] = useState(() => pref('anr_deep', '0') === '1')
  const [genre, _setGenre] = useState(() => pref('anr_genre', 'auto'))
  const [plat, _setPlat] = useState(() => pref('anr_platform', 'suno'))
  const [suite, _setSuite] = useState(() => pref('anr_suite', 'fabfilter'))
  const [rmode, _setRmode] = useState(() => pref('anr_rmode', 'basic'))
  const [arsenal, _setArsenal] = useState(() => {
    try { const a = JSON.parse(pref('anr_arsenal', '[]')); return Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.trim()) : [] }
    catch { return [] }
  })
  const [user, _setUser] = useState(() => { try { return JSON.parse(pref('anr_user', 'null')) } catch { return null } })

  const setDeep = v => { _setDeep(v); localStorage.setItem('anr_deep', v ? '1' : '0') }
  const setGenre = v => { _setGenre(v); localStorage.setItem('anr_genre', v) }
  const setPlat = v => { _setPlat(v); localStorage.setItem('anr_platform', v) }
  const setSuite = v => { _setSuite(v); localStorage.setItem('anr_suite', v) }
  const setRmode = v => { _setRmode(v); localStorage.setItem('anr_rmode', v) }
  const setUser = u => { _setUser(u); u ? localStorage.setItem('anr_user', JSON.stringify(u)) : localStorage.removeItem('anr_user') }
  const saveArsenal = a => { _setArsenal(a); try { localStorage.setItem('anr_arsenal', JSON.stringify(a)) } catch { /* quota */ } }
  const addPlugins = raw => {
    const a = [...arsenal]
    String(raw).split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      const kb = matchPlugin(s), v = kb ? kb.n : s                 // canonicalize; unknowns kept raw
      if (!a.some(x => normPl(x) === normPl(v))) a.push(v)
    })
    saveArsenal(a)
  }
  const removePlugin = v => saveArsenal(arsenal.filter(x => x !== v))

  const audioRef = useRef(null)
  const fileRef = useRef(null)
  const isDemoRef = useRef(false)
  const v1Ref = useRef(null)                                   // v1 for the real V2 comparison

  useEffect(() => { health().then(setEngineUp) }, [])

  const toast = useCallback((msg, err) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg: String(msg), err: !!err }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600)
  }, [])

  const attachAudio = f => {
    if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src) }
    if (!f) { audioRef.current = null; setAudio(null); return }
    const a = new Audio(URL.createObjectURL(f))
    audioRef.current = a; setAudio(a)
  }

  const okSize = f => { if (f.size > MAX_UPLOAD) { toast(ui('err_toobig'), true); return false } return true }

  const finish = (rep, trackName, f, demoRun) => {
    isDemoRef.current = !!demoRun
    setReport(rep); setName(trackName); attachAudio(f); setSelected(null); fxReset()
    v1Ref.current = rep
    setRmode('basic')   // every fresh report opens with the ONE story (Bible law 2)
    navigate('/report')
    // deep was requested but didn't produce a vocal read — say WHY
    const ds = rep.deep_status
    if (ds && ds !== 'ran') toast(ui(ds === 'no_vocals' ? 'deep_novoc' : 'deep_fail'), ds !== 'no_vocals')
  }

  const measure = async (f, { rerun = false } = {}) => {
    if (!okSize(f)) return
    fileRef.current = f
    setBusy(true); setBusyKind('report'); setName(f.name); navigate('/')
    try {
      const rep = await analyze(f, { genre, lang, deep })
      saveHistoryEntry(f.name, rep, rerun)
      finish(rep, f.name.replace(/\.[^.]+$/, ''), f, false)
    } catch (err) {
      toast(err instanceof TypeError ? ui('err_network') : String(err), true)
      navigate('/')
    } finally { setBusy(false) }
  }

  const runDemo = async () => {
    setBusy(true); setBusyKind('report'); fileRef.current = null
    try { finish(await demo(lang), 'Nightdrive (demo)', null, true) }
    catch { toast(ui('err_network'), true) }
    finally { setBusy(false) }
  }

  // ── V2: real comparison between two analyzed reports ──
  const openCompare = (v1, v2) => { setCmp({ v1, v2 }); navigate('/compare') }
  const compareUpload = async f => {
    if (!okSize(f) || !v1Ref.current) return
    setBusy(true); setBusyKind('v2'); setName(f.name); navigate('/')
    try {
      const rep = await analyze(f, { genre, lang, deep, purpose: 'v2' })
      saveHistoryEntry(f.name, rep)
      openCompare(v1Ref.current, rep)
    } catch (err) { toast(err instanceof TypeError ? ui('err_network') : String(err), true); navigate('/report') }
    finally { setBusy(false) }
  }
  const compareDemo = async () => {
    if (!v1Ref.current) return
    setBusy(true); setBusyKind('v2'); navigate('/')
    try { openCompare(v1Ref.current, await demo(lang, 2)) }
    catch { toast(ui('err_network'), true); navigate('/report') }
    finally { setBusy(false) }
  }

  // ── batch shoot-out: 2–12 files, sequential, honest progress ──
  const runBatch = async files => {
    const fs = files.slice(0, 12).filter(okSize)
    if (!fs.length) return
    isDemoRef.current = false
    setBatch({ rows: fs.map(f => ({ name: f.name, state: 'wait' })), items: null, done: 0, total: fs.length })
    navigate('/batch')
    const items = []
    for (let i = 0; i < fs.length; i++) {
      setBatch(b => ({ ...b, done: i, rows: b.rows.map((r, j) => j === i ? { ...r, state: 'run' } : r) }))
      try {
        const rep = await analyze(fs[i], { genre, lang, deep })
        items.push({ file: fs[i], rep })
        setBatch(b => ({ ...b, rows: b.rows.map((r, j) => j === i ? { ...r, state: 'done', overall: rep.overall } : r) }))
      } catch {
        setBatch(b => ({ ...b, rows: b.rows.map((r, j) => j === i ? { ...r, state: 'fail' } : r) }))
        toast(ui('bt_err')(fs[i].name), true)
      }
    }
    if (items.length === 0) { navigate('/'); return }
    if (items.length === 1) { toast(ui('bt_one')); openBatchItem(items[0]); return }
    setBatch(b => ({ ...b, items }))
  }
  const openBatchItem = item => {
    saveHistoryEntry(item.file.name, item.rep)
    fileRef.current = item.file    // keep in memory so the vocal card can deep-rerun it
    finish(item.rep, item.file.name.replace(/\.[^.]+$/, ''), item.file, false)
  }

  // routeFiles — one file analyzes, a pile becomes a shoot-out
  const routeFiles = list => {
    const files = [...(list || [])].filter(f => f && f.name)
    if (!files.length || busy) return
    if (files.length === 1) measure(files[0])
    else runBatch(files)
  }

  const openEntry = e => {
    if (!e?.rep) return
    fileRef.current = null; v1Ref.current = e.rep
    finish(e.rep, e.name, null, false)
  }

  // reference: the exact same engine (purpose=reference skips narrative layers)
  const uploadReference = async f => {
    if (!okSize(f)) return
    setRefTick(t => t + 1000)      // ref section shows "measuring…" via odd tick
    try {
      const rep = await analyze(f, { genre, lang, purpose: 'reference' })
      addRef(f.name.replace(/\.[^.]+$/, ''), rep._raw || {})
      toast(ui('ref_saved'))
    } catch (err) { toast(typeof err === 'string' ? err : ui('ref_err'), true) }
    setRefTick(t => Math.floor(t % 1000) + 1)
  }
  const bumpRef = () => setRefTick(t => Math.floor(t % 1000) + 1)
  const clearReference = () => { clearRefs(); bumpRef() }

  // deep re-run of the SAME file (vocal card): replaces the desk entry, no vdiff
  const deepRerun = () => {
    if (!fileRef.current || isDemoRef.current) return false
    if (!deep) setDeep(true)
    measure(fileRef.current, { rerun: true })
    return true
  }

  // language switch with a report on screen: re-analyze the same file in the
  // new language so the sentences translate too (demo refetches translated)
  const langRef = useRef(lang)
  useEffect(() => {
    if (langRef.current === lang) return
    langRef.current = lang
    if (!report) return
    if (isDemoRef.current) {
      demo(lang).then(rep => { setReport(rep); v1Ref.current = rep }).catch(() => {})
    } else if (fileRef.current) {
      setBusy(true)
      analyze(fileRef.current, { genre, lang, deep })
        .then(rep => { setReport(rep); v1Ref.current = rep })
        .catch(() => {})
        .finally(() => setBusy(false))
    }
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // shared-report links: #r=<compressed report> opens read-only — no upload
  useEffect(() => {
    const restore = async () => {
      const rep = await parseSharedHash(location.hash)
      if (!rep) return
      fileRef.current = null; isDemoRef.current = false; v1Ref.current = rep
      setReport(rep); setName(String(rep.filename || '').replace(/\.[^.]+$/, '')); attachAudio(null)
      navigate('/report')
    }
    restore()
    addEventListener('hashchange', restore)
    return () => removeEventListener('hashchange', restore)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    report, name, busy, busyKind, engineUp, audio, selected, setSelected, toasts, toast,
    deep, setDeep, genre, setGenre, plat, setPlat, suite, setSuite, rmode, setRmode,
    arsenal, addPlugins, removePlugin, user, setUser, refTick,
    cmp, batch, isDemo: isDemoRef, file: fileRef,
    measure, runDemo, routeFiles, openEntry, openBatchItem, runBatch,
    compareUpload, compareDemo, openCompare, uploadReference, clearReference, bumpRef, deepRerun,
  }), [report, name, busy, busyKind, engineUp, audio, selected, toasts, deep, genre, plat,
       suite, rmode, arsenal, user, refTick, cmp, batch, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession outside SessionProvider')
  return ctx
}
