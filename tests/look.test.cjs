const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

const look = loadTs(() => require('../src/ui/look.ts'))
const { setPath } = loadTs(() => require('../src/ui/customizer.ts'))

test('stored looks are sanitized, so a bad value never breaks the map', () => {
  assert.deepEqual(look.sanitizeLook(null), look.defaultLook)
  assert.deepEqual(look.sanitizeLook('nope'), look.defaultLook)
  const bad = look.sanitizeLook({ background: { type: 'video', colors: ['red', '#ABCDEF'], angle: 900 }, cards: { radius: -4, shadow: 9, style: 'neon' }, font: 'comic' })
  assert.equal(bad.background.type, 'none')
  assert.equal(bad.background.colors[0], look.defaultLook.background.colors[0])
  assert.equal(bad.background.colors[1], '#abcdef')
  assert.equal(bad.background.angle, 360)
  assert.equal(bad.cards.radius, 0)
  assert.equal(bad.cards.shadow, 3)
  assert.equal(bad.cards.style, 'solid')
  assert.equal(bad.font, 'system')
  assert.deepEqual(look.loadLook({ getItem: () => '{broken' }), look.defaultLook)
  assert.deepEqual(look.loadLook({ getItem: () => { throw new Error('blocked') } }), look.defaultLook)
})

test('every preset is valid and produces a complete stylesheet', () => {
  const ids = new Set()
  for (const preset of look.presets) {
    assert.ok(!ids.has(preset.id)); ids.add(preset.id)
    assert.deepEqual(look.sanitizeLook(preset.look), preset.look, preset.id)
    const css = look.lookCss(preset.look)
    assert.doesNotMatch(css, /undefined|NaN/, preset.id)
    assert.match(css, /--map-foundation: #[0-9a-f]{6}/)
  }
  assert.ok(look.presets.length >= 8)
})

test('the default look leaves the map background untouched', () => {
  const css = look.lookCss(look.defaultLook)
  assert.doesNotMatch(css, /\.curriculum-grid \{ background-image/)
  assert.equal(look.isDarkBackground(look.defaultLook), null)
})

test('text on dark backgrounds turns light; on light ones it stays dark', () => {
  const night = look.presets.find((preset) => preset.id === 'grafito').look
  const paper = look.presets.find((preset) => preset.id === 'papel').look
  assert.equal(look.isDarkBackground(night), true)
  assert.equal(look.isDarkBackground(paper), false)
  assert.match(look.lookCss(night), /header \{ color: #f5f5f5/)
  assert.doesNotMatch(look.lookCss(paper), /header \{ color: #f5f5f5/)
  assert.ok(look.luminance('#ffffff') > 0.99 && look.luminance('#000000') < 0.01)
})

test('texture and background layers line up with their sizes', () => {
  const grid = look.sanitizeLook({ background: { type: 'mesh' }, texture: { type: 'grid', amount: 50 } })
  const rule = look.lookCss(grid).split('\n').find((line) => line.includes('.curriculum-grid { background-image'))
  const images = rule.match(/background-image: (.*?); background-size/)[1].split(/,\s*(?=(?:linear|radial)-gradient|url\()/)
  const sizes = rule.match(/background-size: (.*?);/)[1].split(', ')
  assert.equal(images.length, sizes.length)
})

test('random looks are always valid and editing a path keeps the rest', () => {
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let index = 0; index < 50; index++) {
    const value = look.randomLook(random)
    assert.deepEqual(look.sanitizeLook(value), value)
    assert.doesNotMatch(look.lookCss(value), /undefined|NaN/)
  }
  const edited = setPath(look.defaultLook, 'background.colors.2', '#123456')
  assert.equal(edited.background.colors[2], '#123456')
  assert.equal(edited.background.colors[0], look.defaultLook.background.colors[0])
  assert.equal(setPath(look.defaultLook, 'cards.radius', 99).cards.radius, 24)
  assert.equal(look.defaultLook.background.colors[2], '#3b1b16')
})
