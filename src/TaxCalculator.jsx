import { useEffect, useState } from 'react'
import { auth, db } from './lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore'

function formatRM(n) {
  return `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TaxCalculator() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [brackets, setBrackets] = useState([])
  const [reliefs, setReliefs] = useState([])
  const [annualIncome, setAnnualIncome] = useState('')

  useEffect(() => { loadYear(year) }, [year])

  async function loadYear(y) {
    const uid = auth.currentUser.uid
    const bSnap = await getDocs(query(collection(db, 'users', uid, 'taxBrackets'), where('taxYear', '==', y)))
    const rSnap = await getDocs(query(collection(db, 'users', uid, 'taxReliefs'), where('taxYear', '==', y)))
    setBrackets(bSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.bandOrder - b.bandOrder))
    setReliefs(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  async function addBracketRow() {
    const ref = await addDoc(collection(db, 'users', auth.currentUser.uid, 'taxBrackets'), {
      taxYear: year, bandOrder: brackets.length + 1, bandFrom: null, bandTo: null, ratePercent: null
    })
    setBrackets([...brackets, { id: ref.id, taxYear: year, bandOrder: brackets.length + 1, bandFrom: null, bandTo: null, ratePercent: null }])
  }

  async function saveBracket(row) {
    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'taxBrackets', row.id), {
      bandFrom: row.bandFrom, bandTo: row.bandTo, ratePercent: row.ratePercent
    })
  }

  async function addRelief() {
    const ref = await addDoc(collection(db, 'users', auth.currentUser.uid, 'taxReliefs'), {
      taxYear: year, label: 'New relief', amount: null
    })
    setReliefs([...reliefs, { id: ref.id, taxYear: year, label: 'New relief', amount: null }])
  }

  async function saveRelief(row) {
    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'taxReliefs', row.id), {
      label: row.label, amount: row.amount
    })
  }

  function calculate() {
    const totalRelief = reliefs.reduce((s, r) => s + (r.amount || 0), 0)
    const chargeable = Math.max(0, parseFloat(annualIncome || 0) - totalRelief)
    let remaining = chargeable
    let tax = 0
    for (const b of brackets) {
      if (b.ratePercent == null || b.bandFrom == null) continue
      const bandWidth = b.bandTo != null ? b.bandTo - b.bandFrom : Infinity
      const taxableInBand = Math.min(remaining, bandWidth)
      if (taxableInBand <= 0) continue
      tax += taxableInBand * (b.ratePercent / 100)
      remaining -= taxableInBand
      if (remaining <= 0) break
    }
    return { totalRelief, chargeable, tax, monthlyPCB: tax / 12 }
  }

  const result = annualIncome ? calculate() : null

  const inputClass = "bg-zinc-900 border border-fuchsia-500/30 text-white rounded px-3 py-2 focus:outline-none focus:border-cyan-400"
  const smallInputClass = "bg-zinc-900 border border-fuchsia-500/30 text-white rounded px-2 py-1 focus:outline-none focus:border-cyan-400"

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <input type="number" value={year} onChange={e => setYear(+e.target.value)}
        className={`${inputClass} w-28`} />

      <section>
        <h2 className="font-semibold mb-2 text-zinc-200">Reliefs ({year})</h2>
        {reliefs.map((r, i) => (
          <div key={r.id} className="flex gap-2 mb-1">
            <input value={r.label} onChange={e => { const c=[...reliefs]; c[i].label=e.target.value; setReliefs(c) }}
              onBlur={() => saveRelief(reliefs[i])} className={`${smallInputClass} flex-1`} />
            <input type="number" placeholder="amount" value={r.amount ?? ''}
              onChange={e => { const c=[...reliefs]; c[i].amount = e.target.value === '' ? null : +e.target.value; setReliefs(c) }}
              onBlur={() => saveRelief(reliefs[i])} className={`${smallInputClass} w-28`} />
          </div>
        ))}
        <button onClick={addRelief} className="text-sm text-cyan-400 underline">+ Add relief</button>
      </section>

      <section>
        <h2 className="font-semibold mb-2 text-zinc-200">Tax bands ({year}) — fill in when rates are known</h2>
        {brackets.map((b, i) => (
          <div key={b.id} className="flex gap-2 mb-1 items-center text-sm">
            <input type="number" placeholder="From" value={b.bandFrom ?? ''}
              onChange={e => { const c=[...brackets]; c[i].bandFrom = e.target.value===''?null:+e.target.value; setBrackets(c) }}
              onBlur={() => saveBracket(brackets[i])} className={`${smallInputClass} w-24`} />
            <input type="number" placeholder="To (blank = above)" value={b.bandTo ?? ''}
              onChange={e => { const c=[...brackets]; c[i].bandTo = e.target.value===''?null:+e.target.value; setBrackets(c) }}
              onBlur={() => saveBracket(brackets[i])} className={`${smallInputClass} w-32`} />
            <input type="number" placeholder="Rate %" value={b.ratePercent ?? ''}
              onChange={e => { const c=[...brackets]; c[i].ratePercent = e.target.value===''?null:+e.target.value; setBrackets(c) }}
              onBlur={() => saveBracket(brackets[i])} className={`${smallInputClass} w-20`} />
          </div>
        ))}
        <button onClick={addBracketRow} className="text-sm text-cyan-400 underline">+ Add band</button>
      </section>

      <section>
        <h2 className="font-semibold mb-2 text-zinc-200">Estimate</h2>
        <input type="number" placeholder="Projected annual income"
          value={annualIncome} onChange={e => setAnnualIncome(e.target.value)}
          className={`${inputClass} w-full`} />
        {result && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-300">
            <div>Total relief: {formatRM(result.totalRelief)}</div>
            <div>Chargeable income: {formatRM(result.chargeable)}</div>
            <div>Estimated annual tax: {formatRM(result.tax)}</div>
            <div>Estimated monthly PCB: {formatRM(result.monthlyPCB)}</div>
          </div>
        )}
      </section>
    </div>
  )
}