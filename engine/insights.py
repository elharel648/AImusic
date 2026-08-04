"""
Insight layer — turns raw measurements into A&R-style human findings.

Every finding is GROUNDED in a real measurement (green tier). We never invent
a "commercial potential" number. Each finding carries:
  k (localized label), score (0-100), sev (good/warn/crit),
  headline, why[], measure[], and (for problems) fix{daw, suno}.

All human strings come from i18n.t(lang, ...) so the whole report can be
produced in any supported language. Also builds the opening verdict, the
single top priority, and a Suno prompt derived from the actual problems.
"""
from __future__ import annotations
import math

from i18n import t


def _fmt_time(sec: float) -> str:
    m, s = divmod(int(round(sec)), 60)
    return f"{m}:{s:02d}"


def _score_range(value, lo, hi, span_below, span_above):
    if lo <= value <= hi:
        return 100
    if value < lo:
        return max(0, int(100 - (lo - value) / span_below * 100))
    return max(0, int(100 - (value - hi) / span_above * 100))


def build_insights(m: dict, lang: str = "en") -> dict:
    norms = m["norms"]
    findings = []
    L = lambda _s, **v: t(lang, _s, **v)         # shorthand

    # ── Intro ──
    intro = m["intro_sec"]
    lo, hi = norms["intro_sec"]
    # Provenance line: intro norms are measured from full-length tracks
    # (Jamendo corpus) — say so, and say nothing when still curated.
    intro_corpus = ([L("why_intro_corpus", n=norms["n_fma"])]
                    if norms.get("n_fma") else [])
    intro_score = _score_range(intro, lo, hi, span_below=lo or 1, span_above=hi)
    if intro > hi:
        sev = "crit" if intro > hi * 1.7 else "warn"
        over = round(intro - (lo + hi) / 2)
        findings.append({
            "id": "Intro", "k": L("label_Intro"), "score": intro_score, "sev": sev,
            "headline": L("intro_bad_head", n=int(intro), over=over, lo=lo, hi=hi),
            "why": [L("intro_bad_why1", n=int(intro), lo=lo, hi=hi), L("intro_bad_why2"), L("intro_bad_why3")] + intro_corpus,
            "measure": [[f"{intro:.0f}s", L("ml_your_intro")], [f"{lo}-{hi}s", L("ml_genre_range")]],
            "fix": {"daw": L("intro_fix_daw", hi=hi), "suno": L("intro_fix_suno", hi=hi)},
        })
    else:
        findings.append({
            "id": "Intro", "k": L("label_Intro"), "score": max(88, intro_score), "sev": "good",
            "headline": L("intro_good_head", n=int(intro)),
            "why": [L("intro_good_why1", t=_fmt_time(intro), lo=lo, hi=hi)] + intro_corpus,
            "measure": [[f"{intro:.0f}s", L("ml_your_intro")], [f"{lo}-{hi}s", L("ml_genre_range")]],
        })

    # ── Loudness / master ──
    lufs = m["lufs"]
    llo, lhi = norms["lufs"]
    lufs_score = _score_range(lufs, llo, lhi, span_below=6, span_above=3)
    if lufs < llo:
        findings.append({
            "id": "Master", "k": L("label_Master"), "score": lufs_score, "sev": "warn",
            "headline": L("master_bad_head", lufs=lufs),
            "why": [L("master_bad_why1", llo=llo, lhi=lhi), L("master_bad_why2", lufs=lufs)]
                   + ([L("why_hits", n=norms["n_hits"])] if norms.get("n_hits") else [L("master_bad_why3")]),
            "measure": [[f"{lufs}", L("ml_your_lufs")], [f"{llo}", L("ml_target")], [f"{m['true_peak_db']} dB", L("ml_true_peak")]]
                       + ([[f"{m['lra']} LU", L("ml_lra")]] if m.get("lra") is not None else []),
            "fix": {"daw": L("master_fix_daw", llo=llo), "suno": L("master_fix_suno")},
            "rx": {"type": "limiter", "gain_db": round(llo - lufs, 1),
                   "ceiling_db": -1.0, "target_lufs": llo, "conf": "high"},
        })
    else:
        findings.append({
            "id": "Master", "k": L("label_Master"), "score": lufs_score, "sev": "good",
            "headline": L("master_good_head", lufs=lufs),
            "why": [L("master_good_why1")] + ([L("why_hits", n=norms["n_hits"])] if norms.get("n_hits") else []),
            "measure": [[f"{lufs}", L("ml_lufs")], [f"{m['true_peak_db']} dB", L("ml_true_peak")]]
                       + ([[f"{m['lra']} LU", L("ml_lra")]] if m.get("lra") is not None else []),
        })

    # ── Clipping ──
    if m["clipping"]:
        findings.append({
            "id": "Clipping", "k": L("label_Clipping"), "score": 30, "sev": "crit",
            "headline": L("clip_head"), "why": [L("clip_why1"), L("clip_why2")],
            "measure": [[f"{m['true_peak_db']} dB", L("ml_true_peak")]],
            "fix": {"daw": L("clip_fix_daw"), "suno": L("clip_fix_suno")},
            "rx": {"type": "clip", "trim_db": -1.0, "ceiling_db": -1.0, "conf": "high"},
        })

    # ── Low-mid mud ──
    mud = m["low_mid_ratio"]
    if mud > 0.35:
        findings.append({
            "id": "Mix", "k": L("label_Mix"), "score": max(40, int(100 - (mud - 0.35) * 200)), "sev": "warn",
            "headline": L("mix_head"),
            "why": [L("mix_why1", mud=int(mud * 100)), L("mix_why2"), L("mix_why3")],
            "measure": [[f"{int(mud*100)}%", L("ml_energy")]],
            "fix": {"daw": L("mix_fix_daw"), "suno": L("mix_fix_suno")},
            # prescription: cut derived from the measured band excess (never a
            # made-up number) — clamped to a sane starting range
            "rx": {"type": "eq_cut", "freq": m.get("mud_peak_hz", 250),
                   "gain_db": -max(1.5, min(4.0, round(10 * math.log10(mud / 0.35) * 2, 1))),
                   "q": 1.2, "conf": "high"},
        })

    # ── Dynamics ──
    dr = m["dynamic_range_db"]
    if dr < 4:
        findings.append({
            "id": "Dynamics", "k": L("label_Dynamics"), "score": max(35, int(dr / 4 * 100)), "sev": "warn",
            "headline": L("dyn_head"), "why": [L("dyn_why1", dr=dr), L("dyn_why2")],
            "measure": [[f"{dr} dB", L("ml_dyn_range")]],
            "fix": {"daw": L("dyn_fix_daw"), "suno": L("dyn_fix_suno")},
            "rx": {"type": "decompress", "dr_db": dr, "target_dr": 6, "conf": "med"},
        })

    # ── Stereo ──
    if not m["is_mono"] and m["stereo_width"] < 0.15:
        w = m["stereo_width"]
        findings.append({
            "id": "Stereo", "k": L("label_Stereo"), "score": 55, "sev": "warn",
            "headline": L("stereo_head"), "why": [L("stereo_why1")],
            "measure": [[f"{w}", L("ml_width")]],
            "fix": {"daw": L("stereo_fix_daw"), "suno": L("stereo_fix_suno")},
            "rx": {"type": "widen", "width": w, "conf": "med"},
        })

    # ── Kick-bass masking (conservative: flag only clear cases) ──
    kb = m.get("kick_bass_overlap", 0)
    if kb >= 0.8:
        findings.append({
            "id": "LowEnd", "k": L("label_LowEnd"), "score": max(45, int(100 - (kb - 0.8) * 250)), "sev": "warn",
            "headline": L("lowend_head", hz=m.get("bass_peak_hz", 60)),
            "why": [L("lowend_why1", pct=int(kb * 100)), L("lowend_why2")],
            "measure": [[f"{int(kb*100)}%", L("ml_overlap")], [f"{m.get('bass_peak_hz', 60)} Hz", L("ml_bass_peak")]],
            "fix": {"daw": L("lowend_fix_daw", hz=m.get("bass_peak_hz", 60)), "suno": L("lowend_fix_suno")},
            "rx": {"type": "sidechain", "freq": m.get("bass_peak_hz", 60), "conf": "med"},
        })

    # ── Transient punch ──
    ts = m.get("transient_strength", 0.5)
    if ts < 0.25:
        findings.append({
            "id": "Punch", "k": L("label_Punch"), "score": max(40, int(ts * 240)), "sev": "warn",
            "headline": L("punch_head"),
            "why": [L("punch_why1", ts=int(ts * 100)), L("punch_why2")],
            "measure": [[f"{int(ts*100)}/100", L("ml_punch")]],
            "fix": {"daw": L("punch_fix_daw"), "suno": L("punch_fix_suno")},
            "rx": {"type": "transient", "conf": "med"},
        })

    # ── Tonal balance vs the genre curve (only with a real corpus curve) ──
    tw = _tonal_worst(m)
    if tw and abs(tw["dev"]) >= 4 and not (
            180 <= tw["freq"] <= 380 and m.get("low_mid_ratio", 0) > 0.35):
        # the 200-350 Hz mud territory already has its own finding — never
        # flag the same dB twice
        rec = round(max(1.5, min(4.0, abs(tw["dev"]) * 0.6)), 1)
        hz, region = _fmt_hz(tw["freq"]), L("tb_r_" + tw["region"])
        snippet = _TONAL_SNIPPET[(tw["region"], tw["dir"])]
        findings.append({
            "id": "Tonal", "k": L("label_Tonal"),
            "score": max(35, int(100 - abs(tw["dev"]) * 7)), "sev": "warn",
            "headline": L("tb_head_" + tw["dir"], db=abs(tw["dev"]), f=hz, region=region),
            "why": [L("tb_why_" + tw["dir"]),
                    L("tb_why_corpus", n=tw["n"], family=tw["family"])],
            "measure": [[f"{'+' if tw['dev']>0 else '−'}{abs(tw['dev'])} dB", L("ml_vs_genre")],
                        [hz, region]],
            "fix": {"daw": L("tb_fix_daw_" + tw["dir"], db=rec, f=hz), "suno": snippet},
            **({"rx": {"type": "eq_cut", "freq": int(tw["freq"]), "gain_db": -rec,
                       "q": 1.0, "conf": "med"}} if tw["dir"] == "hi" else {}),
        })

    # ── Sibilance (only when the ML layer actually hears vocals) ──
    # stem_level: measured on the Demucs-isolated vocal, not the full mix —
    # the prescription is no longer a proxy, so its confidence rises to high.
    # Vocals are "heard" when the classifier is confident OR the Demucs stem
    # proved them directly (stem evidence beats the classifier — processed EDM
    # vocals can score as low as 0.43 on tracks with prominent singing).
    stem_vocals = bool(m.get("stem_level")) and not m.get("vocal_stem_silent")
    sib = m.get("sibilance_ratio", 0)
    if (m.get("ml_voice_prob", 0) > 0.6 or stem_vocals) and sib > 0.10:
        stem = bool(m.get("stem_level"))
        findings.append({
            "id": "Sibilance", "k": L("label_Sibilance"), "score": max(45, int(100 - (sib - 0.10) * 400)), "sev": "warn",
            "headline": L("sib_head"),
            "why": [L("sib_why1", pct=round(sib * 100, 1)), L("sib_why2")]
                   + ([L("sib_why_stem")] if stem else []),
            "measure": [[f"{round(sib*100,1)}%", L("ml_sib")]],
            "fix": {"daw": L("sib_fix_daw"), "suno": L("sib_fix_suno")},
            "rx": {"type": "deess", "freq": 7000, "conf": "high" if stem else "med"},
        })

    # ── Vocal performance (deep mode only: measured on the Demucs-isolated
    #    vocal, never guessed from the mix) ──
    # Balance range (-12..+1 dB vocal-vs-accompaniment where the vocal is
    # active) and intonation bars (35/15 cents) are curated engineering
    # judgment, not corpus-measured — the measured value is always shown so
    # the reader can disagree with the bar, not with the number.
    if stem_vocals:
        bal = m.get("vocal_mix_db")
        dev = m.get("pitch_dev_cents")
        vdyn = m.get("vocal_dyn_db")
        tuned = (dev is not None and dev <= 5
                 and m.get("pitch_within_10c", 0) >= 0.85)
        # Extreme quantization: essentially zero deviation on essentially every
        # frame. Human singing — even well-tuned — keeps a few cents of drift;
        # this is the "autotune is doing all the work" signature.
        hardtune = (dev is not None and dev <= 2
                    and m.get("pitch_within_10c", 0) >= 0.98)
        vocal_measure = ([[f"{bal} dB", L("ml_voc_bal")]] if bal is not None else []) \
            + ([[f"{dev}¢", L("ml_voc_dev")]] if dev is not None else []) \
            + ([[f"{vdyn} dB", L("ml_voc_dyn")]] if vdyn is not None else []) \
            + ([[f"{m['voiced_sec']}s", L("ml_voc_voiced")]] if m.get("voiced_sec") else [])
        if bal is not None and bal < -12:
            findings.append({
                "id": "Vocal", "k": L("label_Vocal"),
                "score": max(40, int(100 + (bal + 12) * 6)), "sev": "warn",
                "headline": L("voc_buried_head", db=abs(bal)),
                "why": [L("voc_buried_why1"), L("voc_stem_why")],
                "measure": vocal_measure,
                "fix": {"daw": L("voc_buried_fix_daw"), "suno": L("voc_buried_fix_suno")},
            })
        elif dev is not None and dev > 35:
            findings.append({
                "id": "Vocal", "k": L("label_Vocal"),
                "score": max(35, int(100 - (dev - 35))), "sev": "crit" if dev > 50 else "warn",
                "headline": L("voc_pitch_head", cents=int(dev)),
                "why": [L("voc_pitch_why1", cents=int(dev)), L("voc_stem_why")],
                "measure": vocal_measure,
                "fix": {"daw": L("voc_pitch_fix_daw"), "suno": L("voc_pitch_fix_suno")},
            })
        elif hardtune:
            findings.append({
                "id": "Vocal", "k": L("label_Vocal"), "score": 72, "sev": "warn",
                "headline": L("voc_hardtune_head", cents=dev),
                "why": [L("voc_hardtune_why1", cents=dev,
                           pct=int(m.get("pitch_within_10c", 0) * 100)),
                        L("voc_hardtune_why2"), L("voc_stem_why")],
                "measure": vocal_measure,
                "fix": {"daw": L("voc_hardtune_fix_daw"), "suno": L("voc_hardtune_fix_suno")},
            })
        elif vdyn is not None and vdyn < 4:
            findings.append({
                "id": "Vocal", "k": L("label_Vocal"),
                "score": max(50, 90 - int((4 - vdyn) * 10)), "sev": "warn",
                "headline": L("voc_flat_head"),
                "why": [L("voc_flat_why1", db=vdyn), L("voc_flat_why2"), L("voc_stem_why")],
                "measure": vocal_measure,
                "fix": {"daw": L("voc_flat_fix_daw"), "suno": L("voc_flat_fix_suno")},
            })
        elif vocal_measure:
            findings.append({
                "id": "Vocal", "k": L("label_Vocal"), "score": 90, "sev": "good",
                "headline": L("voc_tuned_head") if tuned else L("voc_good_head"),
                "why": [L("voc_tuned_why")] if tuned else [L("voc_good_why"), L("voc_stem_why")],
                "measure": vocal_measure,
            })

    # ── Tempo / key (positive anchor) ──
    blo, bhi = norms["bpm"]
    bpm_ok = blo <= m["bpm"] <= bhi
    # key_confidence is CALIBRATED (measured exact-match rate on GiantSteps
    # ground truth at this margin) — when the detector is genuinely unsure it
    # names the runner-up instead of asserting one key with false authority.
    key_disp = (L("key_or", key=m["key"], alt=m["key_alt"])
                if m.get("key_alt") else m["key"])
    findings.append({
        "id": "Tempo", "k": L("label_Tempo"), "score": 95 if bpm_ok else 70, "sev": "good" if bpm_ok else "warn",
        "headline": L("tempo_head_ok" if bpm_ok else "tempo_head_off", bpm=m["bpm"], key=key_disp),
        "why": [L("tempo_why1", blo=blo, bhi=bhi)]
               + ([L("why_hits", n=norms["n_hits"])] if norms.get("n_hits") else []),
        "measure": [[f"{m['bpm']}", L("ml_bpm")], [m["key"], L("ml_key")]]
                   + ([[m["key_alt"], L("ml_key_alt")]] if m.get("key_alt") else [])
                   + ([[f"{int(m['key_confidence']*100)}%", L("ml_key_conf")]] if m.get("key_confidence") else []),
    })

    # ── overall + verdict + priority (computed BEFORE the informational
    #    Character finding, which must not drag the score) ──
    overall = int(round(sum(f["score"] for f in findings) / len(findings)))
    weakest = min(findings, key=lambda f: f["score"])

    # ── Character (ML): detected genre + vocals + danceability ──
    if m.get("ml_genre_pretty"):
        conf = int(m.get("ml_genre_confidence", 0) * 100)
        dance = int(m.get("ml_danceability", 0) * 100)
        voc = int(m.get("ml_voice_prob", 0) * 100)
        head_key = "char_head_instr" if m.get("ml_is_instrumental") else "char_head_vocal"
        findings.append({
            "id": "Character", "k": L("label_Character"), "score": conf, "sev": "good",
            "headline": L(head_key, genre=m["ml_genre_pretty"]),
            "why": [L("char_why_conf", conf=conf), L("char_why_dance", dance=dance), L("char_why_model")],
            "measure": [[m["ml_genre_pretty"], L("ml_genre")], [f"{voc}%", L("ml_voice")], [f"{dance}%", L("ml_dance")]],
        })
    head = L("verdict_strong") if overall >= 80 else L("verdict_solid") if overall >= 60 else L("verdict_needs")
    verdict = head + L("verdict_weakest", k=L("name_" + weakest["id"]))
    priority = _priority(lang, weakest, m, L)
    prompt = _prompt_parts(m, findings)
    ai = _ai_signals(lang, m, L)

    return {
        "meta": {"duration": _fmt_time(m["duration_sec"]), "genre": m.get("ml_genre_pretty") or m["genre_assumed"], "bpm": m["bpm"], "key": m["key"]},
        "overall": overall,
        "verdict": verdict,
        "priority": priority,
        "findings": sorted(findings, key=lambda f: (f["id"] == "Character", f["score"])),
        "ai_signals": ai,
        "streaming": _streaming(lang, m, L),
        "tonal": _tonal(lang, m, L),
        "prompt": prompt,
        "suno_prompt": render_prompt(prompt),
    }


