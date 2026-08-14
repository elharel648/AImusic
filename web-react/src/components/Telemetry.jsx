/** Telemetry strip — the five numbers an A&R glances at first. Labels are the
 *  app-wide mono-caps unit idiom (deliberately untranslated, like TRUE PEAK). */
export default function Telemetry({ rep }) {
  const m = rep.meta || {}, raw = rep._raw || {}, stc = (rep.streaming || {}).checks || []
  const stLvl = (rep.streaming || {}).level
  const cells = [
    m.bpm != null && { v: String(m.bpm), u: 'BPM' },
    m.key && { v: m.key, u: 'KEY' },
    raw.lufs != null && { v: String(raw.lufs), u: 'LUFS', ok: stLvl ? stLvl === 'good' : null },
    raw.true_peak_db != null && { v: raw.true_peak_db + ' dBTP', u: 'TRUE PEAK', ok: stc[0] ? stc[0].ok : null },
    m.duration && { v: m.duration, u: 'LENGTH', ok: stc[2] ? stc[2].ok : null },
  ].filter(Boolean)
  if (!cells.length) return null
  return (
    <div dir="ltr" className="rule-t flex flex-wrap gap-x-8 gap-y-2 py-4">
      {cells.map(c => (
        <span key={c.u} className="flex items-baseline gap-2">
          <span className="val text-[16px] font-semibold">{c.v}</span>
          <span className="lbl flex items-center gap-1">
            {c.ok != null && <i className={`inline-block h-[6px] w-[6px] rounded-full ${c.ok ? 'bg-ok' : 'bg-red'}`} aria-hidden />}
            {c.u}
          </span>
        </span>
      ))}
    </div>
  )
}
