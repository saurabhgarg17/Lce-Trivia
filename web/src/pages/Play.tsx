import { useEffect } from 'react'
import { go } from '../router'
import { Confetti, Leaderboard, OPTION_COLORS, Podium, Shape } from '../components'
import { useCountdown, useGame } from '../useGame'
import type { GameState } from '../api'

interface JoinResult {
  playerId: string | null
  error: string | null
}

export default function Play({ code }: { code: string }) {
  const { state, error, invoke, serverNow } = useGame(async (hub) => {
    const key = `player:${code}`
    const saved = sessionStorage.getItem(key)
    if (saved && (await hub.invoke<boolean>('Rejoin', code, saved))) return null
    const name = sessionStorage.getItem(`name:${code}`)
    if (!name) return 'Enter a nickname first.'
    const r = await hub.invoke<JoinResult>('Join', code, name)
    if (r.playerId) {
      sessionStorage.setItem(key, r.playerId)
      return null
    }
    return r.error ?? 'Could not join.'
  })

  if (error) {
    return (
      <div className="center-page">
        <p className="error">{error}</p>
        <button className="btn dark" onClick={() => go('/')}>Back</button>
      </div>
    )
  }
  if (!state || !state.me) return <div className="center-page"><p className="muted">Joining…</p></div>

  const me = state.me
  const answer = (choice: number) => void invoke('SubmitAnswer', code, me.id, choice)

  switch (state.phase) {
    case 'lobby':
      return (
        <div className="center-page purple">
          <h2>You're in, {me.name}!</h2>
          <p>See your name on the screen. Waiting for the host to start…</p>
          <div className="chips">{state.players.map((p) => <span key={p.id} className="chip">{p.name}</span>)}</div>
        </div>
      )
    case 'question':
      return <PlayerQuestion state={state} serverNow={serverNow} onAnswer={answer} />
    case 'reveal':
      return (
        <div className={`center-page result ${me.correct ? 'good' : 'bad'}`} role="status" aria-live="polite">
          <div className="result-icon">{!me.answered ? '⏰' : me.correct ? '✓' : '✕'}</div>
          <h2>{!me.answered ? "Time's up!" : me.correct ? 'Correct!' : 'Incorrect'}</h2>
          {me.correct && <p className="gain-big">+{me.points}</p>}
          {me.streak >= 2 && <p>🔥 {me.streak} in a row</p>}
          <p className="muted-light">Score: {me.score}</p>
        </div>
      )
    case 'leaderboard':
      return (
        <div className="stage player-board">
          <Confetti key={state.questionIndex} count={40} />
          <h2 className="stage-title">You're #{me.rank}</h2>
          <Leaderboard key={state.questionIndex} entries={state.leaderboard ?? []} maxRows={5} highlightId={me.id} />
          <p className="muted-light">{me.score} points</p>
        </div>
      )
    case 'finished':
      return (
        <div className="stage">
          <h2 className="stage-title">{me.rank === 1 ? '🏆 You won!' : `You finished #${me.rank}`}</h2>
          <Podium entries={state.leaderboard ?? []} />
          <p className="muted-light">{me.score} points</p>
          <button className="btn dark big" onClick={() => go('/')}>Play again</button>
        </div>
      )
  }
}

function PlayerQuestion({
  state,
  serverNow,
  onAnswer,
}: {
  state: GameState
  serverNow: () => number
  onAnswer: (i: number) => void
}) {
  const q = state.question!
  const me = state.me!
  const remaining = useCountdown(q.endsAt, serverNow)
  const pct = Math.min(100, (remaining / q.timeLimit) * 100)

  useEffect(() => {
    if (me.answered) return
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (Number.isInteger(i) && i >= 0 && i < q.options.length && !(e.target instanceof HTMLInputElement)) onAnswer(i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [me.answered, q.options.length, onAnswer])

  return (
    <div className="player-q">
      <div className="time-bar"><div style={{ width: `${pct}%` }} /></div>
      <div className="player-q-head">
        <span>{state.questionIndex + 1} / {state.totalQuestions}</span>
        <b>{Math.ceil(remaining)}s</b>
      </div>
      <p className="player-q-text">{q.text}</p>
      {me.answered ? (
        <div className="center-page purple"><h2>Answer locked in!</h2><p>Waiting for others…</p></div>
      ) : (
        <div className="options-grid player">
          {q.options.map((o, i) => (
            <button key={i} className={`opt ${OPTION_COLORS[i]}`} onClick={() => onAnswer(i)}>
              <Shape index={i} /><span>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
