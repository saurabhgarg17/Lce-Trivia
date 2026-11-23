import { useEffect, useState } from 'react'
import { go } from '../router'
import { Confetti, Leaderboard, Media, OPTION_COLORS, Podium, Shape } from '../components'
import { useCountdown, useGame } from '../useGame'
import type { GameState } from '../api'

export default function Host({ code }: { code: string }) {
  const token = sessionStorage.getItem(`host:${code}`) ?? ''
  const { state, error, invoke, serverNow } = useGame(async (hub) =>
    (await hub.invoke<boolean>('HostConnect', code, token)) ? null : 'Game not found or you are not the host.',
  )

  if (error) {
    return (
      <div className="center-page">
        <p className="error">{error}</p>
        <button className="btn dark" onClick={() => go('/quizzes')}>Back to trivias</button>
      </div>
    )
  }
  if (!state) return <div className="center-page"><p className="muted">Connecting…</p></div>

  const next = () => void invoke('HostNext', code, token)

  switch (state.phase) {
    case 'lobby':
      return <HostLobby state={state} onStart={next} />
    case 'question':
      return <HostQuestion state={state} serverNow={serverNow} onSkip={next} />
    case 'reveal':
      return <HostReveal state={state} onNext={next} />
    case 'leaderboard':
      return (
        <div className="stage">
          <Confetti key={state.questionIndex} />
          <h2 className="stage-title">Leaderboard</h2>
          <Leaderboard key={state.questionIndex} entries={state.leaderboard ?? []} maxRows={5} />
          <button className="btn dark big" onClick={next}>
            {state.questionIndex + 1 >= state.totalQuestions ? 'Final results' : 'Next question'}
          </button>
        </div>
      )
    case 'finished':
      return (
        <div className="stage">
          <Confetti count={120} />
          <h2 className="stage-title">🏆 {state.title}</h2>
          <Podium entries={state.leaderboard ?? []} />
          {(state.leaderboard?.length ?? 0) > 3 && (
            <ol className="rest" start={4}>
              {state.leaderboard!.slice(3).map((e) => (
                <li key={e.playerId}>{e.name} — {e.score}</li>
              ))}
            </ol>
          )}
          <button className="btn dark big" onClick={() => go('/quizzes')}>Done</button>
        </div>
      )
  }
}

function HostLobby({ state, onStart }: { state: GameState; onStart: () => void }) {
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | null>(null)
  const joinUrl = new URL(window.location.pathname, window.location.origin)
  joinUrl.hash = `/join/${state.code}`
  const inviteUrl = joinUrl.toString()

  useEffect(() => {
    if (!copyStatus) return
    const timeout = window.setTimeout(() => setCopyStatus(null), 2500)
    return () => window.clearTimeout(timeout)
  }, [copyStatus])

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <div className="stage">
      <div className="invite-tools">
        <p>Join at <a className="invite-url" href={inviteUrl}>{inviteUrl}</a> or open the app and enter the PIN</p>
        <button className="btn dark" onClick={() => void copyInvite()}>Copy invite link</button>
        {copyStatus && (
          <p className={`copy-feedback ${copyStatus}`} role="status" aria-live="polite">
            {copyStatus === 'copied' ? 'Invite link copied!' : 'Could not copy. Select and copy the invite link above.'}
          </p>
        )}
      </div>
      <div className="pin">{state.code}</div>
      <h2 className="stage-title">{state.title}</h2>
      <button className="btn green big" disabled={state.players.length === 0} onClick={onStart}>
        Start ({state.players.length} player{state.players.length === 1 ? '' : 's'})
      </button>
      <div className="chips">
        {state.players.map((p) => <span key={p.id} className="chip">{p.name}</span>)}
        {state.players.length === 0 && <span className="muted">Waiting for players…</span>}
      </div>
    </div>
  )
}

function HostQuestion({ state, serverNow, onSkip }: { state: GameState; serverNow: () => number; onSkip: () => void }) {
  const q = state.question!
  const remaining = useCountdown(q.endsAt, serverNow)
  return (
    <div className="stage question-stage">
      <div className="q-head">
        <span className="pill">{state.questionIndex + 1} / {state.totalQuestions}</span>
        <span className="pill">{state.answeredCount} / {state.playerCount} answered</span>
        <button className="btn" onClick={onSkip}>Skip</button>
      </div>
      <h2 className="q-big">{q.text}</h2>
      <div className="q-middle">
        <div className={`timer ${remaining <= 5 ? 'low' : ''}`}>{Math.ceil(remaining)}</div>
        <Media key={state.questionIndex} type={q.mediaType} url={q.mediaUrl} autoplay />
      </div>
      <div className="options-grid host">
        {q.options.map((o, i) => (
          <div key={i} className={`opt ${OPTION_COLORS[i]}`}><Shape index={i} /><span>{o}</span></div>
        ))}
      </div>
    </div>
  )
}

function HostReveal({ state, onNext }: { state: GameState; onNext: () => void }) {
  const q = state.question!
  const counts = state.optionCounts ?? []
  const max = Math.max(1, ...counts)
  return (
    <div className="stage question-stage">
      <h2 className="q-big">{q.text}</h2>
      <div className="bars">
        {q.options.map((o, i) => (
          <div key={i} className={`bar-col ${i === state.correctIndex ? 'right' : 'wrong'}`}>
            <div className="bar-count">{counts[i] ?? 0}</div>
            <div className={`bar ${OPTION_COLORS[i]}`} style={{ height: `${Math.max(6, ((counts[i] ?? 0) / max) * 100)}%` }} />
            <div className={`opt ${OPTION_COLORS[i]}`}>
              <Shape index={i} /><span>{o}</span>{i === state.correctIndex && <b>✓</b>}
            </div>
          </div>
        ))}
      </div>
      <button className="btn dark big" onClick={onNext}>Show leaderboard</button>
      <div className="correct-answer">
        <small>Correct answer</small>
        {q.options[state.correctIndex ?? 0]}
      </div>
    </div>
  )
}
