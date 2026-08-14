import { useLang } from '../i18n/index.jsx'

/** Long-term tonal balance — one ink line over a log axis (30 Hz–16 kHz,
 *  the engine's real band edges). The ONE claimed region gets a highlight
 *  column; the curve segment inside it turns grease-red; the readout sits
 *  directly under the column (Pro-Q's selected-band grammar). */
const FMIN = 30, FMAX = 16000
const LOG = Math.log(FMAX / FMIN)
const fx = f => Math.log(f / FMIN) / LOG            // 0..1
const TICKS = [50, 100, 250, 500, 1000, 2000, 5000, 10000]
const tickLabel = f => (f >= 1000 ? `${f / 1000}k` : `${f}`)

export default function SpectrumPlot({ bands = [], mud = null }) {
  const { ui } = useLang()
  if (!bands.length) return null
  const W = 960, H = 210, PAD = 16
  // engine bands: geometric centers of geomspace(30,16000,25)
  const centers = bands.map((_, i) => {
    const e0 = FMIN * Math.pow(FMAX / FMIN, i / bands.length)
    const e1 = FMIN * Math.pow(FMAX / FMIN, (i + 1) / bands.length)
    return Math.sqrt(e0 * e1)
  })
  const vmin = Math.min(...bands), vmax = Math.max(...bands)
  const span = Math.max(vmax - vmin, 1)
  const xy = (f, v) => [fx(f) * W, H - PAD - ((v - vmin) / span) * (H - PAD * 2 - 14)]
  const pts = centers.map((f, i) => xy(f, bands[i]).join(',')).join(' ')

  const m0 = mud ? fx(mud.lo) * W : 0
  const m1 = mud ? fx(mud.hi) * W : 0

  return (
    <figure className="my-4">
      <div dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
             aria-label={ui('rk_sp_aria')}>
          {/* frequency grid — hairlines at real octave anchors */}
          {TICKS.map(f => (
            <g key={f}>
              <line x1={fx(f) * W} x2={fx(f) * W} y1="8" y2={H - 22} stroke="var(--color-rule)" strokeWidth="1" />
              <text x={fx(f) * W} y={H - 8} textAnchor="middle" fontSize="10"
                    fill="var(--color-ink2)" fontFamily="var(--font-mono)">{tickLabel(f)}</text>
            </g>
          ))}
          <text x={W} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-ink2)"
                fontFamily="var(--font-mono)">Hz</text>

          {/* the claimed region — tinted column, hairline edges */}
          {mud && (
            <g>
              <rect x={m0} y="8" width={m1 - m0} height={H - 30} fill="var(--color-red)" opacity=".07" />
              <line x1={m0} x2={m0} y1="8" y2={H - 22} stroke="var(--color-red)" strokeWidth="1" opacity=".45" />
              <line x1={m1} x2={m1} y1="8" y2={H - 22} stroke="var(--color-red)" strokeWidth="1" opacity=".45" />
            </g>
          )}

          {/* your curve — one ink line */}
          <polyline points={pts} fill="none" stroke="var(--color-ink)" strokeWidth="1.8"
                    strokeLinejoin="round" strokeLinecap="round" />
          {/* the segment inside the claim, heavier and red */}
          {mud && (
            <g>
              <clipPath id="mudclip"><rect x={m0} y="0" width={m1 - m0} height={H} /></clipPath>
              <polyline points={pts} fill="none" stroke="var(--color-red)" strokeWidth="3"
                        strokeLinejoin="round" strokeLinecap="round" clipPath="url(#mudclip)" />
            </g>
          )}
        </svg>

        {/* readout directly under the column */}
        {mud && (
          <div className="relative h-[18px]">
            <span className="val absolute -translate-x-1/2 whitespace-nowrap text-[11.5px] font-semibold text-red"
                  style={{ left: `${((m0 + m1) / 2 / W) * 100}%` }}>
              {mud.label}
            </span>
          </div>
        )}
      </div>
      <figcaption className="mt-1 text-[11.5px] text-ink2">
        {ui('rk_sp_note')}
      </figcaption>
    </figure>
  )
}
