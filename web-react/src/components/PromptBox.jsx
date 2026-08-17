import { useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { esc } from '../lib/report-utils.js'

// generation platforms: same measured fixes, each platform's dialect.
// artist:false → the platform blocks real artist names in prompts.
export const GEN_PLATFORMS = {
  suno: { name: 'Suno', artist: false },
  udio: { name: 'Udio', artist: false },
  riffusion: { name: 'Riffusion', artist: false, brief: true },
  mureka: { name: 'Mureka', artist: false },
  generic: { name: '', artist: true },
}
export function promptText(rep, plat) {
  const p = rep.prompt, cfg = GEN_PLATFORMS[plat] || GEN_PLATFORMS.suno
  if (!p) return rep.suno_prompt || ''
  const fixes = cfg.brief ? p.fixes.slice(0, 2) : p.fixes
  const moods = cfg.brief ? p.moods.slice(0, 1) : p.moods
  const style = (cfg.artist && p.artist) ? p.artist : p.safe
  return [p.genre, p.bpm + ' bpm', ...fixes, style, ...moods].filter(Boolean).join(', ')
}

/** Paste this into Suno/Udio/… to regenerate — the fixes as a prompt. */
export default function PromptBox({ rep, chips = true }) {
  const { ui } = useLang()
  const { plat, setPlat, toast } = useSession()
  const [copied, setCopied] = useState(false)
  if (!rep.prompt && !rep.suno_prompt) return null
  const text = promptText(rep, plat)
  const html = esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  const title = plat === 'generic' ? ui('suno_paste_any') : ui('suno_paste').replace('{p}', GEN_PLATFORMS[plat].name)
  const copy = () => {
    navigator.clipboard?.writeText(text.replace(/\*\*/g, ''))
    setCopied(true); toast(ui('toast_copied')); setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section className="rule-t py-7" data-sec="prompt">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <span className="lbl">{title}</span>
        <span className="h-px min-w-8 flex-1 bg-rule" aria-hidden />
        <button className="btn !py-1 text-[12px]" onClick={copy}>{copied ? `✓ ${ui('copied')}` : ui('copy')}</button>
      </div>
      <div className={`mb-3 flex-wrap gap-2 ${chips ? 'flex' : 'hidden'}`}>
        {Object.entries(GEN_PLATFORMS).map(([k, c]) => (
          <button key={k} type="button" onClick={() => setPlat(k)}
                  className={`press border px-2 py-0.5 text-[11.5px] transition-colors ${k === plat ? 'border-ink bg-ink text-paper' : 'border-rule text-ink2 hover:border-ink hover:text-ink'}`}>
            {k === 'generic' ? ui('plat_other') : c.name}
          </button>
        ))}
      </div>
      <pre dir="ltr" className="val whitespace-pre-wrap border border-rule bg-sheet p-3 text-[13px] leading-relaxed [&_b]:font-semibold [&_b]:text-red"
           dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )
}
