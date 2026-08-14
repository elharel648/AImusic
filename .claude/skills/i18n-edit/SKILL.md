---
name: i18n-edit
description: The safe way to add or edit user-facing strings — web-react i18n modules (6 languages) and engine i18n.py (7 languages). The most-broken law in this repo when done by hand.
---

# i18n editing law

## Web (web-react/src/i18n/ — langs: en he es fr de pt)
Every user-facing string exists in ALL SIX. Two modules:
- `strings.js` — AUTO-EXTRACTED verbatim from the old vanilla `UI`/`UI_EXTRA`
  objects. Treat as generated: edit values in place only if the same key is
  touched in all 6 language blocks (each lang is one giant line — anchored
  python replaces with `assert count==1` per language).
- `rack.js` — React-born strings (`rk_*` keys). Normal multi-line JS: add the
  key to ALL SIX language objects in one edit. Measured values inside prose use
  the split-key pattern (`rk_xA` + value + `rk_xB`) so numbers stay `.val`
  mono islands in every word order; or a template fn `` k: d => `...${d}...` ``.

Components never hardcode copy — always `ui('key')`; HTML-bearing strings render
via the `<T k="..."/>` helper or `dangerouslySetInnerHTML` (our copy only).
After ANY edit: `node --check` both files, then `npm run build` in `web-react/`.
Verify count parity:
```bash
node -e "import('./src/i18n/rack.js').then(m=>{const n=Object.keys(m.RACK.en).length;
for(const l of ['en','he','es','fr','de','pt']) if(Object.keys(m.RACK[l]).length!==n) throw l})"
```

## Engine (engine/i18n.py — LANGS: en he es fr de pt pt-BR)
Anchored python replaces with `assert count==1`; pt-BR is a partial override
(falls back to pt) — add new keys to the 6 full langs, pt-BR only if the pt
wording doesn't fit Brazil. Verify: `i18n.t(lang, key)` resolves for all LANGS.
