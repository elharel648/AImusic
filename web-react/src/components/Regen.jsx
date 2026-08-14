import { useRef } from 'react'
import { useLang } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'
import { reportLink, downloadCard } from '../lib/share.js'
import { GEN_PLATFORMS } from './PromptBox.jsx'

/** Now regenerate it — the v2 loop's door. Upload the new version and see
 *  exactly what changed; or share this report (link = the report itself). */
export default function Regen({ rep, name }) {
  const { ui, dir } = useLang()
  const { plat, isDemo, compareUpload, compareDemo, toast } = useSession()
  const fileRef = useRef(null)
  const title = plat === 'generic' ? ui('regen_h_any') : ui('regen_h').replace('{p}', GEN_PLATFORMS[plat].name || 'Suno')

  const share = async () => {
    try {
      const url = await reportLink(rep)
      await navigator.clipboard.writeText(url)
      toast(ui('toast_link'))
    } catch { downloadCard(rep, name, ui, dir === 'rtl', () => toast(ui('card_dl'))) }
  }

  return (
    <section className="rule-t py-8 text-center" data-sec="regen">
      <h3 className="display text-[clamp(20px,3vw,28px)] font-medium">{title}</h3>
      <p className="mx-auto mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-ink2">{ui('regen_p')}</p>
      <input ref={fileRef} type="file" accept="audio/*" hidden
             onChange={e => { const f = e.target.files?.[0]; if (f) compareUpload(f); e.target.value = '' }} />
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button className="btn bg-ink text-paper"
                onClick={() => isDemo.current ? compareDemo() : fileRef.current?.click()}>
          {ui('regen_upload')}
        </button>
        <button className="btn" onClick={share}>{ui('regen_skip')}</button>
        <button className="btn" onClick={() => downloadCard(rep, name, ui, dir === 'rtl', () => toast(ui('card_dl')))}>PNG</button>
      </div>
    </section>
  )
}
