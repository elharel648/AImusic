import { useLang } from '../i18n/index.jsx'

/** Provenance — typographic, never a badge.
 *  filled ✓ = measured from the signal · ≈ = algorithmic estimate ·
 *  ◇ = ML model · producer's read wears text's clothes (serif, blue), never the ✓. */
const KINDS = {
  measured: { glyph: '✓', key: 'tag_measured', cls: 'text-ok' },
  est:      { glyph: '≈', key: 'rk_tag_est', cls: 'text-ink2' },
  model:    { glyph: '◇', key: 'rk_tag_model', cls: 'text-ink2' },
}

export default function Tag({ kind = 'measured' }) {
  const { ui } = useLang()
  if (kind === 'read')
    return <span className="display whitespace-nowrap text-[12px] font-medium text-blue">{ui('tag_read')}</span>
  const k = KINDS[kind] || KINDS.measured
  return (
    <span className={`whitespace-nowrap text-[11px] font-semibold ${k.cls}`}>
      <span className="val text-[10px]">{k.glyph}</span> {ui(k.key)}
    </span>
  )
}
