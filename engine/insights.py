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
    intro_score = _score_range(intro, lo, hi, span_below=lo or 1, span_above=hi)
    if intro > hi:
        sev = "crit" if intro > hi * 1.7 else "warn"
        over = round(intro - (lo + hi) / 2)
        findings.append({
            "id": "Intro", "k": L("label_Intro"), "score": intro_score, "sev": sev,
            "headline": L("intro_bad_head", n=int(intro), over=over, lo=lo, hi=hi),
            "why": [L("intro_bad_why1", n=int(intro), lo=lo, hi=hi), L("intro_bad_why2"), L("intro_bad_why3")],
            "measure": [[f"{intro:.0f}s", L("ml_your_intro")], [f"{lo}-{hi}s", L("ml_genre_range")]],
            "fix": {"daw": L("intro_fix_daw", hi=hi), "suno": L("intro_fix_suno", hi=hi)},
        })
    else:
        findings.append({
            "id": "Intro", "k": L("label_Intro"), "score": max(88, intro_score), "sev": "good",
            "headline": L("intro_good_head", n=int(intro)),
            "why": [L("intro_good_why1", t=_fmt_time(intro), lo=lo, hi=hi)],
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
        })

    # ── Dynamics ──
    dr = m["dynamic_range_db"]
    if dr < 4:
        findings.append({
            "id": "Dynamics", "k": L("label_Dynamics"), "score": max(35, int(dr / 4 * 100)), "sev": "warn",
            "headline": L("dyn_head"), "why": [L("dyn_why1", dr=dr), L("dyn_why2")],
            "measure": [[f"{dr} dB", L("ml_dyn_range")]],
            "fix": {"daw": L("dyn_fix_daw"), "suno": L("dyn_fix_suno")},
        })

    # ── Stereo ──
    if not m["is_mono"] and m["stereo_width"] < 0.15:
        w = m["stereo_width"]
        findings.append({
            "id": "Stereo", "k": L("label_Stereo"), "score": 55, "sev": "warn",
            "headline": L("stereo_head"), "why": [L("stereo_why1")],
            "measure": [[f"{w}", L("ml_width")]],
            "fix": {"daw": L("stereo_fix_daw"), "suno": L("stereo_fix_suno")},
        })

    # ── Tempo / key (positive anchor) ──
    blo, bhi = norms["bpm"]
    bpm_ok = blo <= m["bpm"] <= bhi
    findings.append({
        "id": "Tempo", "k": L("label_Tempo"), "score": 95 if bpm_ok else 70, "sev": "good" if bpm_ok else "warn",
        "headline": L("tempo_head_ok" if bpm_ok else "tempo_head_off", bpm=m["bpm"], key=m["key"]),
        "why": [L("tempo_why1", blo=blo, bhi=bhi)]
               + ([L("why_hits", n=norms["n_hits"])] if norms.get("n_hits") else []),
        "measure": [[f"{m['bpm']}", L("ml_bpm")], [m["key"], L("ml_key")]]
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
    suno = _suno_prompt(m, findings)
    ai = _ai_signals(lang, m, L)

    return {
        "meta": {"duration": _fmt_time(m["duration_sec"]), "genre": m.get("ml_genre_pretty") or m["genre_assumed"], "bpm": m["bpm"], "key": m["key"]},
        "overall": overall,
        "verdict": verdict,
        "priority": priority,
        "findings": sorted(findings, key=lambda f: (f["id"] == "Character", f["score"])),
        "ai_signals": ai,
        "streaming": _streaming(lang, m, L),
        "suno_prompt": suno,
    }


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
        if delta > 0.5:
            row = {"name": name, "target": target, "status": "ok",
                   "d": L("st_down", d=abs(delta))}
        elif delta < -0.5 and boosts:
            row = {"name": name, "target": target, "status": "ok",
                   "d": L("st_boost", d=abs(delta))}
        elif delta < -0.5:
            row = {"name": name, "target": target, "status": "quiet",
                   "d": L("st_quiet", d=abs(delta), name=name)}
            quiet.append(abs(delta))
        else:
            row = {"name": name, "target": target, "status": "ok", "d": L("st_asis")}
        platforms.append(row)

    tp_ok = m["true_peak_db"] <= -1.0
    checks = [
        {"t": L("ml_true_peak"), "v": f"{m['true_peak_db']} dBTP", "ok": tp_ok,
         "d": L("st_tp_ok") if tp_ok else L("st_tp_bad")},
        {"t": L("label_Clipping"), "v": L("st_no") if not m["clipping"] else L("st_yes"),
         "ok": not m["clipping"],
         "d": L("st_clip_ok") if not m["clipping"] else L("st_clip_bad")},
        {"t": L("st_dur"), "v": _fmt_time(m["duration_sec"]), "ok": m["duration_sec"] >= 30,
         "d": L("st_dur_ok") if m["duration_sec"] >= 30 else L("st_dur_bad")},
    ]

    if quiet:
        level = "crit" if max(quiet) >= 4 else "warn"
        headline = L("st_head_quiet", n=len(quiet), d=max(quiet))
    elif not tp_ok or m["clipping"]:
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
    # Thresholds: measured 99th percentile of real human-made music
    # (norms_data.json "human_baseline") — adopted only when it RAISES the bar
    # above our conservative hand-set value and isn't saturated (30s-clip corpora
    # degenerate to 1.0 on structural tells). Never lower the bar from corpus
    # data: flagging a human artist as AI is the worst failure mode.
    from analyze import _MEASURED
    hb = _MEASURED.get("human_baseline") or {}

    def thr(k, default):
        p99 = (hb.get(k) or {}).get("p99")
        return p99 if p99 is not None and default < p99 < 0.999 else default
    tells = []
    if m.get("timing_rigidity", 0) >= thr("timing_rigidity", 0.92):
        tells.append({"t": L("ai_timing"), "d": L("ai_timing_d")})
    if m.get("section_repetition", 0) >= thr("section_repetition", 0.985):
        tells.append({"t": L("ai_repeat"), "d": L("ai_repeat_d")})
    if m.get("spectral_uniformity", 0) >= thr("spectral_uniformity", 0.96):
        tells.append({"t": L("ai_uniform"), "d": L("ai_uniform_d")})
    if m.get("dynamic_range_db", 99) < hb.get("dynamic_range_db_p05", 4):
        tells.append({"t": L("ai_flat"), "d": L("ai_flat_d")})

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
    return {"count": n, "level": level, "headline": headline, "tells": tells, "note": L("ai_note")}


def _priority(lang, weakest, m, L):
    wid = weakest["id"]
    if wid == "Intro":
        lo, hi = m["norms"]["intro_sec"]
        return L("prio_intro", n=int(m["intro_sec"]), over=round(m["intro_sec"] - (lo + hi) / 2), hi=hi)
    if wid == "Master":
        return L("prio_master", lufs=m["lufs"], llo=m["norms"]["lufs"][0])
    if wid == "Mix":
        return L("prio_mix")
    return L("prio_generic", k=L("name_" + wid))


# Genre-appropriate style anchors for the Suno prompt — the reference an A&R
# would actually name for that genre (Afterlife means nothing to a pop track).
_GENRE_STYLE = {
    "melodic techno": ["Afterlife / Anyma style", "cinematic", "emotional"],
    "house":          ["classic house groove", "warm analog feel", "dancefloor-ready"],
    "pop":            ["modern radio pop", "polished vocal production", "catchy"],
    "hip-hop":        ["modern hip-hop", "hard-hitting 808s", "clean vocal mix"],
    "edm":            ["festival EDM", "big-room energy", "massive drop"],
    "rock":           ["modern rock production", "live drum feel", "guitar-driven"],
    "lo-fi":          ["lo-fi chill", "warm tape saturation", "relaxed groove"],
    "default":        ["polished modern production", "emotional"],
}


def _suno_prompt(m, findings):
    """Suno prompt stays in English (Suno's native prompt language) — derived from real problems."""
    parts = [m["genre_assumed"], f"{m['bpm']} bpm"]
    fix_ids = {f["id"] for f in findings if f["sev"] in ("warn", "crit")}
    if "Intro" in fix_ids:
        parts.append(f"**short {m['norms']['intro_sec'][1]}-second intro, get to the hook fast**")
    if "Master" in fix_ids:
        parts.append("**louder, punchy modern master**")
    if "Mix" in fix_ids:
        parts.append("**clean low-mids, no 250 Hz mud**")
    if "Dynamics" in fix_ids:
        parts.append("**dynamic, less compressed**")
    if "Stereo" in fix_ids:
        parts.append("**wide stereo pads**")
    parts += _GENRE_STYLE.get(m["genre_assumed"], _GENRE_STYLE["default"])
    return ", ".join(parts)


if __name__ == "__main__":
    import sys, json
    from analyze import analyze
    genre = sys.argv[2] if len(sys.argv) > 2 else "melodic techno"
    lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    raw = analyze(sys.argv[1], genre)
    print(json.dumps(build_insights(raw, lang), indent=2, ensure_ascii=False))
