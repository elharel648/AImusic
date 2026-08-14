// Shared report helpers — ported verbatim from web/index.html.
import { PLUGIN_KB, RX_PLUG, RX_PARAMS, RX_PARAMS_PLUGIN, WALKTHROUGHS } from './plugin-kb.js'

export const fmt = s => { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }
export const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// RTL bidi guard: isolate number+unit runs so the bidi algorithm can't flip a
// minus sign or a range inside Hebrew prose. No-op in LTR languages.
const NUM_RUN = /((?:[+\-−~≈]\s?)?\d[\d.,:]*(?:\s?(?:dBTP|dBFS|dB|LUFS|BPM|kHz|Hz|LU|ms|s\b|%|¢))?(?:\s?[\-–]\s?\d[\d.,:]*(?:\s?(?:dBTP|dBFS|dB|LUFS|BPM|kHz|Hz|LU|ms|s\b|%|¢))?)?)/g
export const bidiHTML = (text, dir) => {
  const safe = esc(text)
  return dir === 'rtl' ? safe.replace(NUM_RUN, '<span dir="ltr" style="unicode-bidi:isolate">$1</span>') : safe
}

// measured worst-stretch per finding (engine spans) — powers chips + loop buttons
const SPAN_KEYS = { Mix: 'mud_spans', Sibilance: 'sib_spans', LowEnd: 'lowend_spans' }
export function findingSpans(rep, id) {
  const sp = (rep._raw || {})[SPAN_KEYS[id]]
  return (Array.isArray(sp) && sp.length) ? sp : null
}

// version-y suffixes get stripped until the name stops changing, so
// "Nightdrive v2 final" and "Nightdrive (3)" land on the same base
const VER_SUFFIX = /[\s\-_.()\[\]]*((v|ver|version)\s*\.?\s*\d+|final|master(ed)?|mix(down)?\s*\d*|edit|bounce|copy|\d{1,2})[)\]]*$/i
export function baseSongName(n) {
  let s = String(n || '').replace(/\.[^.]+$/, '').toLowerCase().trim()
  for (let i = 0; i < 3; i++) { const t = s.replace(VER_SUFFIX, '').trim(); if (t === s) break; s = t }
  return s.replace(/\s+/g, ' ')
}

// ── plugin matching (case/punctuation-insensitive, substring both ways) ──
export const normPl = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '')
export const KB_BY_NAME = {}
PLUGIN_KB.forEach(p => { KB_BY_NAME[normPl(p.n)] = p })
export function matchPlugin(raw) {
  const q = normPl(raw); if (q.length < 2) return null
  let best = null, bs = 0
  PLUGIN_KB.forEach(p => p.a.forEach(al => {
    let s = 0
    if (al === q) s = 1000 + al.length
    else if (q.includes(al)) s = 500 + al.length
    else if (q.length >= 3 && al.includes(q)) s = 100 + q.length * 10 - al.length
    if (s > bs) { bs = s; best = p }
  }))
  return best
}
// rx resolution: owned specialist > owned generic > free pick (honest note) > legacy suite when arsenal empty
export function resolveRxPlugin(type, arsenal, suite) {
  if (!arsenal.length) return { name: RX_PLUG[type][suite], missing: false }
  const owned = arsenal.map(x => KB_BY_NAME[normPl(x)]).filter(p => p && p.t[type])
  if (owned.length) { owned.sort((a, b) => a.t[type] - b.t[type]); return { name: owned[0].n, missing: false } }
  return { name: RX_PLUG[type].free, missing: true }
}
export function rxParamsFor(type, name, rx) {
  const o = RX_PARAMS_PLUGIN[type]
  if (o) { const q = normPl(name); for (const k in o) { if (q.includes(normPl(k))) return o[k](rx) } }
  return RX_PARAMS[type](rx)
}
export function wtGet(name, type, lang) {
  let w = WALKTHROUGHS[name]
  if (!w) { const q = normPl(name); for (const k in WALKTHROUGHS) { if (q.includes(normPl(k))) { w = WALKTHROUGHS[k]; break } } }
  const s = w && w[type]; if (!s) return null
  return (lang === 'he' && s.he) ? s.he : s.en   // es/fr/de/pt read EN — honest, never machine-garbled
}
// {param}s injected from the rx, bold — returns HTML for one step
export const wtStepHTML = (step, rx) =>
  esc(step).replace(/\{(\w+)\}/g, (mm, k) => rx[k] !== undefined ? `<b>${esc(String(rx[k]))}</b>` : mm)

