import Tag from './Tag.jsx'
import Prescription from './Prescription.jsx'
import { useLang } from '../i18n/index.jsx'
import { findingSpans, fmt, bidiHTML } from '../lib/report-utils.js'

const SEV = {
  good: { key: 'rk_sev_good', cls: 'text-ok' },
  warn: { key: 'rk_sev_warn', cls: 'text-red' },
  crit: { key: 'rk_sev_crit', cls: 'text-red' },
}

/** One editorial finding — Swiss grammar: hairline rule, oversized margin
 *  numeral, claim in producer's voice, evidence visual, lab row, then the
 *  fold: why + fix + prescription + listen buttons (real audio only). */
export default function FindingBlock({ f, num, prio, selected, provenance, rep, player, children }) {
  const { ui, dir } = useLang()
  const sev = SEV[f.sev] || SEV.warn
  const raw = rep?._raw || {}
  const spans = rep ? findingSpans(rep, f.id) : null
  const audio = player?.audio

  // listen buttons — vanilla injectListen, real audio only
  const listens = []
  if (audio) {
    const tri = '▸'
    if (f.id === 'Intro' && raw.intro_sec > 3)
      listens.push({ k: 'seek-intro', label: `${tri} ${ui('lsn_intro')}`, on: false, act: () => player.seekTo(raw.intro_sec) })
    if (['Master', 'Dynamics', 'Clipping', 'Punch'].includes(f.id) && typeof raw.peak_moment_sec === 'number')
      listens.push({ k: 'seek-peak', label: `${tri} ${ui('lsn_peak')}`, on: false, act: () => player.seekTo(Math.max(0, raw.peak_moment_sec - 4)) })
    if (['Mix', 'LowEnd', 'Sibilance'].includes(f.id)) {
      if (spans)
        listens.push({ k: 'loop', label: `${tri} ${ui('lsn_span')(fmt(spans[0][0]), fmt(spans[0][1]))}`,
          on: player.fxOn === 'loop:' + f.id, act: () => player.loopFinding(f.id, spans[0][0], spans[0][1]) })
      const freq = (f.rx && f.rx.freq) || ({ Mix: 250, LowEnd: 80, Sibilance: 6800 })[f.id]
      listens.push({ k: 'band', label: `${tri} ${ui('lsn_band')} · ${freq} Hz`,
        on: player.fxOn === 'band:' + freq, act: () => player.soloBand(freq) })
    }
    if (f.id === 'Stereo')
      listens.push({ k: 'mono', label: `${tri} ${ui('lsn_mono')}`, on: player.fxOn === 'mono', act: () => player.monoToggle() })
  }

  return (
    <article className={`rule-t grid grid-cols-[52px_1fr] gap-x-5 py-7 sm:grid-cols-[76px_1fr] sm:gap-x-7 ${selected ? 'border-t-red' : ''}`}>
      <div className={`val text-[38px] font-normal leading-none sm:text-[46px] ${prio || selected ? 'text-red' : 'text-rule'}`}>
        {num}
      </div>

      <div className="min-w-0">
        <div className="mb-1 flex items-baseline gap-3">
          <span className="text-[12.5px] font-bold">{f.k}</span>
          <span className={`text-[11.5px] font-semibold ${sev.cls}`}>{ui(sev.key)}</span>
          {prio && <span className="text-[11.5px] font-bold text-red">{ui('rk_prio_badge')}</span>}
        </div>

        <h3 className="max-w-[52ch] text-[17.5px] font-semibold leading-snug [text-wrap:balance]"
            dangerouslySetInnerHTML={{ __html: bidiHTML(f.headline, dir) }} />
        {f.why?.[0] && <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-ink2"
            dangerouslySetInnerHTML={{ __html: bidiHTML(f.why[0], dir) }} />}

        {children}

        {/* lab row */}
        {f.measure?.length > 0 && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-7 gap-y-1.5">
            {f.measure.map(([v, label]) => (
              <span key={label} className="text-[12.5px] text-ink2">
                <span className="val text-[13.5px] font-semibold text-ink">{v}</span> {label}
              </span>
            ))}
            {spans && (
              <span className="val text-[12px] text-red">
                {ui('when_lbl')} {spans.map(s => `${fmt(s[0])}–${fmt(s[1])}`).join(', ')}
              </span>
            )}
            <span className="ms-auto">{provenance ?? <Tag kind="measured" />}</span>
          </div>
        )}

        {/* listen row — hear it, not just read it */}
        {listens.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="lbl">{ui('lsn_lbl')}</span>
            {listens.map(b => (
              <button key={b.k} type="button" onClick={e => { e.stopPropagation(); b.act() }}
                      className={`press val border px-2 py-0.5 text-[11.5px] font-semibold transition-colors ${b.on ? 'border-red bg-red text-paper' : 'border-rule text-ink2 hover:border-ink hover:text-ink'}`}>
                {b.label}
              </button>
            ))}
          </div>
        )}

        {(f.why?.length > 1 || f.fix) && (
          <details className="fold mt-3">
            <summary>{ui('rk_why')}</summary>
            <div className="mt-2 max-w-[62ch] border-s border-rule ps-4 text-[13.5px] leading-relaxed text-ink2">
              {f.why?.slice(1).map(w => <p key={w} className="mb-1" dangerouslySetInnerHTML={{ __html: bidiHTML(w, dir) }} />)}
              {f.fix?.daw && <p className="mt-2 font-semibold text-ink" dangerouslySetInnerHTML={{ __html: bidiHTML(ui('rk_what')(f.fix.daw), dir) }} />}
              {f.fix?.suno && (
                <p className="mt-1.5 text-[12.5px]">
                  <span className="font-semibold">Suno</span> — {ui('fx_add')}{' '}
                  <button className="val text-[12px] text-ink2 underline decoration-rule underline-offset-4 hover:text-ink"
                          onClick={e => { navigator.clipboard?.writeText(f.fix.suno); e.target.textContent = `✓ ${ui('copied')}` }}>
                    {f.fix.suno}
                  </button>
                </p>
              )}
              {f.rx && <Prescription rx={f.rx} />}
            </div>
          </details>
        )}
      </div>
    </article>
  )
}
