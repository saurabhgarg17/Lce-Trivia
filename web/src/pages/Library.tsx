import { useEffect, useState } from 'react'
import { api, mediaSrc, type QuizSummary } from '../api'
import { go } from '../router'

export default function Library() {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    api
      .listQuizzes()
      .then(setQuizzes)
      .catch((e: Error) => setError(e.message))

  useEffect(() => {
    void load()
  }, [])

  const host = async (id: string) => {
    try {
      const { code, hostToken } = await api.createGame(id)
      sessionStorage.setItem(`host:${code}`, hostToken)
      go(`/host/${code}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const remove = async (q: QuizSummary) => {
    if (!confirm(`Delete "${q.title}"?`)) return
    await api.deleteQuiz(q.id)
    void load()
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="link" onClick={() => go('/')}>← Join a game</button>
        <h2 className="brand-title"><img src="/mascot.png?v=2" alt="" /> LCE Trivia · My trivias</h2>
        <button className="btn dark" onClick={() => go('/quizzes/new')}>+ Create trivia</button>
      </header>
      {error && <p className="error">{error}</p>}
      {quizzes?.length === 0 && <p className="muted">No trivias yet. Create your first one!</p>}
      <div className="grid">
        {quizzes?.map((q) => (
          <div key={q.id} className="card quiz-card">
            <div className="cover" style={q.coverUrl ? { backgroundImage: `url(${mediaSrc(q.coverUrl)})` } : undefined} />
            <div className="quiz-body">
              <h3>{q.title}</h3>
              <p className="muted">{q.questionCount} question{q.questionCount === 1 ? '' : 's'}</p>
              <div className="row">
                <button className="btn green" onClick={() => host(q.id)}>Host</button>
                <button className="btn" onClick={() => go(`/quizzes/${q.id}`)}>Edit</button>
                <button className="btn ghost" onClick={() => remove(q)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
