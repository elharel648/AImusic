// Live A/B chain: src → band (peaking gain 0 = transparent bypass) → 3 fix
// EQs → makeup → mono → out. Ported verbatim from web/index.html.
let fxCtx = null, fxSrc = null, fxBand = null, fxFix = [], fxMakeup = null, fxMono = null, fxAudioEl = null

export function fxEnsure(audioEl) {
  if (!audioEl) return false
  const AC = window.AudioContext || window.webkitAudioContext
  if (!fxCtx) fxCtx = new AC()
  if (fxAudioEl !== audioEl) {
    try { if (fxSrc) fxSrc.disconnect() } catch { /* already gone */ }
    if (!fxBand) {
      fxBand = fxCtx.createBiquadFilter(); fxBand.type = 'peaking'; fxBand.gain.value = 0
      fxFix = [0, 1, 2].map(() => { const f = fxCtx.createBiquadFilter(); f.type = 'peaking'; f.gain.value = 0; return f })
      fxMakeup = fxCtx.createGain(); fxMono = fxCtx.createGain()
      fxBand.connect(fxFix[0]); fxFix[0].connect(fxFix[1]); fxFix[1].connect(fxFix[2])
      fxFix[2].connect(fxMakeup); fxMakeup.connect(fxMono); fxMono.connect(fxCtx.destination)
    }
    fxSrc = fxCtx.createMediaElementSource(audioEl); fxAudioEl = audioEl
    fxSrc.connect(fxBand)
  }
  if (fxCtx.state === 'suspended') fxCtx.resume()
  return true
}
export function fxReset() {
  if (!fxBand) return
  fxBand.type = 'peaking'; fxBand.gain.value = 0; fxMakeup.gain.value = 1
  fxFix.forEach(f => { f.gain.value = 0 })
  fxMono.channelCountMode = 'max'; fxMono.channelCount = 2
}
export function fxSolo(freq) {
  fxBand.type = 'bandpass'; fxBand.frequency.value = +freq; fxBand.Q.value = 2.2; fxMakeup.gain.value = 2.4
}
export function fxMonoOn() {
  fxMono.channelCountMode = 'explicit'; fxMono.channelCount = 1
}
export function fxApplyMoves(moves) {
  moves.forEach((mv, i) => { fxFix[i].frequency.value = mv.f; fxFix[i].Q.value = mv.q; fxFix[i].gain.value = mv.g })
}
