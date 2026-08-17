// Reference tracks — up to 5 finished tracks you trust, measured by the same
// engine. Multi-ref list under 'anr_references'; migrates the old single
// 'anr_reference' entry transparently (user data carries over).
const REFS_KEY = 'anr_references'
const OLD_KEY = 'anr_reference'
export const MAX_REFS = 5
const REF_FIELDS = ['lufs', 'true_peak_db', 'dynamic_range_db', 'bpm', 'key', 'intro_sec', 'low_mid_ratio',
  'stereo_width', 'kick_bass_overlap', 'transient_strength', 'energy_curve', 'duration_sec']

export function loadRefs() {
  try {
    const a = JSON.parse(localStorage.getItem(REFS_KEY) || 'null')
    if (Array.isArray(a)) return a.filter(r => r && r.raw)
  } catch { /* fall through */ }
  try {   // migrate the single-reference era
    const r = JSON.parse(localStorage.getItem(OLD_KEY) || 'null')
    if (r && r.raw) { const list = [r]; saveRefs(list); localStorage.removeItem(OLD_KEY); return list }
  } catch { /* none */ }
  return []
}
function saveRefs(list) {
  try { localStorage.setItem(REFS_KEY, JSON.stringify(list.slice(-MAX_REFS))) } catch { /* quota */ }
}
export function addRef(name, raw) {
  const slim = {}; REF_FIELDS.forEach(k => { if (raw[k] !== undefined) slim[k] = raw[k] })
  const list = loadRefs().filter(r => r.name !== name)
  list.push({ name, ts: Date.now(), raw: slim })
  saveRefs(list)
}
export function removeRef(name) { saveRefs(loadRefs().filter(r => r.name !== name)) }
export function clearRefs() { try { localStorage.removeItem(REFS_KEY); localStorage.removeItem(OLD_KEY) } catch { /* noop */ } }
