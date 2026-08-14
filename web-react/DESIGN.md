# LINER NOTES — the A&R AI visual system (web-react)

**The concept:** not a dashboard, not a SaaS app — the typeset measurement sheet a
mastering studio hands a producer. Warm paper, ink, one grease-pencil red, and a single
dark element: the tape strip. Born from a 12-brand live-web research pass
(TE / Ableton / Moog / Elektron / FabFilter / iZotope / sonible / Soundtoys / Baby Audio /
NI / Arturia / B&O) + pro-metering research (Pro-L 2, Tonal Balance Control, Pro-Q, Logic).

## Inks (≤8, never more)
| token | hex | role |
|---|---|---|
| paper | `#F4F1EA` | ground |
| sheet | `#FCFBF7` | (reserve) raised paper |
| ink | `#1B1917` | text, curves, needles in range |
| ink2 | `#6E6961` | secondary text |
| rule | `#D8D2C6` | hairlines — the only structure |
| red | `#C8431D` | grease pencil: attention + interaction + playhead. ONE accent, employed |
| blue | `#33538C` | drafting blue: producer's-read (judgment) ONLY |
| ok | `#3E6B44` | small ✓ flags only |
| tape/bone | `#171512` / `#EDE9E2` | the tape strip — the sheet's one dark element |

## Two voices (Elektron's grammar)
- **Human:** Frank Ruhl Libre (Hebrew serif, display/verdicts) + Heebo (UI prose). Sentence case. No letterspacing on Hebrew.
- **Machine:** IBM Plex Mono — *every measured value*, via `.val` (mono + `direction:ltr` + isolate + tabular). Hebrew prose NEVER goes inside `.val`.
- All fonts self-hosted OFL subsets (`src/assets/fonts/`), ~125KB total.

## Rules (the restriction system)
1. Borders, not shadows. Radius 0–2px. Zero glow, zero glass, zero gradients.
2. Producer speaks before the meter — every figure has a prose figcaption first.
3. Corridor grammar (Tonal Balance / Pro-L 2): reference range = tinted band with printed
   bounds; your value = one 2px needle; out-of-range = red + lab-flag letter (L/H).
4. Claim ↔ evidence adjacency (Pro-Q): the highlighted region's readout sits directly
   under the region and repeats the same numeral as the text claim.
5. Timeline = three lanes (Logic): point flags / energy / chapter regions — from measured
   anchors ONLY (`intro_sec`, `peak_moment_sec`, duration). LTR always; time never mirrors.
6. Provenance is typographic, never a badge: `✓ נמדד` (filled=actual) · `≈ הערכה` ·
   `◇ מודל` · **קריאת מפיק** in serif blue — judgment wears text's clothes, never the ✓.
7. Findings = Swiss editorial blocks: hairline top rule, oversized margin numeral
   (same numeral as the timeline flag), claim → why → evidence → lab row → fold.
8. The 0–100 is a marginal note ("קריאת מפיק · 82/100"), never a centered hero.
9. Motion: ≤200ms opacity/color; the playhead (rAF) is information and survives
   `prefers-reduced-motion`; everything decorative dies there.
10. No fake data — a missing measurement renders as absence, not as an invented metric.