# Friendly names for where a tonal deviation lives; keys are i18n suffixes.
_TONAL_REGIONS = [(60, "sub"), (250, "bass"), (500, "lowmid"),
                  (2000, "mid"), (6000, "presence"), (99999, "air")]

# English prompt snippets per (region, direction) — prompts are always English.
_TONAL_SNIPPET = {
    ("sub", "hi"): "tight, controlled sub bass",   ("sub", "lo"): "deep powerful sub bass",
    ("bass", "hi"): "tighter, less boomy bass",    ("bass", "lo"): "fuller, warmer bass",
    ("lowmid", "hi"): "clean low-mids, no mud",    ("lowmid", "lo"): "warm, full-bodied mix",
    ("mid", "hi"): "less boxy midrange",           ("mid", "lo"): "fuller midrange",
    ("presence", "hi"): "smooth, non-harsh highs", ("presence", "lo"): "crisp presence and bite",
    ("air", "hi"): "smooth, rounded top end",      ("air", "lo"): "bright, airy top end",
}


def _fmt_hz(f):
    return f"{f/1000:.1f}".rstrip("0").rstrip(".") + " kHz" if f >= 1000 else f"{int(f)} Hz"


def _tonal_worst(m):
    """Worst deviation of the track's tonal curve OUTSIDE the genre's quartile
    band (with 1.5 dB of grace). None when there's no corpus curve or the
    curve stays inside. Shared by the panel readout, the finding, and the
    regeneration prompt so all three always tell the same story."""
    bands = m.get("tonal_bands")
    tn = (m.get("norms") or {}).get("tonal")
    if not bands or not tn or len(bands) != len(tn.get("p50", [])):
        return None
    worst_i, worst_dev = -1, 0.0
    for i, v in enumerate(bands):
        dev = (v - (tn["p75"][i] + 1.5)) if v > tn["p75"][i] + 1.5 else \
              (v - (tn["p25"][i] - 1.5)) if v < tn["p25"][i] - 1.5 else 0.0
        if abs(dev) > abs(worst_dev):
            worst_i, worst_dev = i, dev
    if worst_i < 0:
        return None
    f = tn["freqs"][worst_i]
    region = next(name for top, name in _TONAL_REGIONS if f < top)
    return {"freq": f, "dev": round(worst_dev, 1), "region": region,
            "dir": "hi" if worst_dev > 0 else "lo",
            "n": tn.get("n"), "family": tn.get("family", "")}


