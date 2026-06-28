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

function pctChange(curr, prev) {
  if (prev === 0 || prev == null) return null
  return ((curr - prev) / prev) * 100
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

  const rows = yearly.map((y, i) => {
    const prev = yearly[i - 1]
    return {
      ...y,
      grossChange: prev ? pctChange(y.gross, prev.gross) : null,
      netChange: prev ? pctChange(y.net, prev.net) : null,
    }
  })

  function ChangeCell({ value }) {
    if (value === null) return <span className="text-zinc-500">—</span>
    return (
      <span className={value >= 0 ? 'text-cyan-400' : 'text-fuchsia-400'}>
        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold mb-4 text-zinc-200">Year-over-year comparison</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No entries yet — add some salary records first.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows}>
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

          <div className="mt-6 overflow-x-auto rounded-lg border border-fuchsia-500/15">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900 text-zinc-400 uppercase text-xs tracking-wide">
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium text-right">Gross</th>
                  <th className="px-3 py-2 font-medium text-right">Net</th>
                  <th className="px-3 py-2 font-medium text-right">PCB</th>
                  <th className="px-3 py-2 font-medium text-right">% Gross</th>
                  <th className="px-3 py-2 font-medium text-right">% Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fuchsia-500/10">
                {rows.map(r => (
                  <tr key={r.year} className="text-zinc-300">
                    <td className="px-3 py-2 font-medium text-white">{r.year}</td>
                    <td className="px-3 py-2 text-right">{formatRM(r.gross)}</td>
                    <td className="px-3 py-2 text-right">{formatRM(r.net)}</td>
                    <td className="px-3 py-2 text-right">{formatRM(r.pcb)}</td>
                    <td className="px-3 py-2 text-right"><ChangeCell value={r.grossChange} /></td>
                    <td className="px-3 py-2 text-right"><ChangeCell value={r.netChange} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}