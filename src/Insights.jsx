import { useEffect, useState } from 'react'
import { auth, db } from './lib/firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const incomeKeys = ['basic','allowance','phone','petrol','bonus','exGratia','professional','otherIncome']
const deductionKeys = ['epf','socso','eis','pcb','otherDeduction']
const sum = (e, keys) => keys.reduce((s, k) => s + (e[k] || 0), 0)

function formatRM(n) {
  return `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Insights() {
  const [entries, setEntries] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const q = query(collection(db, 'users', auth.currentUser.uid, 'salaryEntries'), orderBy('entryDate'))
    const snap = await getDocs(q)
    setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  const years = [...new Set(entries.map(e => e.entryDate?.slice(0, 4)))].filter(Boolean).sort()

  const yearly = years.map(y => {
    const yEntries = entries.filter(e => e.entryDate?.startsWith(y))
    const gross = yEntries.reduce((s, e) => s + sum(e, incomeKeys), 0)
    const deduction = yEntries.reduce((s, e) => s + sum(e, deductionKeys), 0)
    const pcb = yEntries.reduce((s, e) => s + (e.pcb || 0), 0)
    return { year: y, gross, deduction, net: gross - deduction, pcb }
  })

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold mb-4 text-zinc-200">Year-over-year comparison</h2>

      {yearly.length === 0 ? (
        <p className="text-sm text-zinc-500">No entries yet — add some salary records first.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearly}>
              <XAxis dataKey="year" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip
                formatter={(v) => formatRM(v)}
                contentStyle={{ background: '#18122b', border: '1px solid rgba(217,70,239,0.3)', color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="gross" name="Gross income" fill="#22d3ee" radius={[4,4,0,0]} />
              <Bar dataKey="net" name="Net income" fill="#d946ef" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          <ul className="mt-6 divide-y divide-fuchsia-500/10">
            {yearly.map((y, i) => {
              const prev = yearly[i - 1]
              const change = prev && prev.net !== 0 ? ((y.net - prev.net) / prev.net) * 100 : null
              return (
                <li key={y.year} className="py-3 flex flex-wrap justify-between items-center gap-2 text-sm text-zinc-300">
                  <span className="font-medium text-white">{y.year}</span>
                  <span>Gross {formatRM(y.gross)}</span>
                  <span>Net {formatRM(y.net)}</span>
                  <span>PCB {formatRM(y.pcb)}</span>
                  {change !== null && (
                    <span className={change >= 0 ? 'text-cyan-400' : 'text-fuchsia-400'}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs {prev.year}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
