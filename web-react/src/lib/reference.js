// Reference track — same key + slim schema as web/index.html, carries over.
const REF_KEY = 'anr_reference'
const REF_FIELDS = ['lufs', 'true_peak_db', 'dynamic_range_db', 'bpm', 'key', 'intro_sec', 'low_mid_ratio',
  'stereo_width', 'kick_bass_overlap', 'transient_strength', 'energy_curve', 'duration_sec']

export function loadRefTrack() {
  try { const r = JSON.parse(localStorage.getItem(REF_KEY) || 'null'); return (r && r.raw) ? r : null }
  catch { return null }
}
export function saveRefTrack(name, raw) {
  const slim = {}; REF_FIELDS.forEach(k => { if (raw[k] !== undefined) slim[k] = raw[k] })
  try { localStorage.setItem(REF_KEY, JSON.stringify({ name, ts: Date.now(), raw: slim })) } catch { /* quota */ }
}
export function clearRefTrack() { try { localStorage.removeItem(REF_KEY) } catch { /* noop */ } }