// every sentence computed from engine measurements — no vibes
export function sxConclusions(raw, ui) {
  const dur = raw.duration_sec || 0, intro = raw.intro_sec || 0, peak = raw.peak_moment_sec
  const norms = (raw.norms && raw.norms.intro_sec) || null
  const reads = []
  if (dur) {
    const p = Math.round(intro / dur * 100)
    if (intro < 3) reads.push(['good', ui('sx_intro_none')])
    else if (!norms) reads.push(['good', ui('sx_intro_plain')(fmt(intro), p), Math.max(0, intro - 3)])
    else {
      const lo = Math.round(norms[0]), hi = Math.round(norms[1])
      if (intro > norms[1]) reads.push(['warn', ui('sx_intro_long')(fmt(intro), p, lo, hi), Math.max(0, intro - 3)])
      else if (intro < norms[0]) reads.push(['good', ui('sx_intro_short')(fmt(intro), lo, hi), Math.max(0, intro - 3)])
      else reads.push(['good', ui('sx_intro_ok')(fmt(intro), p, lo, hi), Math.max(0, intro - 3)])
    }
  }
  if (dur && typeof peak === 'number' && peak > 0) {
    const pp = Math.round(peak / dur * 100)
    if (intro > 3 && peak <= intro) reads.push(['warn', ui('sx_peak_intro')(fmt(peak)), Math.max(0, peak - 3)])
    else if (pp > 85) reads.push(['warn', ui('sx_peak_late')(fmt(peak), pp), Math.max(0, peak - 3)])
    else reads.push(['good', ui('sx_peak_ok')(fmt(peak), pp), Math.max(0, peak - 3)])
  }
  const curve = raw.energy_curve || [], n = curve.length
  const introIdx = dur ? Math.min(n - 1, Math.floor(intro / dur * n)) : 0
  const bodyC = curve.slice(introIdx)
  if (bodyC.length > 12) {
    const s = [...bodyC].sort((a, b) => a - b)
    const med = s[Math.floor(s.length / 2)] || 0, p10 = s[Math.floor(s.length * .1)], p90 = s[Math.floor(s.length * .9)]
    let dips = 0, run = 0
    bodyC.forEach(v => { if (v < med * 0.62) run++; else { if (run >= 2) dips++; run = 0 } })
    if (run >= 2) dips++
    if (dips > 0) reads.push(['good', ui('sx_dips')(dips)])
    else if ((p90 - p10) < 0.22) reads.push(['warn', ui('sx_flat')])
  }
  return reads
}

// measured moments on the timeline: each one a finding the engine anchored in TIME
export function sxMoments(rep) {
  const out = []; const raw = rep._raw || {}; let peakUsed = false
  ;(rep.findings || []).forEach(f => {
    if (f.sev !== 'warn' && f.sev !== 'crit') return
    const sp = findingSpans(rep, f.id)
    if (sp) { out.push({ t0: sp[0][0], t1: sp[0][1], sev: f.sev, text: f.headline, fid: f.id }); return }
    if (['Master', 'Dynamics', 'Clipping', 'Punch'].includes(f.id)
        && typeof raw.peak_moment_sec === 'number' && !peakUsed) {
      peakUsed = true
      out.push({ t0: Math.max(0, raw.peak_moment_sec - 4), t1: raw.peak_moment_sec + 4, sev: f.sev, text: f.headline, fid: f.id })
    }
  })
  return out.slice(0, 4)   // never clutter — four pointed fingers max
}

// honest scope: only EQ-representable moves can be previewed truthfully
export function fixChainFromReport(rep) {
  const moves = []
  ;(rep && rep.findings || []).forEach(it => {
    const rx = it.rx; if (!rx) return
    if (rx.type === 'eq_cut' && rx.freq) moves.push({ f: +rx.freq, g: -Math.abs(rx.gain_db || 3), q: 1.4 })
    if (rx.type === 'deess') moves.push({ f: +(rx.freq || 7000), g: -4, q: 2.5 })
  })
  return moves.slice(0, 3)
}
