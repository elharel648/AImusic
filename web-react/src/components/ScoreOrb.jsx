import { useEffect, useState } from 'react'

/** THE MASTER SCORE ORB — glass sphere, conic ring, bloom tuned to the read. */
export default function ScoreOrb({ score = 82, genre = 'MELODIC TECHNO', verdict = '', compact = false }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf
    const f = (now) => {
      const p = Math.min(1, (now - t0) / 900)
      setN(Math.round(score * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [score])

  const c = score >= 80 ? 'var(--color-sig)' : score >= 60 ? '#22D3EE' : 'var(--color-alert)'
  const glow = score >= 80 ? 'rgba(61,245,166,.5)' : score >= 60 ? 'rgba(34,211,238,.45)' : 'rgba(255,92,92,.4)'

  return (
    <section className="flex flex-col items-center justify-center gap-7">
      <div
        className={`relative grid place-items-center rounded-full aspect-square ${compact ? 'w-[190px]' : 'w-[min(300px,72vw)]'}`}
        style={{ '--score': n, '--orb-c': c, '--orb-glow': glow }}
      >
        <span
          className="absolute rounded-full -inset-[14%] blur-md"
          style={{ background: `radial-gradient(circle, ${glow.replace('.5', '.16')} 0%, transparent 62%)` }}
        />
        <span className="orb-ring absolute inset-0 rounded-full" />
        <span
          className="hairline-2 absolute inset-[18px] rounded-full glasspanel"
          style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.09), inset 0 -30px 60px -40px ${glow}` }}
        />
        <div className="relative text-center">
          <b className={`digits block font-semibold leading-none ${compact ? 'text-[52px]' : 'text-[clamp(64px,8vw,88px)]'}`}
             style={{ textShadow: `0 0 34px ${glow}` }}>{n}</b>
          <small className="digits mt-2.5 block text-[9px] uppercase tracking-[.3em] text-faint">
            producer's read · 100
          </small>
          <span className="digits hairline mt-2 inline-block rounded-full px-2.5 py-[3px] text-[8.5px] tracking-[.16em] text-dim">
            {genre}
          </span>
        </div>
      </div>
      {!compact && verdict && (
        <p className="max-w-[34ch] text-center text-[15.5px] leading-[1.65] text-dim [text-wrap:balance]">
          {verdict}
        </p>
      )}
    </section>
  )
}
