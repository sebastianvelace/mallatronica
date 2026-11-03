// Temporary probe: can a Vercel Function reach the public SIA course search?
// One page load and one filter postback, the minimum a snapshot needs.
const START = 'https://sia.unal.edu.co/Catalogo/facespublico/public/servicioPublico.jsf?taskflowId=task-flow-AC_CatalogoAsignaturas'
const USER_AGENT = 'mallatronica-probe/1.0 (+https://github.com/sebastianvelace/mallatronica)'

export default async function handler(request, response) {
  const result = { region: process.env.VERCEL_REGION ?? null, at: new Date().toISOString() }
  try {
    result.egressIp = (await (await fetch('https://api.ipify.org?format=json')).json()).ip
  } catch (error) {
    result.egressIp = `error: ${error.message}`
  }
  try {
    const started = Date.now()
    const page = await fetch(START, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es-CO,es' }, redirect: 'follow' })
    const html = await page.text()
    result.get = { status: page.status, ms: Date.now() - started, bytes: html.length, hasForm: html.includes('id="f1"'), server: page.headers.get('server'), via: page.headers.get('via') }
    if (page.ok && result.get.hasForm) {
      const cookies = (page.headers.getSetCookie?.() ?? []).map(cookie => cookie.split(';')[0]).join('; ')
      const action = html.match(/<form[^>]*id="f1"[^>]*action="([^"]+)"/)[1].replace(/&amp;/g, '&')
      const viewState = html.match(/name="javax.faces.ViewState" value="([^"]+)"/)?.[1]
      const body = new URLSearchParams({
        'org.apache.myfaces.trinidad.faces.FORM': 'f1',
        'Adf-Window-Id': 'winnoloop',
        'javax.faces.ViewState': viewState ?? '',
        'pt1:r1:0:soc1': '0',
        event: 'pt1:r1:0:soc1',
        'event.pt1:r1:0:soc1': '<m xmlns="http://oracle.com/richClient/comm"><k v="autoSubmit"><b>1</b></k><k v="suppressMessageShow"><s>true</s></k><k v="type"><s>valueChange</s></k></m>',
        'oracle.adf.view.rich.PROCESS': 'pt1:r1:0:soc1',
      })
      await new Promise(resolve => setTimeout(resolve, 1500))
      const postStarted = Date.now()
      const post = await fetch(new URL(action, 'https://sia.unal.edu.co'), {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Adf-Rich-Message': 'true', Cookie: cookies },
        body,
      })
      const text = await post.text()
      result.postback = { status: post.status, ms: Date.now() - postStarted, bytes: text.length, campusesListed: text.includes('SEDE BOGOT'), noop: text.includes('<noop/>') }
    } else {
      result.get.sample = html.slice(0, 200)
    }
  } catch (error) {
    result.error = error.message
  }
  response.setHeader('Cache-Control', 'no-store')
  response.status(200).json(result)
}
