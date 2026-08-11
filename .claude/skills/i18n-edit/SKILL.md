---
name: i18n-edit
description: The safe way to add or edit user-facing strings — web UI object (6 languages) and engine i18n.py (7 languages). The most-broken law in this repo when done by hand.
---

# i18n editing law

## Web (web/index.html — UI object, langs: en he es fr de pt)
Every user-facing string exists in ALL SIX. The lang lines are giant single lines —
edit ONLY via anchored python replaces:
```python
add={ 'unique_anchor_in_lang_X': ' new_key:"value",', ... }   # one per language
for a,n in add.items():
    assert html.count(a)==1, a[:40]     # NEVER replace without count==1
    html=html.replace(a, a+n)
```
Pick anchors that are unique per language (a neighboring key's full value).
Function-valued keys are fine: `key:n=>\`...\``.
After ANY edit: extract `<script>` → `node --check`.

## Engine (engine/i18n.py — LANGS: en he es fr de pt pt-BR)
Same anchored pattern; pt-BR is a partial override (falls back to pt) — add new
keys to the 6 full langs, pt-BR only if the pt wording doesn't fit Brazil.
Verify: `i18n.t(lang, key)` resolves for all LANGS.

## Traps
- `.mono` class forces LTR in Hebrew — numbers/timecodes only, NEVER Hebrew prose.
- `data-i18n` = textContent, `data-i18n-html` = innerHTML (chips/`<b>` need -html).
- Hebrew letter-spacing: mono-caps rules need a `:root[lang="he"]` relaxation.
- Time strings get `dir="ltr"`; timelines never flip in RTL (Material bidi).
