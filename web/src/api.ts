import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'

// Set VITE_API_URL when the API is hosted separately (e.g. for a mobile client or production).
export const BASE: string = import.meta.env.VITE_API_URL ?? ''

export type MediaType = 'none' | 'image' | 'gif' | 'youtube'

export interface Question {
  id: string
  text: string
  mediaType: MediaType
  mediaUrl: string | null
  options: string[]
  correctIndex: number
  timeLimitSeconds: number
  points: number
}

export interface Quiz {
  id?: string
  title: string
  description: string
  questions: Question[]
}

export interface QuizSummary {
  id: string
  title: string
  description: string
  questionCount: number
  coverUrl: string | null
}

export interface QuestionView {
  text: string
  mediaType: MediaType
  mediaUrl: string | null
  options: string[]
  timeLimit: number
  startsAt: number
  endsAt: number
}

export interface LeaderboardEntry {
  playerId: string
  name: string
  rank: number
  prevRank: number
  score: number
  prevScore: number
  streak: number
}

export interface MeView {
  id: string
  name: string
  score: number
  rank: number
  answered: boolean
  choice: number
  correct: boolean | null
  points: number
  streak: number
}

export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished'

export interface GameState {
  code: string
  phase: Phase
  title: string
  serverNow: number
  players: { id: string; name: string }[]
  questionIndex: number
  totalQuestions: number
  question: QuestionView | null
  answeredCount: number
  playerCount: number
  correctIndex: number | null
  optionCounts: number[] | null
  leaderboard: LeaderboardEntry[] | null
  me: MeView | null
}

export function mediaSrc(url: string | null): string {
  if (!url) return ''
  return url.startsWith('/') ? BASE + url : url
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init)
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      message = (await res.json()).error ?? message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  listQuizzes: () => request<QuizSummary[]>('/api/quizzes'),
  getQuiz: (id: string) => request<Quiz>(`/api/quizzes/${id}`),
  createQuiz: (q: Quiz) => request<Quiz>('/api/quizzes', json('POST', q)),
  updateQuiz: (id: string, q: Quiz) => request<Quiz>(`/api/quizzes/${id}`, json('PUT', q)),
  deleteQuiz: (id: string) => request<void>(`/api/quizzes/${id}`, { method: 'DELETE' }),
  createGame: (quizId: string) =>
    request<{ code: string; hostToken: string }>('/api/games', json('POST', { quizId })),
  gameExists: (code: string) => request<{ code: string }>(`/api/games/${code}`),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ url: string; mediaType: MediaType }>('/api/media', { method: 'POST', body: form })
  },
}

export function createHub(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${BASE}/hubs/game`)
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build()
}

export function youTubeId(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1)
    return u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? null
  } catch {
    return null
  }
}

export function blankQuestion(): Question {
  return {
    id: crypto.randomUUID().replaceAll('-', ''),
    text: '',
    mediaType: 'none',
    mediaUrl: null,
    options: ['', '', '', ''],
    correctIndex: 0,
    timeLimitSeconds: 20,
    points: 1000,
  }
}
