import { useCallback, useEffect, useRef, useState } from 'react'
import type { HubConnection } from '@microsoft/signalr'
import { createHub, type GameState } from './api'

/**
 * Connects to the game hub. `setup` runs after every (re)connect to register this
 * connection with the game (host token or player id); it returns an error message or null.
 */
export function useGame(setup: (hub: HubConnection) => Promise<string | null>) {
  const [state, setState] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const hubRef = useRef<HubConnection | null>(null)
  const offsetRef = useRef(0)
  const setupRef = useRef(setup)
  useEffect(() => {
    setupRef.current = setup
  })

  useEffect(() => {
    let cancelled = false
    const hub = createHub()
    hubRef.current = hub

    hub.on('state', (s: GameState) => {
      offsetRef.current = s.serverNow - Date.now()
      setState(s)
    })

    const register = async () => {
      const err = await setupRef.current(hub)
      if (!cancelled) {
        setError(err)
        setConnected(err === null)
      }
    }
    hub.onreconnecting(() => setConnected(false))
    hub.onreconnected(() => void register())
    hub.onclose(() => setConnected(false))

    hub
      .start()
      .then(() => (cancelled ? undefined : register()))
      .catch(() => !cancelled && setError('Cannot reach the game server.'))

    return () => {
      cancelled = true
      void hub.stop()
    }
  }, [])

  const invoke = useCallback(
    (method: string, ...args: unknown[]) => hubRef.current?.invoke(method, ...args) ?? Promise.resolve(),
    [],
  )
  const serverNow = useCallback(() => Date.now() + offsetRef.current, [])

  return { state, error, connected, invoke, serverNow }
}

/** Seconds remaining (fractional) until `endsAt` in server time. */
export function useCountdown(endsAt: number | undefined, serverNow: () => number) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!endsAt) return
    const tick = () => setRemaining(Math.max(0, (endsAt - serverNow()) / 1000))
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [endsAt, serverNow])
  return remaining
}
