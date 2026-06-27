import { useState } from 'react'
import { auth } from './lib/firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'signin') await signInWithEmailAndPassword(auth, email, password)
      else await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0118]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-8 max-w-sm w-full rounded-xl bg-zinc-900/80 border border-fuchsia-500/20 shadow-[0_0_30px_rgba(217,70,239,0.15)]">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="bg-zinc-950 border border-fuchsia-500/30 rounded px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400" />
        <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="bg-zinc-950 border border-fuchsia-500/30 rounded px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400" />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white rounded py-2 font-medium shadow-[0_0_15px_rgba(217,70,239,0.4)] hover:opacity-90">
          {mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="text-sm text-cyan-300 underline">
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}