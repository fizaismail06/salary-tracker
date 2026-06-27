import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './lib/firebase'
import Auth from './Auth'
import SalaryEntryForm from './SalaryEntryForm'
import Dashboard from './Dashboard'
import TaxCalculator from './TaxCalculator'
import Insights from './Insights'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [editingEntry, setEditingEntry] = useState(null)

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false) }), [])

  if (loading) return null
  if (!user) return <Auth />

  function goToEntry(entry) {
    setEditingEntry(entry)
    setTab('entry')
  }

  function handleSaved() {
    setEditingEntry(null)
    setTab('dashboard')
  }

  return (
    <div className="min-h-screen bg-[#0a0118]">
      <nav className="sticky top-0 bg-[#0a0118]/95 backdrop-blur z-10 border-b border-fuchsia-500/20">
        <div className="flex justify-end px-3 pt-2">
          <button onClick={() => signOut(auth)} className="text-xs text-fuchsia-400 underline">
            Log out
          </button>
        </div>
        <div className="flex gap-2 justify-center flex-wrap p-3 pt-1">
          {['dashboard', 'entry', 'tax', 'insights'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t !== 'entry') setEditingEntry(null) }}
              className={
                tab === t
                  ? 'px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]'
                  : 'px-4 py-1.5 rounded-full text-sm font-medium uppercase tracking-wide text-zinc-400 border border-fuchsia-500/20 hover:border-fuchsia-500/50'
              }
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'dashboard' && <Dashboard onEdit={goToEntry} />}
      {tab === 'entry' && (
        <SalaryEntryForm
          editingEntry={editingEntry}
          onSaved={handleSaved}
          onCancel={() => { setEditingEntry(null); setTab('dashboard') }}
        />
      )}
      {tab === 'tax' && <TaxCalculator />}
      {tab === 'insights' && <Insights />}
    </div>
  )
}