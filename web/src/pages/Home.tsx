import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { go } from '../router'

export default function Home({ initialCode = '' }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const c = code.trim()
      await api.gameExists(c)
      sessionStorage.setItem(`name:${c}`, name.trim())
      go(`/play/${c}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <img className="mascot" src="/mascot.png?v=2" alt="" />
      <h1 className="logo">LCE Trivia<small>PIZZA! PIZZA! TRIVIA!</small></h1>
      <form className="card join-card" onSubmit={submit}>
        <input
          inputMode="numeric"
          placeholder="Game PIN"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        <input placeholder="Nickname" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button className="btn dark big" disabled={busy || code.length < 6 || !name.trim()}>
          Enter
        </button>
      </form>
      <button className="btn ghost" onClick={() => go('/quizzes')}>
        Create or host a trivia →
      </button>
    </div>
  )
}
