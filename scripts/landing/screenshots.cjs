// Captures the app with an example student (5th semester) for the landing and the social card.
// Usage: npm run build && node scripts/landing/screenshots.cjs   (writes public/landing/*.jpg)
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const loadTs = require('../../tests/load-ts.cjs')

const { coursesBefore } = loadTs(() => require('../../src/views/onboarding.ts'))
const { emptyState } = loadTs(() => require('../../src/domain/state.ts'))
const { planSuggestions } = loadTs(() => require('../../src/domain/planner.ts'))

function exampleState() {
  const state = { ...emptyState('light'), onboarded: true, mathBasics: 'cumplida', literacy: 'cumplida', english: 'exento' }
  const grades = [3.8, 4.2, 3.5, 4.6, 3.9, 4.1, 4.4, 3.7, 4.0, 4.3]
  coursesBefore(5).forEach((subject, index) => { state.notes[subject.id] = grades[index % grades.length] })
  state.plan = planSuggestions(state, []).slice(0, 4).map((item) => item.subject.id)
  const blocks = [['Lunes', '07:00', '09:00'], ['Miércoles', '07:00', '09:00'], ['Martes', '09:00', '11:00'], ['Jueves', '09:00', '11:00'], ['Lunes', '14:00', '16:00'], ['Miércoles', '14:00', '16:00'], ['Viernes', '11:00', '13:00']]
  state.schedule = blocks.map(([day, start, end], index) => ({ id: `s${index}`, subjectId: state.plan[Math.floor(index / 2) % state.plan.length], day, start, end, group: String(index + 1), room: '411-203' }))
  return state
}

async function main() {
  const out = path.join(__dirname, '../../public/landing')
  fs.mkdirSync(out, { recursive: true })
  const server = spawn('npx', ['vite', 'preview', '--port', '4319', '--strictPort'], { stdio: 'ignore' })
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })
    await page.addInitScript((state) => localStorage.setItem('mallatronica-state-v2', JSON.stringify(state)), exampleState())
    for (const [view, file] of [['malla', 'malla'], ['plan', 'plan'], ['calculadora', 'notas'], ['horario', 'horario'], ['libre', 'libre']]) {
      await page.goto(`http://localhost:4319/app#${view}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      // The weekly grid is the point of the schedule view; bring it into the frame.
      if (view === 'horario') await page.evaluate(() => { const grid = document.querySelector('.week-grid'); if (grid) window.scrollTo(0, grid.getBoundingClientRect().top + window.scrollY - 220) })
      await page.waitForTimeout(200)
      await page.screenshot({ path: path.join(out, `${file}.jpg`), type: 'jpeg', quality: 78 })
      console.log(`landing/${file}.jpg`)
    }
    const phone = await browser.newPage({ viewport: { width: 390, height: 650 }, deviceScaleFactor: 2 })
    await phone.addInitScript((state) => localStorage.setItem('mallatronica-state-v2', JSON.stringify(state)), exampleState())
    for (const [view, file] of [['malla', 'malla'], ['plan', 'plan'], ['calculadora', 'notas'], ['horario', 'horario'], ['libre', 'libre']]) {
      await phone.goto(`http://localhost:4319/app#${view}`, { waitUntil: 'networkidle' })
      await phone.waitForTimeout(600)
      if (view === 'horario') await phone.evaluate(() => { const grid = document.querySelector('.week-grid'); if (grid) window.scrollTo(0, grid.getBoundingClientRect().top + window.scrollY - 16) })
      await phone.waitForTimeout(200)
      await phone.screenshot({ path: path.join(out, `${file}-mobile.jpg`), type: 'jpeg', quality: 72 })
      console.log(`landing/${file}-mobile.jpg`)
    }
    const card = await browser.newPage({ viewport: { width: 1200, height: 630 } })
    await card.goto('http://localhost:4319/', { waitUntil: 'networkidle' })
    await card.addStyleTag({ content: '.site-header,.hero-actions,.hero-saved,.live{display:none!important}.hero{min-height:630px;padding:0}' })
    await card.waitForTimeout(800)
    await card.screenshot({ path: path.join(out, 'og.jpg'), type: 'jpeg', quality: 85 })
    console.log('landing/og.jpg')
  } finally {
    await browser.close()
    server.kill()
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
