"""LLM narrative layer tests — mocked client, no network, no cost."""
import sys
import os
import json
import types
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

from analyze import analyze          # noqa: E402
from insights import build_insights  # noqa: E402
import llm                           # noqa: E402


def _report(tmp_path):
    sr = 44100
    t = np.linspace(0, 16, sr * 16, endpoint=False)
    m = 0.4 * np.sin(2 * np.pi * 220 * t) + 0.2 * np.sin(2 * np.pi * 261.63 * t)
    p = str(tmp_path / "x.wav")
    sf.write(p, np.stack([m, m], axis=1), sr)
    raw = analyze(p)
    return build_insights(raw), raw


class _FakeBlock:
    type = "text"
    def __init__(self, text): self.text = text


class _FakeResponse:
    def __init__(self, payload): self.content = [_FakeBlock(json.dumps(payload))]


def test_enrich_merges_narrative(tmp_path, monkeypatch):
    report, raw = _report(tmp_path)
    ids = [f["id"] for f in report["findings"]]
    payload = {
        "verdict": "V-LLM", "priority": "P-LLM", "producer_quote": "Q-LLM",
        "suno_prompt": "pop, 120 bpm, better", "ai_note": "N-LLM",
        "findings": [{"id": i, "headline": f"H-{i}", "why": ["w1", "w2"]} for i in ids],
    }

    class FakeMessages:
        def create(self, **kw):
            # schema + system must be present in the request
            assert kw["output_config"]["format"]["type"] == "json_schema"
            assert "A&R" in kw["system"][0]["text"]
            return _FakeResponse(payload)

    class FakeClient:
        def __init__(self, **kw): self.messages = FakeMessages()

    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=FakeClient))
    scores_before = {f["id"]: f["score"] for f in report["findings"]}

    out = llm.enrich_report(report, raw, "en", "pop")

    assert out["source"] == "llm"
    assert out["verdict"] == "V-LLM" and out["priority"] == "P-LLM"
    assert out["producer_quote"] == "Q-LLM"
    for f in out["findings"]:
        assert f["headline"] == f"H-{f['id']}"
        # numbers must be untouched — LLM writes narrative only
        assert f["score"] == scores_before[f["id"]]
        assert f.get("measure") is not None


def test_enrich_falls_back_on_error(tmp_path, monkeypatch):
    report, raw = _report(tmp_path)
    verdict_before = report["verdict"]

    class Boom:
        def __init__(self, **kw): raise RuntimeError("no key")

    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=Boom))
    out = llm.enrich_report(report, raw, "en")
    assert out["source"] == "template"
    assert out["verdict"] == verdict_before   # untouched


def test_disabled_by_default(monkeypatch):
    monkeypatch.delenv("ANR_USE_LLM", raising=False)
    assert llm.llm_available() is False
    monkeypatch.setenv("ANR_USE_LLM", "1")
    assert llm.llm_available() is True
