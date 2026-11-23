import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const getPath = () => window.location.hash.replace(/^#/, '') || '/'

export function usePath() {
  return useSyncExternalStore(subscribe, getPath)
}

export function go(path: string) {
  window.location.hash = path
}
