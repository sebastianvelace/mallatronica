export type CatalogCourseSource = 'manual' | 'imported' | 'sia-public'

export type CatalogCourse = {
  id: string
  code: string
  name: string
  credits: number
  category: string
  source: CatalogCourseSource
}

type CatalogCourseInput = Partial<CatalogCourse> & {
  courseCode?: unknown
  courseName?: unknown
  subjectCode?: unknown
  subjectName?: unknown
  component?: unknown
  typology?: unknown
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function slug(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function normalizeCatalogCourse(value: unknown, index: number, source: CatalogCourseSource): CatalogCourse | null {
  if (!value || typeof value !== 'object') return null
  const item = value as CatalogCourseInput
  const code = asText(item.code) || asText(item.courseCode) || asText(item.subjectCode)
  const name = asText(item.name) || asText(item.courseName) || asText(item.subjectName)
  const category = asText(item.category) || asText(item.component) || asText(item.typology)
  const credits = typeof item.credits === 'number' ? item.credits : Number(item.credits)
  if (!code || !name || !category || !Number.isFinite(credits) || credits <= 0 || credits > 12) return null

  return {
    id: asText(item.id) || `free-${slug(code)}-${index}`,
    code,
    name,
    credits,
    category,
    source,
  }
}

export function readCatalogCourses(value: unknown, source: CatalogCourseSource = 'imported') {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { courses?: unknown }).courses)
      ? (value as { courses: unknown[] }).courses
      : value && typeof value === 'object' && Array.isArray((value as { freeChoice?: unknown }).freeChoice)
        ? (value as { freeChoice: unknown[] }).freeChoice
        : []

  const seenCodes = new Set<string>()
  const seenIds = new Set<string>()
  return items.map((item, index) => normalizeCatalogCourse(item, index, source)).filter((item): item is CatalogCourse => {
    if (!item) return false
    const code = item.code.toLocaleUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!code || seenCodes.has(code) || seenIds.has(item.id)) return false
    seenCodes.add(code)
    seenIds.add(item.id)
    return true
  })
}
