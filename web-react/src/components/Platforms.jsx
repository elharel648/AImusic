import { useLang } from '../i18n/index.jsx'

/** Streaming normalization — a ruled table, set like a spec sheet. */
export default function Platforms({ streaming }) {
  const { ui } = useLang()
  if (!streaming?.platforms?.length) return null
  return (
    <section className="rule-t py-7">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="lbl">{ui('st_section')}</span>
        <span className="h-px flex-1 bg-rule" aria-hidden />
      </div>
      <h3 className="max-w-[56ch] text-[16.5px] font-semibold leading-snug">{streaming.headline}</h3>

      <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="lbl text-start">
              <th className="border-b border-ink pb-1.5 text-start font-semibold">{ui('st_h_plat')}</th>
              <th className="border-b border-ink pb-1.5 text-start font-semibold">{ui('st_h_target')}</th>
              <th className="border-b border-ink pb-1.5 text-start font-semibold">{ui('st_h_result')}</th>
            </tr>
          </thead>
          <tbody>
            {streaming.platforms.map(p => (
              <tr key={p.name} className="border-b border-rule">
                <td className="py-1.5"><span dir="ltr" className="inline-block">{p.name}</span></td>
                <td className="py-1.5"><span className="val">{p.target} LUFS</span></td>
                <td className="py-1.5 text-ink2">
                  {p.mode === 'down' ? ui('rk_pl_down')(Math.abs(p.delta).toFixed(1))
                    : p.mode === 'up' ? ui('rk_pl_up')(Math.abs(p.delta).toFixed(1))
                    : ui('rk_pl_asis')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {streaming.checks?.length > 0 && (
          <div>
            {streaming.checks.map(c => (
              <div key={c.t} className="border-b border-rule py-2 text-[13px]">
                <div className="flex items-baseline gap-3">
                  <span className={`val text-[12px] font-semibold ${c.ok ? 'text-ok' : 'text-red'}`}>{c.ok ? '✓' : '✗'}</span>
                  <b className="font-semibold">{c.t}</b>
                  <span className="val text-ink2">{c.v}</span>
                </div>
                {!c.ok && c.d && <p className="mt-0.5 ps-7 text-[12.5px] leading-relaxed text-ink2">{c.d}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
