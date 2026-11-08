import { useEffect, useState } from 'react'
import { api, getToken, setToken } from './api.js'
import { validEmail } from './util.js'

// Shows login / sign up, then the app. The login token is a JWT issued by the Express server.
export default function AuthGate({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api.get('/api/auth/me').then(setProfile).catch(() => setToken(null)).finally(() => setLoading(false))
  }, [])

  const signOut = () => { setToken(null); setProfile(null) }
  const onAuthed = ({ token, user }) => { setToken(token); setProfile(user) }

  if (loading) return <p className="muted pad center">Loading…</p>
  if (!profile) return <Login onAuthed={onAuthed} />
  return children({ profile, signOut })
}

function Login({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault(); setMsg('')
    if (mode === 'signup' && f.name.trim().length < 2) return setMsg('Enter your full name.')
    if (!validEmail(f.email)) return setMsg('Enter a valid email address.')
    if (f.password.length < 8) return setMsg('Password must be at least 8 characters.')
    setBusy(true)
    try {
      const email = f.email.trim().toLowerCase()
      onAuthed(mode === 'login'
        ? await api.post('/api/auth/login', { email, password: f.password })
        : await api.post('/api/auth/register', { email, password: f.password, full_name: f.name.trim() }))
    } catch (err) { setMsg(err.message); setBusy(false) }
  }

  return (
    <main className="auth">
      <h1 className="brand-lg">Velvet Seat</h1>
      <form className="panel" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
        {mode === 'signup' && <label>Full name<input value={f.name} onChange={set('name')} autoComplete="name" /></label>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label>Password<input type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {msg && <p className="banner err">{msg}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg('') }}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
        </button>
      </form>
    </main>
  )
}
