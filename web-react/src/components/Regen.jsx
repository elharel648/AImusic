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

  const share = async () => {
    try {
      const url = await reportLink(rep)
      await navigator.clipboard.writeText(url)
      toast(ui('toast_link'))
    } catch { downloadCard(rep, name, ui, dir === 'rtl', () => toast(ui('card_dl'))) }
  }

  return (
    <section className="mt-8 text-center" data-sec="regen">
      <p className="mx-auto max-w-[52ch] text-[13.5px] leading-relaxed text-ink2">{ui('regen_p')}</p>
      <input ref={fileRef} type="file" accept="audio/*" hidden
             onChange={e => { const f = e.target.files?.[0]; if (f) compareUpload(f); e.target.value = '' }} />
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <button className="btn bg-ink !px-6 !py-2.5 text-paper hover:bg-ink/85"
                onClick={() => isDemo.current ? compareDemo() : fileRef.current?.click()}>
          {ui('regen_upload')}
        </button>
        <button onClick={share}
                className="text-[13px] font-semibold text-ink2 underline decoration-rule underline-offset-4 transition-colors hover:text-ink">
          {ui('regen_skip')}
        </button>
        <button onClick={() => downloadCard(rep, name, ui, dir === 'rtl', () => toast(ui('card_dl')))}
                className="val text-[12px] font-semibold text-ink2 underline decoration-rule underline-offset-4 transition-colors hover:text-ink">
          PNG
        </button>
      </div>
    </section>
  )
}
