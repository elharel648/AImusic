// The engine API — same endpoints, same contract as web/index.html.
export const MAX_UPLOAD = 100 * 1024 * 1024

const postOnce = (file, { genre = 'auto', lang = 'en', deep = false, purpose } = {}) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('genre', genre)
  fd.append('lang', lang)
  if (deep) fd.append('deep', '1')
  if (purpose) fd.append('purpose', purpose)
  return fetch('/api/analyze', { method: 'POST', body: fd })
    .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.detail || 'Analysis failed')))
}

/** POST /api/analyze with one silent retry on a network drop (server restart). */
export function analyze(file, opts) {
  return postOnce(file, opts).catch(err => {
    if (err instanceof TypeError)
      return new Promise(res => setTimeout(res, 1500)).then(() => postOnce(file, opts))
    throw err
  })
}

/** The demo goes through the SAME translation engine as a real file. */
export function demo(lang, v = 1) {
  return fetch(`/api/demo?lang=${encodeURIComponent(lang)}&v=${v}`)
    .then(r => r.ok ? r.json() : Promise.reject('demo failed'))
}

export function health() {
  return fetch('/api/health').then(r => r.ok).catch(() => false)
}
