import { useMemo } from 'react'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { loadHistory } from '../lib/history.js'
import { baseSongName, bidiHTML } from '../lib/report-utils.js'

/** The desk knows you — three honest pieces of desk intelligence:
 *  Patterns: a habit is named only when the same warn/crit finding shows up
 *  in 3+ DIFFERENT songs AND in the report on screen. Never extrapolated.
 *  Vdiff: "this looks like a new version of X" (name match, then measured
 *  similarity for random Suno/Udio filenames).
 *  Progress: score timeline across every version of THIS song. */

export function Patterns({ rep }) {
  const { ui, dir } = useLang()
  const lines = useMemo(() => {
    const seen = {}; const songs = new Set()
    loadHistory().forEach(e => {
      if (!e || !e.rep || !Array.isArray(e.rep.findings)) return
      const base = baseSongName(e.name) || e.name
      songs.add(base)
      e.rep.findings.forEach(f => {
        if (f.sev === 'warn' || f.sev === 'crit') (seen[f.id] = seen[f.id] || new Set()).add(base)
      })
    })
    if (songs.size < 3) return []
    const out = []
    ;(rep.findings || []).forEach(f => {
      if (f.sev !== 'warn' && f.sev !== 'crit') return
      const n = (seen[f.id] || new Set()).size
      if (n >= 3) out.push(ui('pattern_line')(f.k, n, songs.size))
    })
    return out.slice(0, 2)
  }, [rep, ui])
  if (!lines.length) return null
  return (
    <div className="mt-4 border-s-2 border-blue ps-4">
      <span className="display text-[12px] font-medium text-blue">{ui('pattern_lbl')}</span>
      {lines.map(t => <p key={t} className="text-[13px] leading-relaxed text-ink2"
                         dangerouslySetInnerHTML={{ __html: bidiHTML(t, dir) }} />)}
    </div>
  )
}

export function VdiffBanner({ rep, fname }) {
  const { ui, lang } = useLang()
  const { openCompare, isDemo } = useSession()
  const match = useMemo(() => {
    if (!rep || !fname || isDemo.current) return null
    const h = loadHistory()
    const base = baseSongName(fname)
    // this analysis is the last entry — look behind it for a same-base sibling
    for (let i = h.length - 2; i >= 0; i--) {
      const e = h[i]
      if (!e || !e.rep || baseSongName(e.name) !== base) continue
      let d = ''; try { d = new Date(e.ts).toLocaleDateString(lang, { month: 'short', day: 'numeric' }) } catch { /* locale */ }
      return { e, text: ui('vdiff_txt')(e.name, d) }
    }
    // random Suno/Udio names: MEASURED similarity — same genre, ±3 BPM, ±15% length, ≤48h
    const raw = rep._raw || {}, meta = rep.meta || {}
    for (let i = h.length - 2; i >= 0; i--) {
      const e = h[i]
      if (!e || !e.rep) continue
      if (Date.now() - e.ts > 48 * 3600 * 1000) break
      const em = e.rep.meta || {}, er = e.rep._raw || {}
      if (!em.bpm || !meta.bpm) continue
      const durClose = er.duration_sec && raw.duration_sec
        ? Math.abs(er.duration_sec - raw.duration_sec) / Math.max(er.duration_sec, raw.duration_sec) <= 0.15 : false
      if ((em.genre || '') === (meta.genre || '') && Math.abs(em.bpm - meta.bpm) <= 3 && durClose)
        return { e, text: ui('vdiff_guess')(e.name) }
    }
    return null
  }, [rep, fname]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!match) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border border-rule bg-sheet px-4 py-2.5">
      <span className="val text-red">↺</span>
      <p className="min-w-0 flex-1 text-[13px] text-ink2">{match.text}</p>
      <button className="btn !py-1 text-[12px]" onClick={() => openCompare(match.e.rep, rep)}>{ui('vdiff_btn')}</button>
    </div>
  )
}

export function ProgressStrip({ fname }) {
  const { ui } = useLang()
  const pts = useMemo(() => {
    const base = baseSongName(fname || ''); if (!base) return []
    return loadHistory().filter(e => e && typeof e.overall === 'number' && baseSongName(e.name) === base)
  }, [fname])
  if (pts.length < 2) return null
  const n = pts.length, W = Math.min(560, Math.max(220, n * 64)), H = 74, P = 14
  const x = i => P + (W - 2 * P) * (n === 1 ? 0 : i / (n - 1))
  const y = v => H - P - (H - 2 * P) * (v / 100)
  const line = pts.map((e, i) => `${x(i).toFixed(1)},${y(e.overall).toFixed(1)}`).join(' ')
  return (
    <figure className="mt-4">
      <figcaption className="lbl mb-1">{ui('prog_lbl')(n)}</figcaption>
      <svg dir="ltr" width={W} height={H + 16} viewBox={`0 0 ${W} ${H + 16}`} className="max-w-full">
        <polyline points={line} fill="none" stroke="var(--color-red)" strokeWidth="2" strokeLinejoin="round" opacity="0.85" />
        {pts.map((e, i) => {
          const cur = i === n - 1
          return (
            <g key={e.ts}>
              <circle cx={x(i)} cy={y(e.overall)} r={cur ? 4 : 3} fill={cur ? 'var(--color-red)' : 'var(--color-rule)'} />
              <text x={x(i)} y={y(e.overall) - 8} textAnchor="middle" fontSize="11"
                    fill={cur ? 'var(--color-red)' : 'var(--color-ink2)'} fontWeight={cur ? 700 : 400}
                    fontFamily="var(--font-mono)">{e.overall}</text>
              <text x={x(i)} y={H + 11} textAnchor="middle" fontSize="9.5" fill="var(--color-ink2)"
                    fontFamily="var(--font-mono)">v{i + 1}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/** If this landed on a label today — the verdict reframed as the industry decision. */
export function LabelMoment({ rep }) {
  const { ui } = useLang()
  const probs = (rep.findings || []).filter(f => f.sev === 'crit' || f.sev === 'warn')
    .sort((a, b) => a.score - b.score)
  return (
    <section className="rule-t py-7" data-sec="label">
      <span className="lbl">{ui('lm_title')}</span>
      <p className="display mt-2 max-w-[30ch] text-[clamp(20px,3vw,28px)] font-medium leading-snug [text-wrap:balance]">
        {probs.length ? ui('lm_reject')(probs[0].k) : ui('lm_pass')}
      </p>
      <p className="mt-1 text-[13.5px] text-ink2">{probs.length ? ui('lm_fix')(probs.length) : ui('lm_pass_sub')}</p>
      <p className="val mt-3 text-[11px] text-ink2">A&R·AI — {ui('ft_honest')}</p>
    </section>
  )
}