def _tonal(lang, m, L):
    """Tonal balance vs the genre's measured quartile band. Returns None until
    the corpus curve for this genre family exists — the panel simply doesn't
    render, we never show a made-up target."""
    bands = m.get("tonal_bands")
    tn = (m.get("norms") or {}).get("tonal")
    if not bands or not tn or len(bands) != len(tn.get("p50", [])):
        return None
    w = _tonal_worst(m)
    if not w:
        readout = {"sev": "good", "text": L("tb_ok")}
    else:
        readout = {"sev": "warn" if abs(w["dev"]) >= 3 else "good",
                   "text": L("tb_hi" if w["dir"] == "hi" else "tb_lo",
                             db=abs(w["dev"]), f=_fmt_hz(w["freq"]),
                             region=L("tb_r_" + w["region"]))}
    return {"bands": bands, "freqs": tn["freqs"],
            "genre": {"p25": tn["p25"], "p50": tn["p50"], "p75": tn["p75"],
                      "n": tn.get("n"), "family": tn.get("family", "")},
            "readout": readout,
            "note": L("tb_note", n=tn.get("n"), family=tn.get("family", ""))}


# Published normalization targets (verified July 2026). boost=True means the
# platform also raises quiet tracks (Spotify with limiter, Apple Sound Check);
# boost=False platforms only turn loud tracks down — a quiet master stays quiet.
_PLATFORMS = [
    ("Spotify",      -14.0, True),
    ("Apple Music",  -16.0, True),
    ("YouTube",      -14.0, False),
    ("Amazon Music", -14.0, False),
    ("TIDAL",        -14.0, False),
    ("Deezer",       -15.0, False),
]


