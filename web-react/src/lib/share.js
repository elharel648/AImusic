// Shareable report card (canvas PNG, honest numbers only) + the live report
// link: the whole report deflate-compressed into the URL hash. Nothing touches
// the server — the link IS the report.
const b64u = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }

export async function reportLink(rep) {
  const slim = JSON.parse(JSON.stringify(rep))
  if (slim._raw) delete slim._raw._chroma_h
  const bytes = new TextEncoder().encode(JSON.stringify(slim))
  const base = location.origin + '/rack/report'
  if (window.CompressionStream) {
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
    return base + '#r=z' + b64u(new Uint8Array(buf))
  }
  return base + '#r=j' + b64u(bytes)
}

export async function parseSharedHash(hash) {
  const m = String(hash || '').match(/^#r=([zj])([A-Za-z0-9_-]+)$/); if (!m) return null
  try {
    const bytes = Uint8Array.from(atob(m[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const json = m[1] === 'z'
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
      : new TextDecoder().decode(bytes)
    const rep = JSON.parse(json)
    if (!rep || !Array.isArray(rep.findings) || typeof rep.overall !== 'number') return null
    return rep
  } catch { return null }
}

// the PNG card — dark, social-sized, every number measured
export function drawShareCard(rep, name, ui, rtl) {
  const W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')
  const amber = '#E3A455'
  const disp = 'Georgia, "Times New Roman", serif'
  const mono = 'ui-monospace, "SF Mono", Menlo, monospace'
  const sans = '-apple-system, "Segoe UI", sans-serif'
  if (rtl) x.direction = 'rtl'
  x.fillStyle = '#0B0C0E'; x.fillRect(0, 0, W, H)
  const g = x.createRadialGradient(W * 0.82, -80, 60, W * 0.82, -80, 620)
  g.addColorStop(0, 'rgba(34,211,238,0.13)'); g.addColorStop(1, 'rgba(34,211,238,0)')
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  const L = rtl ? W - 72 : 72, R = rtl ? 72 : W - 72, A = rtl ? 'right' : 'left', B = rtl ? 'left' : 'right'
  x.fillStyle = amber; x.beginPath(); x.arc(rtl ? W - 78 : 78, 64, 5, 0, 7); x.fill()
  x.textAlign = A; x.fillStyle = '#F4F5F7'; x.font = `600 20px ${mono}`
  x.fillText('A&R · AI', rtl ? W - 96 : 96, 71)
  x.textAlign = B; x.fillStyle = 'rgba(244,245,247,0.35)'; x.font = `15px ${mono}`
  x.fillText(new Date().toISOString().slice(0, 10), R, 70)
  x.strokeStyle = 'rgba(244,245,247,0.10)'; x.beginPath(); x.moveTo(72, 100); x.lineTo(W - 72, 100); x.stroke()
  x.textAlign = B; x.fillStyle = '#F4F5F7'; x.font = `400 150px ${disp}`
  x.fillText(String(rep.overall), R, 260)
  x.fillStyle = 'rgba(244,245,247,0.4)'; x.font = `14px ${mono}`
  if (rtl) { x.direction = 'ltr'; x.fillText(ui('overall') + ' · 100', R, 292); x.direction = 'rtl' }
  else x.fillText('/100 · ' + ui('overall').toUpperCase(), R, 292)
  const m = rep.meta || {}
  x.textAlign = A; x.fillStyle = '#F4F5F7'; x.font = `700 40px ${sans}`
  x.fillText((name || '').slice(0, 26), L, 190)
  x.fillStyle = 'rgba(244,245,247,0.5)'; x.font = `17px ${mono}`
  x.fillText([m.genre, (m.bpm ? m.bpm + ' BPM' : ''), m.key, m.duration].filter(Boolean).join(' · ').toUpperCase(), L, 228)
  x.fillStyle = '#F4F5F7'; x.font = `400 33px ${disp}`
  const words = (rep.verdict || '').split(' '); let line = '', y = 330; const lines = []
  for (const w of words) { if (x.measureText(line + ' ' + w).width > 720) { lines.push(line); line = w } else line = line ? line + ' ' + w : w }
  lines.push(line)
  lines.slice(0, 3).forEach(l => { x.fillText(l, L, y); y += 44 })
  // energy-curve signature strip — every track's card looks like that track
  const raw = rep._raw || {}, curve = raw.energy_curve
  if (curve && curve.length > 7) {
    const sy = 436, sh = 38, sw = W - 144, n = curve.length, bw = sw / n
    const dur = raw.duration_sec || 0
    const introF = dur ? (raw.intro_sec || 0) / dur : 0, peakF = dur ? (raw.peak_moment_sec || 0) / dur : -1
    for (let i = 0; i < n; i++) {
      const f = i / n, bh = Math.max(2, curve[i] * sh)
      x.fillStyle = f < introF ? 'rgba(232,180,68,0.35)' : 'rgba(244,245,247,0.16)'
      x.fillRect(72 + i * bw, sy + sh - bh, Math.max(1, bw - 1.6), bh)
    }
    if (peakF >= 0 && peakF <= 1) {
      const px = 72 + peakF * sw, pb = Math.max(2, (curve[Math.min(n - 1, Math.floor(peakF * n))] || 0.8) * sh)
      x.fillStyle = amber; x.beginPath(); x.arc(px, sy + sh - pb - 6, 3.5, 0, 7); x.fill()
    }
  }
  const st = rep.streaming, ai = rep.ai_signals
  const chips = [[String(rep._raw ? rep._raw.lufs : '—'), 'LUFS'],
    [String(m.bpm || '—'), 'BPM'],
    [String(ai ? ai.count : '—'), ui('ai_row').toUpperCase()],
    [st ? st.checks.filter(k => k.ok).length + '/' + st.checks.length : '—', ui('bt_stream').toUpperCase()]]
  const cw = (W - 144 - 3 * 18) / 4
  chips.forEach((ch, i) => {
    const cx = 72 + i * (cw + 18), cy = 494
    x.strokeStyle = 'rgba(244,245,247,0.12)'; x.strokeRect(cx, cy, cw, 78)
    x.textAlign = 'center'; x.fillStyle = amber; x.font = `600 28px ${mono}`
    x.direction = 'ltr'
    x.fillText(ch[0], cx + cw / 2, cy + 37)
    if (rtl) x.direction = 'rtl'
    x.fillStyle = 'rgba(244,245,247,0.4)'; x.font = `11px ${mono}`
    x.fillText(ch[1], cx + cw / 2, cy + 62)
  })
  x.strokeStyle = 'rgba(244,245,247,0.10)'; x.beginPath(); x.moveTo(72, 596); x.lineTo(W - 72, 596); x.stroke()
  x.textAlign = A; x.fillStyle = 'rgba(244,245,247,0.35)'; x.font = `13px ${mono}`
  x.fillText(String(ui('ft_tag') || '').slice(0, 80), L, 620)
  x.textAlign = B; x.fillStyle = 'rgba(244,245,247,0.45)'; x.font = `600 13px ${mono}`
  x.fillText('A&R · AI', R, 620)
  return c
}

export function downloadCard(rep, name, ui, rtl, done) {
  const c = drawShareCard(rep, name, ui, rtl)
  c.toBlob(b => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = (name || 'track').replace(/\s+/g, '_') + '_anr_card.png'
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    done && done()
  })
}
