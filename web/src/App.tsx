import { usePath } from './router'
import Home from './pages/Home'
import Library from './pages/Library'
import Editor from './pages/Editor'
import Host from './pages/Host'
import Play from './pages/Play'

export default function App() {
  const path = usePath()
  const parts = path.split('/').filter(Boolean)
  return (
    <>
      <div className="brand-bar" />
      <Routes parts={parts} />
    </>
  )
}

function Routes({ parts }: { parts: string[] }) {
  if (parts[0] === 'quizzes') {
    if (parts[1] === 'new') return <Editor key="new" />
    if (parts[1]) return <Editor key={parts[1]} id={parts[1]} />
    return <Library />
  }
  if (parts[0] === 'host' && parts[1]) return <Host key={parts[1]} code={parts[1]} />
  if (parts[0] === 'play' && parts[1]) return <Play key={parts[1]} code={parts[1]} />
  const code = parts[0] === 'join' ? (parts[1] ?? '') : ''
  return <Home key={code} initialCode={code} />
}
