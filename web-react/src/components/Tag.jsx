/** Provenance — typographic, never a badge.
 *  filled ✓ = measured from the signal · ≈ = algorithmic estimate ·
 *  ◇ = ML model · producer's read wears text's clothes (serif, blue), never the ✓. */
const KINDS = {
  measured: { glyph: '✓', label: 'נמדד', cls: 'text-ok' },
  est:      { glyph: '≈', label: 'הערכה', cls: 'text-ink2' },
  model:    { glyph: '◇', label: 'מודל', cls: 'text-ink2' },
}

export default function Tag({ kind = 'measured' }) {
  if (kind === 'read')
    return <span className="display whitespace-nowrap text-[12px] font-medium text-blue">קריאת מפיק</span>
  const k = KINDS[kind] || KINDS.measured
  return (
    <span className={`whitespace-nowrap text-[11px] font-semibold ${k.cls}`}>
      <span className="val text-[10px]">{k.glyph}</span> {k.label}
    </span>
  )
}