def _streaming(lang, m, L):
    """Streaming-readiness: how this exact master behaves after each platform's
    loudness normalization, plus hard delivery checks. Pure measurement vs
    published specs — no 'will pass distribution' promises."""
    lufs = m["lufs"]
    platforms, quiet = [], []
    for name, target, boosts in _PLATFORMS:
        delta = round(lufs - target, 1)
        if delta > 0.5:            # louder than target: platform turns it down
            row = {"name": name, "target": target, "mode": "down", "delta": -delta}
        elif delta < -0.5 and boosts:
            row = {"name": name, "target": target, "mode": "boost", "delta": abs(delta)}
        elif delta < -0.5:         # quiet + platform never boosts: plays weak
            row = {"name": name, "target": target, "mode": "quiet", "delta": 0.0,
                   "gap": abs(delta)}
            quiet.append(abs(delta))
        else:
            row = {"name": name, "target": target, "mode": "asis", "delta": 0.0}
        platforms.append(row)

    # bool() everywhere: numpy booleans are not JSON-serializable
    tp_ok = bool(m["true_peak_db"] <= -1.0)
    clip = bool(m["clipping"])
    dur_ok = bool(m["duration_sec"] >= 30)
    checks = [
        {"t": L("ml_true_peak"), "v": f"{m['true_peak_db']} dBTP", "ok": tp_ok,
         "d": L("st_tp_ok") if tp_ok else L("st_tp_bad")},
        {"t": L("label_Clipping"), "v": L("st_yes") if clip else L("st_no"),
         "ok": not clip,
         "d": L("st_clip_bad") if clip else L("st_clip_ok")},
        {"t": L("st_dur"), "v": _fmt_time(m["duration_sec"]), "ok": dur_ok,
         "d": L("st_dur_ok") if dur_ok else L("st_dur_bad")},
    ]
    # Measured, not predicted: we ran the actual AAC encoder on this master
    # (analyze.measure_codec_impact) and re-measured the decoded true peak.
    if m.get("codec_peak_db") is not None:
        codec_ok = not m.get("codec_clips")
        checks.insert(1, {"t": L("st_codec"), "v": f"{m['codec_peak_db']} dBTP",
                          "ok": codec_ok,
                          "d": L("st_codec_ok") if codec_ok else L("st_codec_bad")})

    if quiet:
        level = "crit" if max(quiet) >= 4 else "warn"
        headline = L("st_head_quiet", n=len(quiet), d=max(quiet))
    elif not tp_ok or clip or m.get("codec_clips"):
        level = "warn"
        headline = L("st_head_peak")
    else:
        level = "good"
        headline = L("st_head_ok")
    return {"level": level, "headline": headline, "platforms": platforms,
            "checks": checks, "note": L("st_note")}


