import { useEffect, useState } from 'react'
import { auth, db } from './lib/firebase'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'

const fields = [
  ['basic', 'Basic'], ['allowance', 'Allowance'], ['phone', 'Phone'],
  ['petrol', 'Petrol'], ['bonus', 'Bonus'], ['exGratia', 'Ex Gratia'],
  ['professional', 'Professional'], ['otherIncome', 'Other income'],
  ['epf', 'EPF / KWSP'], ['socso', 'SOCSO'], ['eis', 'EIS / SIP'],
  ['pcb', 'PCB (tax deducted)'], ['otherDeduction', 'Other deduction'],
]

const blank = { employer: '', entryDate: '', notes: '', isProjection: false }

export default function SalaryEntryForm({ editingEntry, onSaved, onCancel }) {
  const [form, setForm] = useState(blank)

  useEffect(() => {
    setForm(editingEntry ? { ...blank, ...editingEntry } : blank)
  }, [editingEntry])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save(e) {
    e.preventDefault()
    const payload = {
      employer: form.employer,
      entryDate: form.entryDate, // stored as YYYY-MM-DD
      notes: form.notes,
      isProjection: !!form.isProjection,
    }
    fields.forEach(([key]) => { payload[key] = parseFloat(form[key] || 0) })

    if (editingEntry) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'salaryEntries', editingEntry.id), payload)
    } else {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'salaryEntries'), { ...payload, createdAt: serverTimestamp() })
    }
    onSaved?.()
    setForm(blank)
  }

  const inputClass = "bg-zinc-900 border border-fuchsia-500/30 rounded px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
  const numberInputClass = "bg-zinc-900 border border-fuchsia-500/30 text-white rounded px-2 py-1 w-32 text-right focus:outline-none focus:border-cyan-400"

  return (
    <form onSubmit={save} className="grid gap-3 p-4 max-w-md mx-auto">
      {editingEntry && (
        <div className="text-sm bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-500/30 rounded px-3 py-2">
          Editing entry from {editingEntry.entryDate}
        </div>
      )}

      <input placeholder="Employer name" value={form.employer}
        onChange={e => set('employer', e.target.value)} required
        className={inputClass} />

      <label className="text-xs text-zinc-400">Date (day of payment or bonus date)</label>
      <input type="date" value={form.entryDate} onChange={e => set('entryDate', e.target.value)}
        required className={inputClass} />

      {fields.map(([key, label]) => (
        <label key={key} className="flex justify-between items-center text-sm text-zinc-300">
          {label}
          <input type="number" step="0.01" value={form[key] || ''}
            onChange={e => set(key, e.target.value)}
            className={numberInputClass} />
        </label>
      ))}

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={!!form.isProjection}
          onChange={e => set('isProjection', e.target.checked)} />
        This is a projection / estimate (not actual payslip data yet)
      </label>

      <textarea placeholder="Notes (optional)" value={form.notes}
        onChange={e => set('notes', e.target.value)}
        className={inputClass} />

      <div className="flex gap-2">
        <button className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white rounded py-2 flex-1 font-medium shadow-[0_0_15px_rgba(217,70,239,0.4)] hover:opacity-90">
          {editingEntry ? 'Save changes' : 'Save entry'}
        </button>
        {editingEntry && (
          <button type="button" onClick={onCancel}
            className="bg-zinc-900 border border-fuchsia-500/30 text-zinc-300 rounded py-2 px-4">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}