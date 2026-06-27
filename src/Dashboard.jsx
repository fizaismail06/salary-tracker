import { useEffect, useMemo, useState } from 'react'
import { auth, db } from './lib/firebase'
import { collection, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const incomeKeys = ['basic','allowance','phone','petrol','bonus','exGratia','professional','otherIncome']
const deductionKeys = ['epf','socso','eis','otherDeduction']
const sum = (e, keys) => keys.reduce((s, k) => s + (e[k] || 0), 0)
const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatRM(n) {
  return `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Dashboard({ onEdit }) {
  const [entries, setEntries] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState('all')

  async function load() {
    const q = query(collection(db, 'users', auth.currentUser.uid, 'salaryEntries'), orderBy('entryDate'))
    const snap = await getDocs(q)
    setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { load() }, [])

  const years = useMemo(
    () => [...new Set(entries.map(e => e.entryDate?.slice(0, 4)))].filter(Boolean).sort(),
    [entries]
  )

  const filtered = entries.filter(e => {
    if (!e.entryDate?.startsWith(String(year))) return false
    if (month !== 'all' && e.entryDate?.slice(5, 7) !== month) return false
    return true
  })

  const projectionCount = filtered.filter(e => e.isProjection).length
  const totalIncome = filtered.reduce((s, e) => s + sum(e, incomeKeys), 0)
  const totalDeduction = filtered.reduce((s, e) => s + sum(e, deductionKeys), 0)

  const chartData = filtered.map(e => ({
    month: monthNames[parseInt(e.entryDate?.slice(5, 7), 10) - 1] || e.entryDate,
    net: sum(e, incomeKeys) - sum(e, deductionKeys)
  }))

  async function handleDelete(entry) {
    if (!confirm(`Delete the ${entry.entryDate} entry for ${entry.employer}? This can't be undone.`)) return
    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'salaryEntries', entry.id))
    setEntries(entries.filter(e => e.id !== entry.id))
  }

  async function handleDeleteAllProjections() {
    const toDelete = filtered.filter(e => e.isProjection)
    if (toDelete.length === 0) return
    if (!confirm(`Delete all ${toDelete.length} projection entries shown? This can't be undone.`)) return
    await Promise.all(toDelete.map(e => deleteDoc(doc(db, 'users', auth.currentUser.uid, 'salaryEntries', e.id))))
    setEntries(entries.filter(e => !toDelete.includes(e)))
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex gap-2 mb-3 flex-wrap">
        {years.map(y => (
          <button key={y} onClick={() => setYear(+y)}
            className={+y === year
              ? 'px-3 py-1 rounded bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.5)]'
              : 'px-3 py-1 rounded bg-zinc-900 text-zinc-400 border border-fuchsia-500/20'}>
            {y}
          </button>
        ))}
      </div>

      <select value={month} onChange={e => setMonth(e.target.value)}
        className="bg-zinc-900 border border-fuchsia-500/30 rounded px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-cyan-400">
        <option value="all">All months</option>
        {monthNames.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="Gross income" value={totalIncome} />
        <Stat label="Total deductions" value={totalDeduction} />
        <Stat label="Net income" value={totalIncome - totalDeduction} highlight />
        <Stat label="Entries" value={filtered.length} isCount />
      </div>

      {projectionCount > 0 && (
        <button onClick={handleDeleteAllProjections}
          className="mb-4 text-sm bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-500/30 rounded px-3 py-2 w-full text-left">
          {projectionCount} projection entr{projectionCount === 1 ? 'y' : 'ies'} shown — tap to delete all
        </button>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <defs>
            <linearGradient id="neonBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" stroke="#a1a1aa" />
          <YAxis stroke="#a1a1aa" />
          <Tooltip
            formatter={(v) => formatRM(v)}
            contentStyle={{ background: '#18122b', border: '1px solid rgba(217,70,239,0.3)', color: '#fff' }}
          />
          <Bar dataKey="net" fill="url(#neonBar)" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>

      <ul className="mt-4 divide-y divide-fuchsia-500/10">
        {filtered.map(e => (
          <li key={e.id} className="py-2 flex justify-between items-center text-sm gap-2 text-zinc-300">
            <span className="flex-1">
              {e.entryDate} — {e.employer}
              {e.isProjection && <span className="ml-2 text-xs bg-fuchsia-950/60 text-fuchsia-300 rounded px-1.5 py-0.5">projection</span>}
            </span>
            <span className="text-cyan-300">{formatRM(sum(e, incomeKeys))}</span>
            <button onClick={() => onEdit(e)} className="text-cyan-400 underline text-xs">Edit</button>
            <button onClick={() => handleDelete(e)} className="text-fuchsia-400 underline text-xs">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, value, highlight, isCount }) {
  return (
    <div className={highlight
      ? 'rounded-lg p-3 bg-gradient-to-br from-cyan-600 to-fuchsia-700 text-white shadow-[0_0_20px_rgba(217,70,239,0.4)]'
      : 'rounded-lg p-3 bg-zinc-900 border border-fuchsia-500/15 text-zinc-200'}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-semibold">{isCount ? value : formatRM(value)}</div>
    </div>
  )
}