def _ai_signals(lang, m, L):
    """Report acoustic signals often linked to AI production — as SIGNALS, never a fake %.
    Each detected tell carries a short label + a plain explanation."""
    # Calibration against both corpora (norms_data.json, July 2026): of the four
    # candidate tells, only spectral_uniformity actually separates AI from human —
    # AI (sonics_suno_udio, n=10k) median 0.96 vs full-length human (jamendo,
    # n=1577) p99 0.94. The other three measured indistinguishable distributions
    # (section_repetition: both medians 0.98 — it tracks "stays in one key", not
    # copy-paste; timing_rigidity: AI p95 0.37, so grid-tight onsets mark
    # quantized HUMAN productions, not AI; dynamic_range: AI p05 5.9 vs human
    # p05 5.2 — under 3.1 dB mostly catches brickwalled commercial masters).
    # Those three no longer fire: flagging a human artist as AI is the worst
    # failure mode, and on the corpora they flagged mostly humans.
    from analyze import _MEASURED
    hbf = _MEASURED.get("human_baseline_full") or {}

    def human_pct(k, v, lower_is_extreme=False):
        """% of full-length human tracks less extreme than v (None if no corpus).
        Interpolated from measured 5th-percentile steps; >p95 leans on p99."""
        q = hbf.get("quantiles") or {}
        vals, qs = q.get(k), q.get("q")
        if not vals or v is None:
            return None
        pairs = list(zip(vals, qs))
        if lower_is_extreme:
            pairs = [(-a, 100 - b) for a, b in reversed(pairs)]
            v = -v
        p = None
        if v < pairs[0][0]:
            p = 1
        elif v >= pairs[-1][0]:
            p99 = (hbf.get(k) or {}).get("p99")
            if not lower_is_extreme and p99 is not None and p99 > pairs[-1][0]:
                p = 95 + 4 * min(1.0, (v - pairs[-1][0]) / (p99 - pairs[-1][0]))
                p = 99 if v >= p99 else p
            else:
                p = 95
        else:
            for (a, pa), (b, pb) in zip(pairs, pairs[1:]):
                if a <= v <= b:
                    p = pa + (pb - pa) * ((v - a) / (b - a) if b > a else 1.0)
                    break
        return max(1, min(99, int(round(p))))

    # The tell fires only if BOTH the threshold is crossed AND the track is more
    # extreme than >=90% of full-length human music (when we have the corpus) —
    # a percentile gate that keeps a stale or clip-derived threshold from
    # flagging humans.
    tells = []
    su = m.get("spectral_uniformity", 0)
    if su >= 0.96:
        pct = human_pct("spectral_uniformity", su)
        if pct is None or pct >= 90:
            d = L("ai_uniform_d")
            if pct is not None:      # place the track against real humans
                d = f"{d} {L('ai_pct_note', pct=pct)}"
            tells.append({"t": L("ai_uniform"), "d": d, "pct": pct})

    n = len(tells)
    if n == 0:
        headline = L("ai_none")
        level = "good"
    elif n <= 1:
        headline = L("ai_few")
        level = "warn"
    else:
        headline = L("ai_many", n=n)
        level = "crit"
    n_h = hbf.get("n")
    sep = {"es": ".", "de": ".", "pt": ".", "fr": " "}.get(lang, ",")
    n_txt = f"{n_h:,}".replace(",", sep) if n_h else "8,000"
    return {"count": n, "level": level, "headline": headline, "tells": tells,
            "note": L("ai_note", n=n_txt),
            "benchmark": ({"n": n_h, "source": hbf.get("source")} if n_h else None)}


