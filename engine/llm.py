"""
LLM narrative layer — makes each report song-specific instead of templated.

Division of labor (honesty by construction):
  - The DSP engine (analyze.py) produces the MEASUREMENTS — ground truth.
  - The template layer (insights.py) produces SCORES, severities, measures,
    and fix instructions — deterministic, defensible.
  - This layer asks Claude to write only the NARRATIVE (verdict, priority,
    headlines, "why" bullets, producer quote, refined Suno prompt), grounded
    strictly in the measurements it is given. Numbers never come from the LLM.

Fail-safe: any error (no key, timeout, bad output) leaves the template text
in place — the API never breaks because the LLM hiccuped.

Enable with:  ANR_USE_LLM=1  (+ ANTHROPIC_API_KEY or an `ant auth login` profile)
Model override:  ANR_MODEL=claude-sonnet-5  (default: claude-opus-4-8)
"""
from __future__ import annotations
import json
import logging
import os

_log = logging.getLogger("anr")

DEFAULT_MODEL = "claude-opus-4-8"

LANG_NAMES = {
    "en": "English", "he": "Hebrew", "es": "Spanish", "fr": "French",
    "de": "German", "pt": "European Portuguese", "pt-BR": "Brazilian Portuguese",
}

# Structured-output schema: narrative fields only. No scores — those are computed.
_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string"},
        "priority": {"type": "string"},
        "producer_quote": {"type": "string"},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "headline": {"type": "string"},
                    "why": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["id", "headline", "why"],
                "additionalProperties": False,
            },
        },
        "suno_prompt": {"type": "string"},
        "ai_note": {"type": "string"},
    },
    "required": ["verdict", "priority", "producer_quote", "findings", "suno_prompt", "ai_note"],
    "additionalProperties": False,
}

SYSTEM = """You are a veteran A&R at a major label reviewing a demo. Your written reads are famous for being honest, specific, and useful — never generic, never cruel, never flattering.

You will receive real acoustic measurements of one track (loudness, tempo, key, intro length, spectral balance, stereo image, energy curve, AI-production signals) plus the deterministic findings a measurement engine produced.

Write the narrative layer of the report. Hard rules:
- Ground EVERY claim in the measurements provided. Never invent facts about melody, lyrics, or vocals — you have not heard them.
- Never promise commercial success, chart positions, or playlist placement. No fabricated percentages.
- Reference concrete numbers from the data (seconds, LUFS, Hz, BPM) — that's what makes the read credible.
- Voice: a senior producer talking to an artist they respect. Direct, warm, zero fluff. Vary your phrasing — no stock sentences.
- For each finding id given, write a one-line headline and 2-3 short "why" bullets tied to the numbers.
- The producer_quote is one punchy sentence — what you'd say across the desk.
- The suno_prompt must be in English (Suno responds best to English): comma-separated style tags that fix the actual weaknesses found, keeping the genre and BPM.
- Write everything except suno_prompt in {language}."""


def llm_available() -> bool:
    """True when the LLM layer is switched on. Requires explicit opt-in (costs money)."""
    return os.environ.get("ANR_USE_LLM") == "1"


def llm_ready() -> bool:
    """llm_available() AND a credential actually resolves. This is what the
    health probe reports — opt-in with a missing key would otherwise show
    llm:true while every report silently fell back to template text."""
    if not llm_available():
        return False
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    try:  # `ant auth login` profile — the client resolves it or raises
        import anthropic
        anthropic.Anthropic()
        return True
    except Exception:
        return False


def _build_user_message(report: dict, raw: dict, genre: str) -> str:
    slim_raw = {k: v for k, v in raw.items() if k not in ("energy_curve", "norms")}
    slim_raw["energy_curve_summary"] = {
        "peak_moment_sec": raw.get("peak_moment_sec"),
        "n_points": len(raw.get("energy_curve", [])),
    }
    findings_in = [
        {"id": f["id"], "score": f["score"], "sev": f["sev"],
         "measures": f.get("measure", []), "template_headline": f["headline"]}
        for f in report["findings"]
    ]
    return json.dumps({
        "genre": genre,
        "measurements": slim_raw,
        "genre_norms": raw.get("norms", {}),
        "engine_findings": findings_in,
        "ai_signals": report.get("ai_signals", {}),
        "overall_score": report.get("overall"),
    }, ensure_ascii=False)


def enrich_report(report: dict, raw: dict, lang: str = "en", genre: str = "melodic techno") -> dict:
    """Replace template narrative with song-specific LLM narrative. Never raises."""
    try:
        import anthropic
        client = anthropic.Anthropic(timeout=90.0)
        model = os.environ.get("ANR_MODEL", DEFAULT_MODEL)

        response = client.messages.create(
            model=model,
            max_tokens=8000,
            thinking={"type": "adaptive"},
            # No cache_control: the persona is ~300 tokens, well under the
            # 1024-token minimum cacheable prefix — a marker here would be a no-op.
            system=[{
                "type": "text",
                "text": SYSTEM.replace("{language}", LANG_NAMES.get(lang, "English")),
            }],
            output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
            messages=[{"role": "user", "content": _build_user_message(report, raw, genre)}],
        )

        stop = getattr(response, "stop_reason", None)
        if stop not in (None, "end_turn"):
            # truncation/refusal would otherwise be indistinguishable from success
            _log.warning("LLM stopped with %r — serving template text", stop)
            return report
        text = next((b.text for b in response.content if b.type == "text"), None)
        if not text:
            return report
        data = json.loads(text)

        # Merge: narrative from the LLM, numbers from the engine.
        report["verdict"] = data["verdict"]
        report["priority"] = data["priority"]
        report["producer_quote"] = data["producer_quote"]
        report["suno_prompt"] = data["suno_prompt"]
        # The LLM authors one platform-neutral prompt; drop the template parts
        # so the client shows the LLM's text on every platform instead.
        report.pop("prompt", None)
        if report.get("ai_signals"):
            report["ai_signals"]["note"] = data["ai_note"]
        by_id = {f["id"]: f for f in data.get("findings", [])}
        for f in report["findings"]:
            llm_f = by_id.get(f["id"])
            if llm_f and llm_f.get("headline"):
                f["headline"] = llm_f["headline"]
                if llm_f.get("why"):
                    f["why"] = llm_f["why"][:3]
        report["source"] = "llm"
        return report
    except Exception:
        # Fail-safe by design, but never invisible: without this log line an
        # expired key looks identical to the LLM layer working perfectly.
        _log.exception("LLM narrative failed — serving template text")
        report["source"] = "template"
        return report
