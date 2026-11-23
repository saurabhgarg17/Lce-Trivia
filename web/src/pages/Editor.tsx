import { useEffect, useState } from 'react'
import { api, blankQuestion, type MediaType, type Question, type Quiz } from '../api'
import { Media, OPTION_COLORS, Shape } from '../components'
import { go } from '../router'

const MEDIA_TYPES: { value: MediaType; label: string }[] = [
  { value: 'none', label: 'No media' },
  { value: 'image', label: 'Image' },
  { value: 'gif', label: 'GIF' },
  { value: 'youtube', label: 'YouTube' },
]

function prepare(quiz: Quiz): { quiz?: Quiz; error?: string } {
  if (!quiz.title.trim()) return { error: 'Give your trivia a title.' }
  const questions: Question[] = []
  for (const [i, q] of quiz.questions.entries()) {
    if (!q.text.trim()) return { error: `Question ${i + 1} needs text.` }
    const kept = q.options.map((text, idx) => ({ text: text.trim(), idx })).filter((o) => o.text)
    if (kept.length < 2) return { error: `Question ${i + 1} needs at least 2 answers.` }
    const correct = kept.findIndex((o) => o.idx === q.correctIndex)
    if (correct < 0) return { error: `Question ${i + 1}: the correct answer cannot be empty.` }
    if (q.mediaType !== 'none' && !q.mediaUrl?.trim()) return { error: `Question ${i + 1}: add a media URL or pick "No media".` }
    questions.push({ ...q, options: kept.map((o) => o.text), correctIndex: correct })
  }
  return { quiz: { ...quiz, questions } }
}

export default function Editor({ id }: { id?: string }) {
  const [quiz, setQuiz] = useState<Quiz>({ title: '', description: '', questions: [blankQuestion()] })
  const [sel, setSel] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!id)

  useEffect(() => {
    if (!id) return
    api
      .getQuiz(id)
      .then((q) => {
        const padded = q.questions.map((x) => ({ ...x, options: [...x.options, '', '', '', ''].slice(0, 4) }))
        setQuiz({ ...q, questions: padded })
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const q = quiz.questions[sel]
  const patch = (p: Partial<Question>) =>
    setQuiz((z) => ({ ...z, questions: z.questions.map((x, i) => (i === sel ? { ...x, ...p } : x)) }))

  const add = () => {
    setQuiz((z) => ({ ...z, questions: [...z.questions, blankQuestion()] }))
    setSel(quiz.questions.length)
  }
  const remove = (i: number) => {
    if (quiz.questions.length === 1) return
    setQuiz((z) => ({ ...z, questions: z.questions.filter((_, j) => j !== i) }))
    setSel(Math.max(0, i === sel ? i - 1 : sel > i ? sel - 1 : sel))
  }
  const duplicate = (i: number) => {
    const copy = { ...quiz.questions[i], id: blankQuestion().id }
    setQuiz((z) => ({ ...z, questions: [...z.questions.slice(0, i + 1), copy, ...z.questions.slice(i + 1)] }))
    setSel(i + 1)
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      const r = await api.upload(file)
      patch({ mediaType: r.mediaType, mediaUrl: r.url })
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const save = async () => {
    const { quiz: ready, error: err } = prepare(quiz)
    if (!ready) return setError(err!)
    setSaving(true)
    try {
      if (id) await api.updateQuiz(id, ready)
      else await api.createQuiz(ready)
      go('/quizzes')
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>

  return (
    <div className="page editor">
      <header className="topbar">
        <button className="link" onClick={() => go('/quizzes')}>← Back</button>
        <input
          className="title-input"
          placeholder="Trivia title"
          value={quiz.title}
          maxLength={100}
          onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
        />
        <button className="btn green" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="editor-layout">
        <aside className="q-list">
          {quiz.questions.map((x, i) => (
            <div key={x.id} className={`q-item ${i === sel ? 'active' : ''}`} onClick={() => setSel(i)} tabIndex={0} role="button" onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSel(i) } }}>
              <span className="q-num">{i + 1}</span>
              <span className="q-title">{x.text || 'Untitled question'}</span>
              <span className="q-actions">
                <button title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(i) }}>⧉</button>
                <button title="Delete" onClick={(e) => { e.stopPropagation(); remove(i) }}>✕</button>
              </span>
            </div>
          ))}
          <button className="btn dark" onClick={add}>+ Add question</button>
        </aside>

        {q && (
          <section className="q-form card">
            <input
              className="q-text"
              placeholder="Type your question"
              value={q.text}
              onChange={(e) => patch({ text: e.target.value })}
            />

            <div className="media-picker">
              <div className="seg">
                {MEDIA_TYPES.map((m) => (
                  <button
                    key={m.value}
                    className={q.mediaType === m.value ? 'on' : ''}
                    onClick={() => patch({ mediaType: m.value, mediaUrl: m.value === 'none' ? null : q.mediaUrl })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {(q.mediaType === 'image' || q.mediaType === 'gif') && (
                <div className="row">
                  <input
                    placeholder={`Paste ${q.mediaType} URL`}
                    value={q.mediaUrl ?? ''}
                    onChange={(e) => patch({ mediaUrl: e.target.value })}
                  />
                  <label className="btn">
                    Upload
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => void upload(e.target.files?.[0])} />
                  </label>
                </div>
              )}
              {q.mediaType === 'youtube' && (
                <input
                  placeholder="Paste YouTube link"
                  value={q.mediaUrl ?? ''}
                  onChange={(e) => patch({ mediaUrl: e.target.value })}
                />
              )}
              <Media type={q.mediaType} url={q.mediaUrl} />
            </div>

            <div className="options-grid">
              {q.options.map((o, i) => (
                <div key={i} className={`opt-edit ${OPTION_COLORS[i]}`}>
                  <Shape index={i} />
                  <input
                    placeholder={`Answer ${i + 1}${i > 1 ? ' (optional)' : ''}`}
                    value={o}
                    onChange={(e) => patch({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })}
                  />
                  <button
                    className={`correct ${q.correctIndex === i ? 'on' : ''}`}
                    title="Mark as correct"
                    onClick={() => patch({ correctIndex: i })}
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>

            <div className="row settings">
              <label>
                Time limit
                <select value={q.timeLimitSeconds} onChange={(e) => patch({ timeLimitSeconds: +e.target.value })}>
                  {[5, 10, 20, 30, 60, 90, 120].map((s) => <option key={s} value={s}>{s} sec</option>)}
                </select>
              </label>
              <label>
                Points
                <select value={q.points} onChange={(e) => patch({ points: +e.target.value })}>
                  <option value={0}>No points</option>
                  <option value={500}>Standard (500)</option>
                  <option value={1000}>Standard (1000)</option>
                  <option value={2000}>Double (2000)</option>
                </select>
              </label>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