def _priority(lang, weakest, m, L):
    wid = weakest["id"]
    if wid == "Intro":
        lo, hi = m["norms"]["intro_sec"]
        return L("prio_intro", n=int(m["intro_sec"]), over=round(m["intro_sec"] - (lo + hi) / 2), hi=hi)
    if wid == "Master":
        return L("prio_master", lufs=m["lufs"], llo=m["norms"]["lufs"][0])
    if wid == "Mix":
        return L("prio_mix")
    # Everything else: build the line from the finding itself — its headline
    # and DAW fix are already specific, measured and translated. The
    # "work on {k} first — it's the weakest link" template read as canned
    # boilerplate by the second report.
    fix = (weakest.get("fix") or {}).get("daw")
    if fix:
        return f"{weakest['headline']} {fix}"
    return L("prio_generic", k=L("name_" + wid))


# Genre-appropriate style anchors for the regeneration prompt — the reference an
# A&R would actually name for that genre (Afterlife means nothing to a pop track).
# "artist" is the name-drop version; most generation platforms (Suno, Udio) block
# real artist names in prompts, so "safe" is the descriptive equivalent used there.
_GENRE_STYLE = {
    "melodic techno": {"artist": "Afterlife / Anyma style", "safe": "dark cinematic melodic techno, hypnotic arps", "moods": ["cinematic", "emotional"]},
    "house":          {"artist": None, "safe": "classic house groove", "moods": ["warm analog feel", "dancefloor-ready"]},
    "pop":            {"artist": None, "safe": "modern radio pop", "moods": ["polished vocal production", "catchy"]},
    "hip-hop":        {"artist": None, "safe": "modern hip-hop", "moods": ["hard-hitting 808s", "clean vocal mix"]},
    "edm":            {"artist": None, "safe": "festival EDM", "moods": ["big-room energy", "massive drop"]},
    "rock":           {"artist": None, "safe": "modern rock production", "moods": ["live drum feel", "guitar-driven"]},
    "lo-fi":          {"artist": None, "safe": "lo-fi chill", "moods": ["warm tape saturation", "relaxed groove"]},
    "default":        {"artist": None, "safe": "polished modern production", "moods": ["emotional"]},
}


