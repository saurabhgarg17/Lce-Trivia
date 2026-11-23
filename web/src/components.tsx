import { useEffect, useState } from 'react'
import { mediaSrc, youTubeId, type LeaderboardEntry, type MediaType } from './api'

export const OPTION_COLORS = ['red', 'blue', 'yellow', 'green']

export function Shape({ index }: { index: number }) {
  const p = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'currentColor' }
  switch (index) {
    case 0:
      return <svg {...p}><polygon points="12,3 22,21 2,21" /></svg>
    case 1:
      return <svg {...p}><polygon points="12,2 22,12 12,22 2,12" /></svg>
    case 2:
      return <svg {...p}><circle cx="12" cy="12" r="10" /></svg>
    default:
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
  }
}

export function Media({ type, url, autoplay }: { type: MediaType; url: string | null; autoplay?: boolean }) {
  if (type === 'none' || !url) return null
  if (type === 'youtube') {
    const id = youTubeId(url)
    if (!id) return null
    return (
      <div className="media video">
        <iframe
          src={`https://www.youtube.com/embed/${id}?rel=0${autoplay ? '&autoplay=1' : ''}`}
          title="Question video"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  return (
    <div className="media">
      <img src={mediaSrc(url)} alt="" />
    </div>
  )
}

export function Confetti({ count = 70 }: { count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.4 + Math.random() * 2.2,
      size: 8 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 240,
      spin: 360 + Math.random() * 720,
      color: ['#f26a1b', '#ffd100', '#ffffff', '#1b1b1b', '#ff9a3c'][i % 5],
      round: i % 3 === 0,
    })),
  )
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.5),
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}

const ROW = 68

export function Leaderboard({
  entries,
  maxRows = 5,
  highlightId,
}: {
  entries: LeaderboardEntry[]
  maxRows?: number
  highlightId?: string
}) {
  const [moved, setMoved] = useState(false)
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(entries.map((e) => [e.playerId, e.prevScore])),
  )

  useEffect(() => {
    const t = setTimeout(() => setMoved(true), 1000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!moved) return
    const start = performance.now()
    const duration = 1400
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      const ease = 1 - Math.pow(1 - k, 3)
      setScores(
        Object.fromEntries(entries.map((e) => [e.playerId, Math.round(e.prevScore + (e.score - e.prevScore) * ease)])),
      )
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [moved, entries])

  const visible = entries.filter((e) => e.rank <= maxRows).sort((a, b) => a.playerId.localeCompare(b.playerId))
  const rows = Math.min(maxRows, entries.length)

  return (
    <div className="board" style={{ height: rows * ROW }}>
      {visible.map((e) => {
        const pos = (moved ? e.rank : e.prevRank) - 1
        const gained = e.score - e.prevScore
        return (
          <div
            key={e.playerId}
            className={`board-row ${e.playerId === highlightId ? 'me' : ''} ${moved && e.rank < e.prevRank ? 'up' : ''}`}
            style={{ transform: `translateY(${pos * ROW}px)`, height: ROW - 10 }}
          >
            <span className="board-rank">{moved ? e.rank : e.prevRank}</span>
            <span className="board-name">{e.name}</span>
            {e.streak >= 2 && <span className="streak">🔥 {e.streak}</span>}
            {moved && gained > 0 && <span className="gain">+{gained}</span>}
            <span className="board-score">{scores[e.playerId] ?? e.prevScore}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const top = entries.slice(0, 3)
  const order = [top[1], top[0], top[2]]
  const heights = [60, 100, 40]
  return (
    <div className="podium">
      {order.map((e, i) =>
        e ? (
          <div key={e.playerId} className={`podium-col place-${e.rank}`} style={{ animationDelay: `${e.rank === 1 ? 1.6 : e.rank === 2 ? 0.8 : 0}s` }}>
            <div className="podium-name">{e.rank === 1 ? '👑 ' : ''}{e.name}</div>
            <div className="podium-score">{e.score}</div>
            <div className="podium-block" style={{ height: heights[i] * 2 }}>{e.rank}</div>
          </div>
        ) : (
          <div key={i} className="podium-col" />
        ),
      )}
    </div>
  )
}
