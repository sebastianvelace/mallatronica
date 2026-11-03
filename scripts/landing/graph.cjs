// Builds the landing's "constellation": the real prerequisite network of plan 2545,
// laid out once with a small seeded force simulation so the browser only draws it.
// Run: node scripts/landing/graph.cjs  (rerun when data/sia/plan2545.json changes)
const fs = require('node:fs')
const path = require('node:path')

const plan = require('../../data/sia/plan2545.json')
const courses = plan.filter((c) => !String(c.tipologia).startsWith('NIVELACI'))
const index = new Map(courses.map((c, i) => [c.codigo, i]))
const edges = []
for (const c of courses) for (const p of c.prerrequisitos ?? []) {
  if (index.has(p.codigo)) edges.push([index.get(p.codigo), index.get(c.codigo)])
}

let seed = 2545
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const nodes = courses.map((c) => ({ x: random() * 2 - 1, y: random() * 2 - 1, vx: 0, vy: 0 }))

for (let step = 0; step < 400; step++) {
  const cooling = 1 - step / 400
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j]
    const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 1e-4
    const f = 0.0016 / d2
    a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f
  }
  for (const [s, t] of edges) {
    const a = nodes[s], b = nodes[t]
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4
    const f = (d - 0.22) * 0.04
    a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f
  }
  for (const n of nodes) {
    n.vx -= n.x * 0.004; n.vy -= n.y * 0.006
    n.x += n.vx * cooling; n.y += n.vy * cooling; n.vx *= 0.6; n.vy *= 0.6
  }
}

const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y)
const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
const round = (v) => Math.round(v * 1000) / 1000
const graph = {
  source: 'data/sia/plan2545.json',
  nodes: nodes.map((n, i) => [round((n.x - minX) / (maxX - minX)), round((n.y - minY) / (maxY - minY)), /OBLIGATORIA/.test(courses[i].tipologia) ? 1 : 0]),
  edges,
  names: courses.filter((c) => /OBLIGATORIA/.test(c.tipologia)).map((c) => c.nombre).sort((a, b) => a.localeCompare(b, 'es')),
}
const out = path.join(__dirname, '../../src/landing/graph.json')
fs.writeFileSync(out, JSON.stringify(graph) + '\n')
console.log(`graph: ${graph.nodes.length} nodes, ${edges.length} edges, ${graph.names.length} names -> ${path.relative(process.cwd(), out)}`)