def _prompt_parts(m, findings):
    """Structured regeneration prompt (always English — every platform's native
    prompt language) — derived from real problems. The client renders it per
    generation platform (Suno / Udio / Riffusion / Mureka / other)."""
    fixes = []
    fix_ids = {f["id"] for f in findings if f["sev"] in ("warn", "crit")}
    if "Intro" in fix_ids:
        fixes.append(f"**short {m['norms']['intro_sec'][1]}-second intro, get to the hook fast**")
    if "Master" in fix_ids:
        fixes.append("**louder, punchy modern master**")
    if "Mix" in fix_ids:
        fixes.append("**clean low-mids, no 250 Hz mud**")
    if "Dynamics" in fix_ids:
        fixes.append("**dynamic, less compressed**")
    if "Stereo" in fix_ids:
        fixes.append("**wide stereo pads**")
    if "Tonal" in fix_ids:
        tw = _tonal_worst(m)
        if tw:
            fixes.append(f"**{_TONAL_SNIPPET[(tw['region'], tw['dir'])]}**")
    style = _GENRE_STYLE.get(m["genre_assumed"], _GENRE_STYLE["default"])
    return {
        "genre": m["genre_assumed"], "bpm": m["bpm"], "fixes": fixes,
        "artist": style["artist"], "safe": style["safe"], "moods": style["moods"],
    }


def render_prompt(parts, allow_artist=False, brief=False):
    """Flatten prompt parts to a comma prompt. allow_artist only where the
    platform tolerates artist name-drops; brief trims for short prompt boxes."""
    fixes = parts["fixes"][:2] if brief else parts["fixes"]
    moods = parts["moods"][:1] if brief else parts["moods"]
    style = parts["artist"] if (allow_artist and parts["artist"]) else parts["safe"]
    return ", ".join([parts["genre"], f"{parts['bpm']} bpm", *fixes, style, *moods])


if __name__ == "__main__":
    import sys, json
    from analyze import analyze
    genre = sys.argv[2] if len(sys.argv) > 2 else "melodic techno"
    lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    raw = analyze(sys.argv[1], genre)
    print(json.dumps(build_insights(raw, lang), indent=2, ensure_ascii=False))
