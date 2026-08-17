import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useLang, T, LANGS, LANG_LABELS } from '../i18n/index.jsx'
import { useSession } from '../session.jsx'

const nav = ({ isActive }) =>
  `block px-4 py-2 text-[14px] transition-colors border-s-2 ${
    isActive ? 'border-red font-semibold text-ink' : 'border-transparent font-medium text-ink2 hover:text-ink'}`

/** The studio shell — brand · nav · profile · language · legal · honesty line.
 *  The whole window stays a drop target on every screen (1 file = report,
 *  a pile = shoot-out). Toasts print at the floor. */
export default function Shell() {
  const { lang, setLang, ui } = useLang()
  const { engineUp, routeFiles, busy, toasts, toast, user, setUser, report } = useSession()
  const [modal, setModal] = useState(null)   // 'auth' | 'about' | 'privacy' | 'terms'
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const jump = sec => {
    if (!pathname.endsWith('/report')) navigate('/report')
    setTimeout(() => document.querySelector(`[data-sec="${sec}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  useEffect(() => {
    let depth = 0
    const enter = e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); if (++depth === 1) document.body.dataset.drag = '1' } }
    const over = e => { if (document.body.dataset.drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }
    const leave = () => { if (depth > 0 && --depth === 0) delete document.body.dataset.drag }
    const drop = e => {
      if (!document.body.dataset.drag) return
      e.preventDefault(); depth = 0; delete document.body.dataset.drag
      if (!busy) routeFiles(e.dataTransfer.files)
    }
    addEventListener('dragenter', enter); addEventListener('dragover', over)
    addEventListener('dragleave', leave); addEventListener('drop', drop)
    return () => {
      removeEventListener('dragenter', enter); removeEventListener('dragover', over)
      removeEventListener('dragleave', leave); removeEventListener('drop', drop)
    }
  }, [routeFiles, busy])

  useEffect(() => {
    const onEsc = e => { if (e.key === 'Escape') setModal(null) }
    addEventListener('keydown', onEsc)
    return () => removeEventListener('keydown', onEsc)
  }, [])

  // the PDF prints every fold open (a paper sheet cannot be clicked);
  // afterprint restores exactly the ones we opened
  useEffect(() => {
    let opened = []
    const before = () => {
      opened = [...document.querySelectorAll('details:not([open])')]
      opened.forEach(d => d.setAttribute('open', ''))
    }
    const after = () => { opened.forEach(d => d.removeAttribute('open')); opened = [] }
    addEventListener('beforeprint', before); addEventListener('afterprint', after)
    return () => { removeEventListener('beforeprint', before); removeEventListener('afterprint', after) }
  }, [])

  return (
    <div className="min-h-dvh bg-paper text-ink md:grid md:grid-cols-[218px_1fr]">
      <aside className="border-b border-rule md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:border-b-0 md:border-e">
        <div className="flex items-baseline gap-4 px-5 pb-3 pt-5 md:block md:pb-0">
          <NavLink to="/" className="display block text-[22px] font-bold tracking-tight">A&R·AI</NavLink>
          <span className="lbl md:hidden">{ui('rk_sheet')}</span>
          <div className="dbl-rule mb-4 hidden pb-2.5 md:block">
            <span className="lbl">{ui('rk_sheet')}</span>
          </div>
          <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language"
                  className="ms-auto border border-rule bg-sheet px-1.5 py-1 text-[12px] md:hidden">
            {LANGS.map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
        </div>

        <nav className="flex gap-1 px-1 pb-3 md:block md:space-y-0.5 md:px-0 md:py-4">
          <NavLink to="/" end className={nav}>{ui('rk_nav_analyze')}</NavLink>
          <NavLink to="/report" className={nav}>{ui('rk_nav_report')}</NavLink>
          {/* the document's table of contents — quiet, desktop, only with a report */}
          {report && (
            <div className="hidden md:block">
              {[['verdict', ui('rk2_bottom')], ['priorities', ui('rk2_fixfirst')], ['ref', ui('ref_nav')],
                ['tech', ui('rk2_tech')], ['stream', ui('rk2_release')], ['variation', ui('rk2_variation')]].map(([s, l]) => (
                <button key={s} onClick={() => jump(s)}
                        className="block w-full px-4 py-[3px] text-start text-[11.5px] text-ink2 transition-colors hover:text-ink">
                  {l}
                </button>
              ))}
            </div>
          )}
          <NavLink to="/library" className={nav}>{ui('hist_title')}</NavLink>
        </nav>

        <div className="hidden md:mt-auto md:block md:space-y-3 md:px-5 md:pb-5">
          <button onClick={() => setModal('auth')}
                  className="flex w-full items-center gap-2 text-start text-[12.5px] font-semibold text-ink2 transition-colors hover:text-ink">
            <span className="val grid h-[22px] w-[22px] place-items-center border border-rule text-[11px]">
              {user ? (user.name || 'A').trim()[0].toUpperCase() : '+'}
            </span>
            {user ? user.name : ui('auth_login')}
          </button>
          <span className="flex items-center gap-2 text-[11.5px] font-semibold text-ink2">
            <i className={`inline-block h-[8px] w-[8px] ${engineUp === false ? 'bg-red' : 'led-breathe bg-ok'}`} aria-hidden />
            {ui(engineUp === false ? 'rk_engine_off' : 'rk_engine_live')}
          </span>
          <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language"
                  className="w-full border border-rule bg-sheet px-2 py-1.5 text-[12.5px]">
            {LANGS.map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink2">
            <NavLink to="/show" className="val underline decoration-rule underline-offset-2 hover:text-ink">SHOW</NavLink>
            <NavLink to="/accuracy" className="underline decoration-rule underline-offset-2 hover:text-ink">{ui('rk_acc_title')}</NavLink>
            <button className="underline decoration-rule underline-offset-2 hover:text-ink" onClick={() => setModal('about')}>{ui('ft_about')}</button>
            <button className="underline decoration-rule underline-offset-2 hover:text-ink" onClick={() => setModal('privacy')}>{ui('ft_privacy')}</button>
            <button className="underline decoration-rule underline-offset-2 hover:text-ink" onClick={() => setModal('terms')}>{ui('ft_terms')}</button>
          </p>
          <T k="rk_footer" as="p" className="text-[11px] leading-relaxed text-ink2" />
        </div>
      </aside>

      <main className="min-w-0">
        <Outlet />
      </main>

      {/* modal — auth (local profile) / legal */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[440px] border border-ink bg-paper p-6">
            <button className="val float-end -mt-1 text-[14px] text-ink2 hover:text-ink" aria-label="Close" onClick={() => setModal(null)}>✕</button>
            {modal === 'auth' ? (
              <AuthPane user={user} setUser={setUser} toast={toast} close={() => setModal(null)} />
            ) : (
              <>
                <h3 className="display text-[22px] font-medium">{ui(modal + '_t')}</h3>
                <T k={modal + '_b'} as="div" className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink2 [&_b]:text-ink" />
              </>
            )}
          </div>
        </div>
      )}

      {/* toasts — printed at the floor, never floating glass */}
      <div className="pointer-events-none fixed bottom-4 end-4 z-[60] space-y-2">
        {toasts.map(t => (
          <div key={t.id} role="status"
               className={`border px-4 py-2 text-[13px] font-medium shadow-sm ${t.err ? 'border-red bg-paper text-red' : 'border-ink bg-ink text-paper'}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* drop veil — paper, not glass */}
      <style>{`body[data-drag]::after{content:"${ui('drop_release')}";position:fixed;inset:0;z-index:70;display:grid;place-items:center;
        font-family:var(--font-display);font-size:clamp(44px,8vw,96px);font-weight:500;color:var(--color-ink);
        background:color-mix(in srgb,var(--color-paper) 94%,transparent);outline:2px solid var(--color-ink);outline-offset:-14px}`}</style>
    </div>
  )
}

function AuthPane({ user, setUser, toast, close }) {
  const { ui } = useLang()
  const [name, setName] = useState(user?.name || '')
  const go = () => {
    const n = name.trim(); if (!n) return
    setUser({ name: n, since: user?.since || Date.now() })
    toast(ui('auth_hi')(n)); close()
  }
  return (
    <>
      <h3 className="display text-[22px] font-medium">{ui('auth_title')}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">{ui('auth_sub')}</p>
      <input type="text" maxLength={40} autoComplete="name" value={name} placeholder={ui('auth_ph')}
             onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') go() }}
             className="mt-4 w-full border border-rule bg-sheet px-3 py-2 text-[14px] outline-none focus:border-ink" />
      <div className="mt-4 flex items-center gap-3">
        <button className="btn bg-ink text-paper" onClick={go}>{ui('auth_continue')}</button>
        <button className="text-[12.5px] font-semibold text-ink2 underline decoration-rule underline-offset-4 hover:text-ink"
                onClick={() => { if (user) setUser(null); close() }}>
          {ui(user ? 'auth_out' : 'auth_guest')}
        </button>
      </div>
      <p className="mt-3 text-[11.5px] text-ink2">{ui('auth_note')}</p>
    </>
  )
}
