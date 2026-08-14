import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useLang, T, LANGS, LANG_LABELS } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'

const nav = ({ isActive }) =>
  `block px-4 py-2 text-[13.5px] font-semibold transition-colors border-s-2 ${
    isActive ? 'border-red text-ink' : 'border-transparent text-ink2 hover:text-ink'}`

/** The studio shell — one ruled sidebar (brand · nav · language · honesty line),
 *  the sheet fills the rest. The whole window stays a drop target on every screen. */
export default function Shell() {
  const { lang, setLang, ui } = useLang()
  const { engineUp, report, measure, busy } = useSession()

  useEffect(() => {
    let depth = 0
    const enter = e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); if (++depth === 1) document.body.dataset.drag = '1' } }
    const over = e => { if (document.body.dataset.drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }
    const leave = () => { if (depth > 0 && --depth === 0) delete document.body.dataset.drag }
    const drop = e => {
      if (!document.body.dataset.drag) return
      e.preventDefault(); depth = 0; delete document.body.dataset.drag
      const f = e.dataTransfer.files?.[0]
      if (f && !busy) measure(f)
    }
    addEventListener('dragenter', enter); addEventListener('dragover', over)
    addEventListener('dragleave', leave); addEventListener('drop', drop)
    return () => {
      removeEventListener('dragenter', enter); removeEventListener('dragover', over)
      removeEventListener('dragleave', leave); removeEventListener('drop', drop)
    }
  }, [measure, busy])

  return (
    <div className="min-h-dvh bg-paper text-ink md:grid md:grid-cols-[218px_1fr]">
      <aside className="border-b border-rule md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-e">
        <div className="flex items-baseline gap-4 px-5 pb-3 pt-5 md:block">
          <NavLink to="/" className="display block text-[21px] font-bold tracking-tight">A&R·AI</NavLink>
          <span className="lbl">{ui('rk_sheet')}</span>
          <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language"
                  className="ms-auto border border-rule bg-sheet px-1.5 py-1 text-[12px] md:hidden">
            {LANGS.map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
        </div>

        <nav className="flex gap-1 px-1 pb-3 md:block md:space-y-0.5 md:px-0 md:py-4">
          <NavLink to="/" end className={nav}>{ui('rk_nav_analyze')}</NavLink>
          <NavLink to="/report" className={nav}>
            {ui('rk_nav_report')}{report ? '' : ' ·'}
          </NavLink>
          <NavLink to="/library" className={nav}>{ui('hist_title')}</NavLink>
        </nav>

        <div className="hidden md:absolute md:bottom-0 md:block md:w-full md:space-y-3 md:px-5 md:pb-5">
          <span className="flex items-center gap-2 text-[11.5px] font-semibold text-ink2">
            <i className={`inline-block h-[8px] w-[8px] ${engineUp === false ? 'bg-red' : 'bg-ok'}`} aria-hidden />
            {ui(engineUp === false ? 'rk_engine_off' : 'rk_engine_live')}
          </span>
          <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language"
                  className="w-full border border-rule bg-sheet px-2 py-1.5 text-[12.5px]">
            {LANGS.map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
          <T k="rk_footer" as="p" className="text-[11px] leading-relaxed text-ink2" />
        </div>
      </aside>

      <main className="min-w-0">
        <Outlet />
      </main>

      {/* drop veil — paper, not glass */}
      <style>{`body[data-drag]::after{content:"${ui('drop_release')}";position:fixed;inset:0;z-index:60;display:grid;place-items:center;
        font-family:var(--font-display);font-size:clamp(44px,8vw,96px);font-weight:500;color:var(--color-ink);
        background:color-mix(in srgb,var(--color-paper) 94%,transparent);outline:2px solid var(--color-ink);outline-offset:-14px}`}</style>
    </div>
  )
}
