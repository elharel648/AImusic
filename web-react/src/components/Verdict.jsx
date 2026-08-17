import { useLang } from '../i18n/index.jsx'

/** The verdict — typeset, not scored. Opens with what works (Bible law 4),
 *  ends on the single priority (law 5). The 0-100 stays a marginal note in
 *  judgment's register — serif, blue, never wearing the ✓. */
export default function Verdict({ rep, works, prio, onHear, compact = false }) {
  const { ui } = useLang()
  if (!rep) return null
  return (
    <section className="py-[clamp(28px,5vw,52px)]">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="lbl">{ui('rk_heard')}</span>
        <span className="h-px flex-1 bg-rule" aria-hidden />
      </div>

      <div className="flex items-start gap-6">
        <h1 className="display min-w-0 max-w-[24ch] flex-1 text-[clamp(27px,4.6vw,44px)] font-medium leading-[1.28] [text-wrap:balance]">
          {rep.verdict}
        </h1>
        {typeof rep.overall === 'number' && (
          <span className="mt-2 shrink-0 text-center">
            <span className="stamp"><span>{rep.overall}<small className="block text-[9px] font-normal opacity-70">/100</small></span></span>
            <span className="display mt-1.5 block text-[10.5px] text-blue">{ui('tag_read')}</span>
          </span>
        )}
      </div>

      {compact ? null : <div className="mt-7 grid gap-x-10 gap-y-3 md:grid-cols-2">
        {works && (
          <p className="text-[14.5px] leading-relaxed text-ink2">
            <span className="val font-semibold text-ok">✓</span>{' '}
            <b className="font-semibold text-ink">{ui('works_lbl')}</b> {works}
          </p>
        )}
        {rep.priority && (
          <div className="border-s-2 border-red ps-4">
            <p className="text-[14.5px] font-medium leading-relaxed">
              <b className="font-bold text-red">{ui('rk_prio_lead')}</b> {rep.priority}
            </p>
            {prio && onHear && (
              <button onClick={() => onHear(prio)}
                      className="mt-1.5 text-[12.5px] font-semibold text-red underline decoration-red/40 underline-offset-4 hover:decoration-red">
                ▸ {ui('hear_it')} <span className="val">{prio.label}</span>
              </button>
            )}
          </div>
        )}
      </div>}
    </section>
  )
}
