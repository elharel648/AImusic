import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { UI, UI_EXTRA, LANGS, RTL } from './strings.js'
import { RACK } from './rack.js'

export { LANGS, RTL }
export const LANG_LABELS = { en: 'English', he: 'עברית', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português' }

const LangCtx = createContext(null)

// lookup order: vanilla UI → UI_EXTRA → RACK; English is the fallback per law
function lookup(lang, k) {
  for (const src of [UI, UI_EXTRA, RACK]) {
    const v = src[lang]?.[k]
    if (v !== undefined) return v
  }
  for (const src of [UI, UI_EXTRA, RACK]) {
    const v = src.en?.[k]
    if (v !== undefined) return v
  }
  return k
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('anr_lang')          // same key as web/index.html
    return LANGS.includes(saved) ? saved : 'en'
  })

  useEffect(() => {
    localStorage.setItem('anr_lang', lang)
    document.documentElement.lang = lang
    document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr'
  }, [lang])

  const value = useMemo(() => ({
    lang, setLang,
    dir: RTL.has(lang) ? 'rtl' : 'ltr',
    ui: k => lookup(lang, k),
  }), [lang])

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export function useLang() {
  const ctx = useContext(LangCtx)
  if (!ctx) throw new Error('useLang outside LangProvider')
  return ctx
}

/** Render a UI string that may contain HTML (hero_h, hero_sub, rk_footer…).
 *  Our own copy, never user input — the only sanctioned innerHTML path. */
export function T({ k, args = [], as: Tag = 'span', ...rest }) {
  const { ui } = useLang()
  let v = ui(k)
  if (typeof v === 'function') v = v(...args)
  if (typeof v === 'string' && v.includes('<'))
    return <Tag {...rest} dangerouslySetInnerHTML={{ __html: v }} />
  return <Tag {...rest}>{v}</Tag>
}
