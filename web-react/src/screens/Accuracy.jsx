import { useEffect, useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import Tag from '../components/Tag.jsx'

/** Our error rates — the page the trust line promises. Every number renders
 *  live from /api/accuracy, which reads the SAME norms_data.json the engine
 *  measures against. Nothing on this page is typed by hand. */
export default function Accuracy() {
  const { ui } = useLang()
  const [d, setD] = useState(undefined)

  useEffect(() => {
    fetch('/api/accuracy').then(r => r.ok ? r.json() : null).then(setD).catch(() => setD(null))
  }, [])

  if (d === undefined) return <section className="px-6 py-[16vh] text-center text-[14px] text-ink2">…</section>
  if (!d) return <section className="px-6 py-[16vh] text-center text-[14px] text-ink2">{ui('rk_engine_down')}</section>

  const key = d.key?.edm || d.key?.default
  const tempo = d.tempo
  const corpus = d.corpus || {}
  const Row = ({ label, v, strong }) => (
    <div className="rule-t flex items-baseline gap-4 py-2">
      <span className="text-[13.5px]">{label}</span>
      <span className="h-px min-w-6 flex-1 bg-rule" aria-hidden />
      <span className={`val text-[15px] ${strong ? 'font-semibold' : 'text-ink2'}`}>{v}</span>
    </div>
  )

  return (
    <section className="mx-auto max-w-[720px] px-[clamp(18px,4vw,40px)] py-[clamp(28px,6vh,56px)]">
      <span className="lbl">{ui('trust_accuracy')}</span>
      <h1 className="display mt-2 text-[clamp(26px,4.2vw,40px)] font-medium leading-tight [text-wrap:balance]">{ui('rk_acc_title')}</h1>
      <p className="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-ink2">{ui('rk_acc_sub')}</p>

      {/* key detection */}
      {key && (
        <div className="mt-10">
          <div className="mb-1 flex items-baseline gap-3">
            <h2 className="text-[15px] font-bold">{ui('rk_acc_key_h')}</h2>
            <span className="h-px flex-1 bg-rule" aria-hidden />
            <Tag kind="measured" />
          </div>
          <Row label={ui('rk_acc_exact')} v={`${key.exact}%`} strong />
          <Row label={ui('rk_acc_mirex')} v={`${key.mirex_weighted}%`} strong />
          <Row label={ui('rk_acc_fifth')} v={`${key.fifth}%`} />
          <Row label={ui('rk_acc_relative')} v={`${key.relative}%`} />
          <Row label={ui('rk_acc_parallel')} v={`${key.parallel}%`} />
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">{ui('rk_acc_key_note')(key.n)}</p>
        </div>
      )}

      {/* tempo */}
      {tempo && (
        <div className="mt-10">
          <div className="mb-1 flex items-baseline gap-3">
            <h2 className="text-[15px] font-bold">{ui('rk_acc_tempo_h')}</h2>
            <span className="h-px flex-1 bg-rule" aria-hidden />
            <Tag kind="measured" />
          </div>
          <Row label={ui('rk_acc_acc1')(tempo.tolerance_pct)} v={`${tempo.accuracy1}%`} strong />
          <Row label={ui('rk_acc_acc2')} v={`${tempo.accuracy2}%`} strong />
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">{ui('rk_acc_tempo_note')(tempo.n)}</p>
        </div>
      )}

      {/* calibrated confidence */}
      <div className="mt-10">
        <div className="mb-1 flex items-baseline gap-3">
          <h2 className="text-[15px] font-bold">{ui('rk_acc_conf_h')}</h2>
          <span className="h-px flex-1 bg-rule" aria-hidden />
        </div>
        <p className="max-w-[58ch] text-[13.5px] leading-relaxed text-ink2">{ui('rk_acc_conf_p')}</p>
      </div>

      {/* corpus */}
      <div className="mt-10">
        <div className="mb-1 flex items-baseline gap-3">
          <h2 className="text-[15px] font-bold">{ui('rk_acc_corpus_h')}</h2>
          <span className="h-px flex-1 bg-rule" aria-hidden />
        </div>
        {corpus.hits && Object.entries(corpus.hits).map(([g, n]) => (
          <Row key={g} label={`${ui('rk_acc_c_hits')} · ${g}`} v={`n=${n.toLocaleString()}`} />
        ))}
        {corpus.human_baseline_full && <Row label={ui('rk_acc_c_full')} v={`n=${corpus.human_baseline_full.toLocaleString()}`} />}
        {corpus.ai_baseline && <Row label={ui('rk_acc_c_ai')} v={`n=${corpus.ai_baseline.toLocaleString()}`} />}
        {corpus.tonal && Object.entries(corpus.tonal).map(([g, n]) => (
          <div key={g} className="rule-t flex flex-wrap items-baseline gap-x-4 py-2">
            <span className="text-[13.5px]">{ui('rk_acc_c_tonal')} · {g}</span>
            <span className="h-px min-w-6 flex-1 bg-rule" aria-hidden />
            <span className="val text-[15px] text-ink2">n={n}</span>
            {n < 500 && <span className="w-full text-[11.5px] text-red sm:w-auto">{ui('rk_acc_low')}</span>}
          </div>
        ))}
      </div>

      {/* standards */}
      <div className="mt-10">
        <div className="mb-1 flex items-baseline gap-3">
          <h2 className="text-[15px] font-bold">{ui('rk_acc_std_h')}</h2>
          <span className="h-px flex-1 bg-rule" aria-hidden />
          <Tag kind="measured" />
        </div>
        <p className="max-w-[58ch] text-[13.5px] leading-relaxed text-ink2">{ui('rk_acc_std_p')}</p>
      </div>

      {/* what we refuse */}
      <div className="mt-10">
        <div className="mb-2 flex items-baseline gap-3">
          <h2 className="text-[15px] font-bold text-red">{ui('rk_acc_cant_h')}</h2>
          <span className="h-px flex-1 bg-rule" aria-hidden />
        </div>
        {[1, 2, 3].map(i => (
          <p key={i} className="mb-1.5 flex max-w-[62ch] gap-3 text-[13.5px] leading-relaxed text-ink2">
            <span className="val font-bold text-red">✗</span>{ui(`rk_acc_cant_${i}`)}
          </p>
        ))}
      </div>

      <footer className="rule-t mt-12 flex flex-wrap items-baseline gap-x-6 pt-4 text-[12px] text-ink2">
        <span className="display text-[13px] font-bold text-ink">A&R·AI</span>
        <span>{ui('ft_honest')}</span>
        {d.generated && <span className="val ms-auto">{String(d.generated).slice(0, 10)}</span>}
      </footer>
    </section>
  )
}
