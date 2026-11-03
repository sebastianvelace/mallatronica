/**
 * Parsers for the public SIA course search (Oracle ADF Faces pages).
 * DOM-free so the same code runs in Vercel Functions, Node scripts and tests.
 */

export type SiaPrerequisite = { codigo: string; nombre: string; tipo: string; condicion: number; todas: boolean; correquisito: boolean }
export type SiaSession = { dia: string; inicio: string; fin: string; lugar: string }
export type SiaGroup = {
  grupo: string
  profesor: string | null
  fecha_inicio: string
  fecha_fin: string
  sesiones: SiaSession[]
  duracion: string
  jornada: string
  cupos_disponibles: number
}
export type SiaActivity = { actividad: string; grupos: SiaGroup[] }
export type SiaResultRow = { codigo: string; nombre: string; creditos: number | null; tipologia: string; sin_programar: boolean }
export type SiaCourse = SiaResultRow & { actividades?: SiaActivity[]; prerrequisitos?: SiaPrerequisite[]; detalle_no_disponible?: boolean }

export const CODE = '\\d{7}(?:-B)?'
const DAYS = 'LUNES|MARTES|MIÉRCOLES|JUEVES|VIERNES|SÁBADO|DOMINGO'

// HTML 4 Latin-1 entities (code points 160-255), plus the few others the SIA uses.
const latin1 = 'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(' ')
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' }
latin1.forEach((name, index) => { entities[name] = String.fromCodePoint(160 + index) })

export function unescapeHtml(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return entities[name] ?? whole
  })
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function hiddenFields(text: string) {
  const found: Record<string, string> = {}
  for (const tag of text.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = tag.match(/name="([^"]+)"/)
    const value = tag.match(/value="([^"]*)"/)
    if (name) found[unescapeHtml(name[1])] = value ? unescapeHtml(value[1]) : ''
  }
  return found
}

export function options(text: string, component: string): [string, string][] {
  const block = text.match(new RegExp(`id="${escapeRegExp(component)}::content"[^>]*>(.*?)</select>`, 's'))
  if (!block) return []
  return [...block[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)].map(([, value, label]) => [value, unescapeHtml(label).trim()])
}

export function choose(text: string, component: string, startsWith: string) {
  const found = options(text, component).find(([, label]) => label.toUpperCase().startsWith(startsWith.toUpperCase()))
  if (!found) throw new Error(`No se encontró "${startsWith}" en ${component}: la página cambió o el filtro no existe.`)
  return found[0]
}

