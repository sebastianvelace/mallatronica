/** Visual placement transcribed from the curriculum image supplied by the user.
 * This is NOT a semester assignment from SIA and never changes eligibility.
 * Updated codes are matched by course name: Diseño (2028816), Taller (2024045).
 */
export type ReferenceSlot = { label: string; kind: 'foundation' | 'disciplinary' | 'free' }
export type ReferenceCell = string | ReferenceSlot | null
const free = (): ReferenceSlot => ({ label: 'Libre elección', kind: 'free' })
const optional = (label: string, kind: ReferenceSlot['kind']): ReferenceSlot => ({ label, kind })

export const referenceSemesters: ReferenceCell[][] = [
  ['1000004-B', free(), '2016502', '2015734', '2016509'],
  ['1000005-B', '1000003-B', '1000019-B', '2016375', free()],
  ['1000006-B', '1000007-B', '1000017-B', '1000040-B', '2016489'],
  ['2015159', free(), '1000020-B', '2016495', '2016490'],
  [optional('Probabilidad y estadística', 'foundation'), '2016506', '2016501', '2016496', '2016498'],
  ['2016500', '2016507', '2016487', optional('Optativa · análoga', 'disciplinary'), '2016499'],
  ['2015703', '2016493', '2016503', '2016492', optional('Optativa · digital', 'disciplinary')],
  [optional('Optativa · administración', 'foundation'), free(), free(), optional('Optativa · telecomunicaciones', 'disciplinary'), '2016497'],
  [optional('Optativa · administración', 'foundation'), free(), free(), free(), '2024045'],
  [free(), free(), free(), '2028816', '2015316'],
]

/** Suggested visual semester from the user-provided curriculum image, never an SIA rule. */
export function referenceSemesterForCode(code: string) {
  const normalized = code.toLocaleUpperCase().replace(/[^A-Z0-9]/g, '')
  const index = referenceSemesters.findIndex((semester) => semester.some((cell) => typeof cell === 'string'
    && cell.toLocaleUpperCase().replace(/[^A-Z0-9]/g, '') === normalized))
  return index === -1 ? null : index + 1
}
