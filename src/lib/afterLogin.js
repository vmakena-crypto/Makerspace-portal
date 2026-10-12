// Remembers the page the user wanted (e.g. /checkin?t=TOKEN) while they log in
// or fill in their profile, then sends them back there.
const KEY = 'after_login'

export function rememberPath(path) {
  try {
    if (path && path !== '/' && !path.startsWith('/login')) {
      localStorage.setItem(KEY, path)
    }
  } catch {
    /* storage can be blocked; fall back to the home page */
  }
}

export function consumePath() {
  try {
    const p = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    return p
  } catch {
    return null
  }
}
