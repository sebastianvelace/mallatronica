import { choose, hiddenFields, options, parseResults, resultLinks, unescapeHtml } from './parse.js'

const BASE = 'https://sia.unal.edu.co'
const PAGE = `${BASE}/Catalogo/facespublico/public/servicioPublico.jsf`
export const SEARCH_URL = `${PAGE}?taskflowId=task-flow-AC_CatalogoAsignaturas`
const USER_AGENT = 'mallatronica-snapshot/2.0 (+https://github.com/sebastianvelace/mallatronica)'

// Filter components of the search form, in cascade order.
const LEVEL = 'pt1:r1:0:soc1'
const CAMPUS = 'pt1:r1:0:soc9'
const FACULTY = 'pt1:r1:0:soc2'
const PLAN = 'pt1:r1:0:soc3'
const TYPOLOGY = 'pt1:r1:0:soc4'
const SEARCH = 'pt1:r1:0:cb1'
export const BACK = 'pt1:r1:0:cb4'

export class SiaHttpError extends Error {
  constructor(readonly status: number) {
    super(status === 403
      ? 'El SIA rechazó la conexión (403). Ocurre con algunos centros de datos, como los runners de GitHub.'
      : `El SIA respondió HTTP ${status}.`)
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * The SIA is an Oracle ADF Faces application without a public API. This client
 * replays the partial postbacks a browser sends on the public course search,
 * keeping the session cookie and view state ADF requires. It waits between
 * requests to stay gentle with the server.
 */
export class AdfClient {
  requests = 0
  private cookies = new Map<string, string>()
  private fields: Record<string, string> = {}
  private values: Record<string, string> = {}
  private formUrl = ''

  constructor(private readonly pauseMs = 1500) {}

  async open() {
    const page = await this.request(SEARCH_URL)
    const form = page.match(/<form[^>]*id="f1"[^>]*action="([^"]+)"/)
    if (!form) throw new Error('No se encontró el formulario del buscador: la página cambió.')
    this.formUrl = BASE + unescapeHtml(form[1])
    this.fields = hiddenFields(page)
    return page
  }

  private async request(url: string, data?: Record<string, string>) {
    if (this.requests) await sleep(this.pauseMs)
    this.requests++
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT, 'Accept-Language': 'es-CO,es' }
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
    if (data) {
      headers['Adf-Rich-Message'] = 'true'
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    }
    const response = await fetch(url, { method: data ? 'POST' : 'GET', headers, body: data ? new URLSearchParams(data) : undefined, redirect: 'follow' })
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';')
      const separator = pair.indexOf('=')
      if (separator > 0) this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim())
    }
    if (!response.ok) throw new SiaHttpError(response.status)
    const text = await response.text()
    const state = text.match(/name="javax.faces.ViewState" value="([^"]+)"|<update id="javax.faces.ViewState"><!\[CDATA\[([^\]]+)\]\]>/)
    if (state) this.fields['javax.faces.ViewState'] = unescapeHtml(state[1] ?? state[2])
    return text
  }

  private async post(component: string, payload: string, extra: Record<string, string> = {}) {
    const data = { ...this.fields, ...this.values, 'org.apache.myfaces.trinidad.faces.FORM': 'f1', event: component, [`event.${component}`]: payload, ...extra }
    const text = await this.request(this.formUrl, data)
    // Navigation responses ask the browser to load the resulting page.
    return text.includes('__handleRichResponseAction') ? this.request(PAGE) : text
  }

  /** A value change on a select; the response refreshes the dependent selects. */
  select(component: string, value: string) {
    this.values[component] = value
    const payload = '<m xmlns="http://oracle.com/richClient/comm"><k v="autoSubmit"><b>1</b></k><k v="suppressMessageShow"><s>true</s></k><k v="type"><s>valueChange</s></k></m>'
    return this.post(component, payload, { 'oracle.adf.view.rich.PROCESS': component })
  }

  action(component: string) {
    return this.post(component, '<m xmlns="http://oracle.com/richClient/comm"><k v="type"><s>action</s></k></m>')
  }

  /** Pregrado → campus → faculty → plan, as a person would pick them. Returns the plan label. */
  async openPlan(campus: string, faculty: string, plan: string) {
    await this.open()
    let page = await this.select(LEVEL, '0')
    page = await this.select(CAMPUS, choose(page, CAMPUS, campus))
    page = await this.select(FACULTY, choose(page, FACULTY, faculty))
    const planValue = choose(page, PLAN, plan)
    page = await this.select(PLAN, planValue)
    return { page, label: options(page, PLAN).find(([value]) => value === planValue)?.[1] ?? plan }
  }

  async search(page: string, typology: string) {
    await this.select(TYPOLOGY, choose(page, TYPOLOGY, typology))
    const results = await this.action(SEARCH)
    return { rows: parseResults(results), links: resultLinks(results), page: results }
  }
}
