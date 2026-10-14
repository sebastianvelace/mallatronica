import structure from '../../data/sia/v2/estructura.json'
import { courseCodeKey, subjects } from '../data/curriculum'

/** Component ceilings are not a certification of subgroup eligibility. */
export function creditBalance(approvedIds: readonly string[]) {
  const approved = new Set(approvedIds)
  const seen = new Set<string>()
  const rows = structure.resumen_creditos.filter(row => row.tipologia !== 'TOTAL').map(row => ({
    category: row.tipologia, required: row.exigidos, recorded: 0, allocated: 0, remaining: row.exigidos,
  }))
  for (const subject of subjects) {
    const code = courseCodeKey(subject.code)
    if (!approved.has(subject.id) || seen.has(code)) continue
    seen.add(code)
    const row = rows.find(item => subject.tipologia.startsWith(item.category))
    if (row) row.recorded += subject.credits
  }
  for (const row of rows) {
    row.allocated = Math.min(row.required, row.recorded)
    row.remaining = row.required - row.allocated
  }
  return { rows, allocated: rows.reduce((sum, row) => sum + row.allocated, 0), required: rows.reduce((sum, row) => sum + row.required, 0) }
}
