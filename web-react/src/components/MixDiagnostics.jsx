import { useEffect, useRef } from 'react'
import Unit from './Unit.jsx'

/** MIX SPECTRUM — glowing EQ curve from measured tonal bands, mud notch at the measured Hz. */
export default function MixDiagnostics({ bands = [], mudHz = 250, read = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = devicePixelRatio || 1
      cv.width = w * dpr; cv.height = h * dpr
      const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, h)
      const data = bands.length ? bands : defaultCurve()
      const min = Math.min(...data), max = Math.max(...data), span = (max - min) || 1
      const pts = data.map((v, i) => [ (i / (data.length - 1)) * w, h - 8 - ((v - min) / span) * (h - 22) ])
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
        c.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      }
      c.strokeStyle = 'rgba(237,239,242,.75)'; c.lineWidth = 1.6
      c.shadowColor = 'rgba(61,245,166,.5)'; c.shadowBlur = 10; c.stroke()
      if (mudHz) {
        const x = Math.log(mudHz / 30) / Math.log(16000 / 30) * w
        c.shadowColor = 'rgba(255,92,92,.8)'; c.shadowBlur = 12
        c.strokeStyle = 'var(--color-alert)'.startsWith('var') ? '#FF5C5C' : 'var(--color-alert)'
        c.lineWidth = 1.4
        c.beginPath(); c.moveTo(x, 10); c.lineTo(x, h - 6); c.stroke()
      }
    }
    draw()
    addEventListener('resize', draw)
    return () => removeEventListener('resize', draw)
  }, [bands, mudHz])

  return (
    <Unit area="mix" label="Mix · Spectrum" led="var(--color-alert)" read={read}>
      <div className="relative h-24" dir="ltr">
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />
        {mudHz && (
          <span className="digits absolute top-0 text-[9px] tracking-[.1em] text-alert"
                style={{ left: `${Math.log(mudHz / 30) / Math.log(16000 / 30) * 100}%`,
                         transform: 'translateX(-50%)',
                         textShadow: '0 0 10px rgba(255,92,92,.5)' }}>
            {mudHz} Hz
          </span>
        )}
      </div>
    </Unit>
  )
}

function defaultCurve() {
  // plausible long-term spectrum with the 250 Hz bump — used only until real bands arrive
  return Array.from({ length: 24 }, (_, i) => {
    const f = i / 23
    let v = 1 - f * 0.75
    if (i === 5 || i === 6) v += 0.35   // the mud bump
    return v
  })
}
