import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync(new URL('../src/data/project.json', import.meta.url)))

test('the source register covers garage and all three house levels', () => {
  assert.deepEqual(data.floors.map(f => f.id), ['garage','level-1','level-2','level-3'])
  assert.deepEqual(data.floors.map(f => f.scheduleSheet), ['A-18','A-19','A-20','A-21'])
  assert.equal(new Set(data.floors.map(f => f.id)).size, 4)
})
test('published scheduled figures are not confused with digitized geometry', () => {
  assert.equal(Math.round(data.floors.reduce((sum, f) => sum + f.scheduleAreaM2, 0)*100), 71560)
  assert.equal(data.floors[2].terraceAreaM2, 22.51)
  for (const f of data.floors) {
    assert.equal(f.geometry, null)
    assert.equal(f.status, 'not-digitized')
    assert.ok(f.sourceSheets.includes(f.scheduleSheet))
  }
})
test('elevations and unresolved site data keep their provenance', () => {
  assert.equal(data.floors[1].relativeElevationMm, 0)
  assert.equal(data.floors[2].relativeElevationMm, 2930)
  assert.equal(data.floors[3].relativeElevationMm, null)
  assert.match(data.warnings.join(' '), /разрез/)
})
