import { useEffect, useState } from 'react'
import { auth, db } from './lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'

function formatRM(n) {
  return `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TaxCalculator() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [brackets, setBrackets] = useState([])
  const [reliefs, setReliefs] = useState([])
  const [zakatPaid, setZakatPaid] = useState('')
  const [annualIncome, setAnnualIncome] = useState('')

  useEffect(() => { loadYear(year) }, [year])

  async function loadYear(y) {
    const uid = auth.currentUser.uid
    const bSnap = await getDocs(query(collection(db, 'users', uid, 'taxBrackets'), where('taxYear', '==', y)))
    const rSnap = await getDocs(query(collection(db, 'users', uid, 'taxReliefs'), where('taxYear', '==', y)))
    const zDoc = await getDoc(doc(db, 'users', uid, 'taxSettings', String(y)))
    setBrackets(bSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.bandOrder - b.bandOrder))
    setReliefs(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setZakatPaid(zDoc.exists() ? String(zDoc.data().zakatPaid ?? '') : '')
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

  async function deleteBracket(row) {
    if (!confirm('Delete this tax band?')) return
    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'taxBrackets', row.id))
    setBrackets(brackets.filter(b => b.id !== row.id))
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

  async function deleteRelief(row) {
    if (!confirm(`Delete relief "${row.label}"?`)) return
    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'taxReliefs', row.id))
    setReliefs(reliefs.filter(r => r.id !== row.id))
  }

  async function saveZakat(val) {
    const uid = auth.currentUser.uid
    await setDoc(doc(db, 'users', uid, 'taxSettings', String(year)), {
      zakatPaid: val === '' ? null : parseFloat(val)
    }, { merge: true })
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
    const zakat = parseFloat(zakatPaid || 0)
    const refund = tax - zakat
    return { totalRelief, chargeable, tax, zakat, refund }
  }

  const result = annualIncome ? calculate() : null

  const inputClass = "bg-zinc-900 border border-fuchsia-500/30 text-white rounded px-3 py-2 focus:outline-none focus:border-cyan-400"
  const smallInputClass = "bg-zinc-900 border border-fuchsia-500/30 text-white rounded px-2 py-1 focus:outline-none focus:border-cyan-400"
  const deleteBtn = "text-xs text-fuchsia-400 underline ml-2 shrink-0"

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <input type="number" value={year} onChange={e => setYear(+e.target.value)}
        className={`${inputClass} w-28`} />

      <section>
        <h2 className="font-semibold mb-2 text-zinc-200">Reliefs ({year})</h2>
        {reliefs.map((r, i) => (
          <div key={r.id} className="flex gap-2 mb-1 items-center">
            <input value={r.label}
              onChange={e => { const c=[...reliefs]; c[i].label=e.target.value; setReliefs(c) }}
              onBlur={() => saveRelief(reliefs[i])}
              className={`${smallInputClass} flex-1`} />
            <input type="number" placeholder="amount" value={r.amount ?? ''}
              onChange={e => { const c=[...reliefs]; c[i].amount = e.target.value===''?null:+e.target.value; setReliefs(c) }}
              onBlur={() => saveRelief(reliefs[i])}
              className={`${smallInputClass} w-28`} />
            <button type="button" onClick={() => deleteRelief(reliefs[i])} className={deleteBtn}>Delete</button>
          </div>
        ))}
        <button onClick={addRelief} className="text-sm text-cyan-400 underline">+ Add relief</button>
      </section>

      <section>
        <h2 className="font-semibold mb-2 text-zinc-200">Zakat paid ({year})</h2>
        <input type="number" placeholder="Total zakat paid this year" value={zakatPaid}
          onChange={e => setZakatPaid(e.target.value)}
          onBlur={() => saveZakat(zakatPaid)}
          className={`${inputClass} w-full`} />
        <p className="text-xs text-zinc-500 mt-1">Zakat acts as a direct tax rebate (reduces tax payable ringgit for ringgit).</p>
      </section>

      <section>
        <h2 className="font-semibold mb-2 text-zinc-200">Tax bands ({year}) — fill in when rates are known</h2>
        {brackets.map((b, i) => (
          <div key={b.id} className="flex gap-2 mb-1 items-center text-sm">
            <input type="number" placeholder="From" value={b.bandFrom ?? ''}
              onChange={e => { const c=[...brackets]; c[i].bandFrom = e.target.value===''?null:+e.target.value; setBrackets(c) }}
              onBlur={() => saveBracket(brackets[i])}
              className={`${smallInputClass} w-20`} />
            <input type="number" placeholder="To" value={b.bandTo ?? ''}
              onChange={e => { const c=[...brackets]; c[i].bandTo = e.target.value===''?null:+e.target.value; setBrackets(c) }}
              onBlur={() => saveBracket(brackets[i])}
              className={`${smallInputClass} w-24`} />
            <input type="number" placeholder="Rate %" value={b.ratePercent ?? ''}
              onChange={e => { const c=[...brackets]; c[i].ratePercent = e.target.value===''?null:+e.target.value; setBrackets(c) }}
              onBlur={() => saveBracket(brackets[i])}
              className={`${smallInputClass} w-16`} />
            <button type="button" onClick={() => deleteBracket(brackets[i])} className={deleteBtn}>Delete</button>
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
          <div className="mt-3 rounded-lg bg-zinc-900 border border-fuchsia-500/15 divide-y divide-fuchsia-500/10 text-sm">
            <Row label="Total relief" value={formatRM(result.totalRelief)} />
            <Row label="Chargeable income" value={formatRM(result.chargeable)} />
            <Row label="Estimated annual tax" value={formatRM(result.tax)} />
            <Row label="Zakat paid" value={formatRM(result.zakat)} />
            <Row
              label="Total refund expected"
              value={formatRM(Math.abs(result.refund))}
              sub={result.refund > 0 ? '(tax still owed after zakat)' : result.refund < 0 ? '(refund expected)' : '(break even)'}
              highlight
            />
          </div>
        )}
      </section>
    </div>
  )
}

function Row({ label, value, sub, highlight }) {
  return (
    <div className={`flex justify-between items-center px-3 py-2 ${highlight ? 'bg-fuchsia-950/40' : ''}`}>
      <span className={highlight ? 'text-fuchsia-300 font-medium' : 'text-zinc-400'}>{label}
        {sub && <span className="ml-1 text-xs text-zinc-500">{sub}</span>}
      </span>
      <span className={highlight ? 'text-white font-semibold' : 'text-zinc-200'}>{value}</span>
    </div>
  )
}