export function visibleText(fragment: string) {
  const withoutScripts = fragment.replace(/<script.*?<\/script>/gs, ' ')
  const text = unescapeHtml(withoutScripts.replace(/<[^>]+>/g, ' ')).replace(/_dfs\[[^;]*;|_dl\[[^;]*;|var _[^;]*;|if\(window\[[^}]*\}/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

export function parseResults(page: string): SiaResultRow[] {
  const start = page.indexOf('pt1:r1:0:t4::db')
  if (start < 0) return []
  const rows: SiaResultRow[] = []
  for (const [, row] of page.slice(start).matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(([, cell]) => visibleText(cell))
    if (cells.length < 4 || !new RegExp(`^${CODE}$`).test(cells[0] ?? '')) continue
    rows.push({
      codigo: cells[0],
      nombre: cells[1].replace('ASIGNATURA SIN PROGRAMAR', '').trim(),
      creditos: /^\d+$/.test(cells[2]) ? Number(cells[2]) : null,
      tipologia: cells[3],
      sin_programar: cells[1].includes('ASIGNATURA SIN PROGRAMAR'),
    })
  }
  return rows
}

/** Course code -> detail link, so a row is never opened by position. */
export function resultLinks(page: string) {
  const links: Record<string, string> = {}
  for (const [, link, code] of page.matchAll(/id="(pt1:r1:0:t4:\d+:cl2)"[^>]*>\s*([^<\s]+)\s*<\/a>/g)) links[code] = link
  return links
}

export function parsePrerequisites(text: string): SiaPrerequisite[] {
  const at = text.indexOf('Prerrequisitos')
  if (at < 0) return []
  const body = text.slice(at + 'Prerrequisitos'.length).split('Tipo de prerrequisito implica')[0]
  const result: SiaPrerequisite[] = []
  for (const condition of body.matchAll(/Condición (\d+) Tipo (\w) ¿Todas\? \[(\w)\] Número asignaturas \[(\d*)\](.*?)(?=Condición \d+ Tipo|$)/g)) {
    for (const [, code, name] of condition[5].trim().matchAll(new RegExp(`(${CODE}) (.+?)(?= ${CODE} |$)`, 'g'))) {
      result.push({ codigo: code, nombre: name.trim(), tipo: condition[2], condicion: Number(condition[1]), todas: condition[3] === 'S', correquisito: condition[2] === 'E' })
    }
  }
  return result
}

/** "SALON DE CLASE 453-417. 453-417. 453 - Edificio. SALON" -> "453-417 · Edificio". */
export function place(raw: string) {
  const trimmed = raw.replace(/^[ .]+|[ .]+$/g, '')
  const parts = trimmed.split('. ').map(part => part.trim())
  if (parts.length >= 3 && /^\w+-\w+$/.test(parts[1]) && parts[2].includes(' - ')) return `${parts[1]} · ${parts[2].split(' - ').slice(1).join(' - ')}`
  return trimmed
}

export function parseSessions(text: string): SiaSession[] {
  const pattern = new RegExp(`(${DAYS}) de (\\d{2}:\\d{2}) a (\\d{2}:\\d{2})\\.\\s*(.*?)(?=(?:${DAYS}) de \\d{2}:\\d{2}|$)`, 'g')
  return [...text.matchAll(pattern)].map(match => ({ dia: match[1], inicio: match[2], fin: match[3], lugar: place(match[4]) }))
}

export function parseDetail(page: string, code: string): { actividades: SiaActivity[]; prerrequisitos: SiaPrerequisite[] } {
  const text = visibleText(page)
  // Groups follow the course title "Nombre (código)"; some pages add "Contenido de la asignatura".
  let content = text.split('Prerrequisitos')[0]
  const title = content.split(new RegExp(`\\(${escapeRegExp(code)} ?\\)`))
  content = (title.length > 1 ? title.slice(1).join(`(${code})`) : content)
  const heading = content.indexOf('Contenido de la asignatura')
  if (heading >= 0) content = content.slice(heading + 'Contenido de la asignatura'.length)
  // Activity headers: "CLASE MAGISTRAL (2016488)", "CLASE TEORICA 1000003 (21000003)" or
  // "CLASE PRACTICA-Programación de Computadores (2015734)"; groups follow as "(id) ... Profesor:".
  const pieces = content.split(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+?(?:-[^()]+?)?)(?: \d+)? \([\w-]+ ?\) (?=\([^()]+\) [^()]+? Profesor: )/)
  const activities: SiaActivity[] = []
  for (let index = 1; index + 1 < pieces.length; index += 2) {
    const groups: SiaGroup[] = []
    // "(1) Grupo 1 Profesor:" or "(1) 2024045-1 Taller de proyectos interdisciplinarios Profesor:".
    for (const group of pieces[index + 1].matchAll(/\(([^()]+)\) (?:Grupo )?(.+?) Profesor: (.*?)\. Facultad: (.*?)Horarios\/Aula: (.*?) Fecha: (\d{2}\/\d{2}\/\d{4}) - (\d{2}\/\d{2}\/\d{4}) (.*?) Duración: (.*?) Jornada: (.*?) Cupos disponibles: (\d+)/g)) {
      const name = group[2].trim()
      const numbered = name.match(new RegExp(`^${escapeRegExp(code)}-(\\S+)`))
      groups.push({
        grupo: numbered ? numbered[1] : name,
        profesor: group[3].trim() || null,
        fecha_inicio: group[6],
        fecha_fin: group[7],
        sesiones: parseSessions(group[8]),
        duracion: group[9].trim(),
        jornada: group[10].trim(),
        cupos_disponibles: Number(group[11]),
      })
    }
    // Without "Contenido de la asignatura" the faculty header sticks to the first label.
    const label = pieces[index].trim().replace(/^FACULTAD DE .*?(?=\b(?:CLASE|LABORATORIO|TALLER|PR[AÁ]CTICA|SEMINARIO|PROYECTO|TUTOR[IÍ]A|SALIDA|ACTIVIDAD)\b)/, '')
    activities.push({ actividad: label.trim(), grupos: groups })
  }
  return { actividades: activities, prerrequisitos: parsePrerequisites(text) }
}
