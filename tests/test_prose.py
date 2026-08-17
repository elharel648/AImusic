"""
The prose harness — the narrative layer is the least-tested, most-read part
of the product, and it CAN be confidently wrong over correct numbers.
These invariants pin prose to measurement across every supported language:

  1. no template leaks: no unfilled {placeholders}, no 'None', no empties
  2. language invariance: finding ids/sevs/scores/measure VALUES identical
     across langs (only words may differ)
  3. the verdict names the weakest finding — in every language
  4. severity follows measurement (quiet master => Master warn; in-corridor
     => good; long intro => warn/crit)
  5. numbers quoted in measure rows match the measurement they claim
  6. the regeneration prompt's fixes reflect actual warn/crit findings
"""
import re
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

from insights import build_insights          # noqa: E402
from server import DEMO_RAW                  # noqa: E402
from i18n import t                           # noqa: E402

LANGS = ["en", "he", "es", "fr", "de", "pt", "pt-BR"]


def _m(**over):
    m = dict(DEMO_RAW)
    m.update(over)
    return m


def _walk_strings(rep):
    """Every user-facing string in a report."""
    out = [rep["verdict"], rep["priority"]]
    for f in rep["findings"]:
        out += [f["k"], f["headline"]] + list(f.get("why") or [])
        for v, label in f.get("measure") or []:
            out += [str(v), str(label)]
        fix = f.get("fix") or {}
        out += [x for x in (fix.get("daw"), fix.get("suno")) if x]
    return out


def test_no_template_leaks_all_langs():
    for lang in LANGS:
        rep = build_insights(_m(), lang)
        for s in _walk_strings(rep):
            assert s and str(s).strip(), (lang, "empty prose string")
            assert "None" not in str(s), (lang, s)
            # an unfilled {placeholder} is prose lying about a measurement
            assert not re.search(r"\{[a-z_]+\}", str(s)), (lang, s)


def test_language_invariance_of_measurements():
    base = build_insights(_m(), "en")
    skeleton = [(f["id"], f["sev"], f["score"],
                 tuple(str(v) for v, _ in f.get("measure") or []))
                for f in base["findings"]]
    for lang in LANGS[1:]:
        rep = build_insights(_m(), lang)
        got = [(f["id"], f["sev"], f["score"],
                tuple(str(v) for v, _ in f.get("measure") or []))
               for f in rep["findings"]]
        assert got == skeleton, (lang, "measured skeleton drifted with language")


def test_verdict_names_the_weakest_finding():
    for lang in LANGS:
        rep = build_insights(_m(), lang)
        weakest = min(rep["findings"], key=lambda f: f["score"])
        assert t(lang, "name_" + weakest["id"]) in rep["verdict"], (
            lang, rep["verdict"], weakest["id"])


def test_severity_follows_the_measurement():
    norms_lo, norms_hi = _m()["norms"]["lufs"]
    quiet = build_insights(_m(lufs=norms_lo - 2.4), "en")
    master = next(f for f in quiet["findings"] if f["id"] == "Master")
    assert master["sev"] in ("warn", "crit")

    fine = build_insights(_m(lufs=(norms_lo + norms_hi) / 2, true_peak_db=-1.2), "en")
    master = next(f for f in fine["findings"] if f["id"] == "Master")
    assert master["sev"] == "good", master

    ilo, ihi = _m()["norms"]["intro_sec"]
    long_intro = build_insights(_m(intro_sec=ihi * 2), "en")
    intro = next(f for f in long_intro["findings"] if f["id"] == "Intro")
    assert intro["sev"] in ("warn", "crit")


def test_quoted_numbers_match_measurements():
    m = _m()
    for lang in LANGS:
        rep = build_insights(m, lang)
        intro = next(f for f in rep["findings"] if f["id"] == "Intro")
        assert f"{m['intro_sec']:.0f}s" == str(intro["measure"][0][0]), lang
        master = next(f for f in rep["findings"] if f["id"] == "Master")
        vals = " ".join(str(v) for v, _ in master["measure"])
        assert str(m["lufs"]) in vals, (lang, vals)


def test_priority_embeds_the_right_numbers():
    m = _m(intro_sec=_m()["norms"]["intro_sec"][1] * 2, lufs=-8.0)
    for lang in LANGS:
        rep = build_insights(m, lang)
        weakest = min(rep["findings"], key=lambda f: f["score"])
        if weakest["id"] == "Intro":
            assert str(int(m["intro_sec"])) in rep["priority"], (lang, rep["priority"])


def test_prompt_fixes_reflect_actual_findings():
    rep = build_insights(_m(), "en")
    warn_ids = {f["id"] for f in rep["findings"] if f["sev"] in ("warn", "crit")}
    fixes = " ".join(rep["prompt"]["fixes"])
    if "Master" in warn_ids:
        assert "master" in fixes.lower()
    if "Mix" in warn_ids:
        assert "mud" in fixes.lower() or "low-mid" in fixes.lower()
    # and never the reverse: no mud claim when the mix is clean
    clean = build_insights(_m(low_mid_ratio=0.10), "en")
    clean_warn = {f["id"] for f in clean["findings"] if f["sev"] in ("warn", "crit")}
    if "Mix" not in clean_warn:
        assert "mud" not in " ".join(clean["prompt"]["fixes"]).lower()
