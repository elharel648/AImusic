// "Your desk" — the exact localStorage model of web/index.html (key + schema),
// so a user's existing history carries over the day this app takes the wheel.
const HIST_KEY = 'anr_history'

export function loadHistory() {
  try {
    const a = JSON.parse(localStorage.getItem(HIST_KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch { return [] }
}

export function clearHistory() { localStorage.removeItem(HIST_KEY) }

export function saveHistoryEntry(fname, rep, replaceLast) {
  if (!rep || typeof rep.overall !== 'number') return
  const m = rep.meta || {}, raw = rep._raw || {}
  const e = {
    name: String(fname || '').replace(/\.[^.]+$/, ''), ts: Date.now(), overall: rep.overall,
    lufs: typeof raw.lufs === 'number' ? raw.lufs : null, bpm: m.bpm || null, key: m.key || null,
    genre: m.genre || null,
    aiCount: (rep.ai_signals && typeof rep.ai_signals.count === 'number') ? rep.ai_signals.count : null,
    rep,   // full report — the desk can reopen it after a reload
  }
  const h = loadHistory(); const last = h[h.length - 1]
  if (replaceLast && last && last.name === e.name) {
    h[h.length - 1] = e   // deep re-run of the same file upgrades the entry
  } else {
    if (last && last.name === e.name && last.overall === e.overall && e.ts - last.ts < 60000) return
    h.push(e); if (h.length > 30) h.splice(0, h.length - 30)
  }
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h)) }
  catch { // quota: keep tiles, drop stored reports on all but the newest 5
    try { h.slice(0, -5).forEach(x => { delete x.rep }); localStorage.setItem(HIST_KEY, JSON.stringify(h)) } catch { /* full */ }
  }
}
